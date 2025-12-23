import { strict as assert } from "assert";
import { Amplify } from "aws-amplify";
import * as amplifyAuth from "aws-amplify/auth";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";

import { processResponse } from "./buffer-utils";
import { API_URL } from "./constants";
import {
  AlarmsLogType,
  DeviceAssociationBody,
  DeviceAssociationResponse,
  DeviceInfoRawType,
  DeviceInfoType,
  EditDeviceAssociationBody,
  PowerDistributionType,
  RegenerationDataType,
  ServiceCountersType,
  ServiceStatusType,
  TotalCountersType,
  UsageAnalyticsType,
} from "./types";

/**
 * Makes a fetch request and returns parsed JSON response.
 * Throws an error for non-2xx status codes.
 */
const fetchJson = async <T>(
  baseURL: string,
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${baseURL}${path}`, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

const amplifyconfiguration = {
  aws_project_region: "eu-central-1",
  aws_user_pools_id: "eu-central-1_BYmQ2VBlo",
  aws_user_pools_web_client_id: "7sc1qltkqobo3ddqsk4542dg2h",
};

/**
 * Generates headers with a JWT token for authenticated requests.
 * @param {string} jwtToken - The JWT token for authorization.
 * @returns {object} - The headers object with the Authorization field.
 */
const headers = (jwtToken: string) => ({ Authorization: `Bearer ${jwtToken}` });

let amplifyConfigured = false;

/**
 * Configures Amplify if not already configured.
 * Uses a local flag to avoid calling getConfig() which prints a warning.
 * @param {object} [storage] - Optional custom storage adapter for token persistence
 */
const configureAmplify = (storage?: {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}) => {
  if (amplifyConfigured) return;
  Amplify.configure(amplifyconfiguration);
  if (storage) {
    cognitoUserPoolsTokenProvider.setKeyValueStorage(storage);
  }
  amplifyConfigured = true;
};

/**
 * Creates an authentication service with sign-in functionality.
 * @param {typeof amplifyAuth} auth - The authentication module to use.
 * @returns {object} - An object containing authentication-related methods.
 */
const createAuthService = (auth: typeof amplifyAuth) => {
  /**
   * Signs in a user with the provided credentials.
   * @param {string} username - The username of the user.
   * @param {string} password - The password of the user.
   * @param {boolean} [legacy=false] - If true, returns accessToken for legacy API.
   * @returns {Promise<string>} - The JWT token of the signed-in user.
   * @throws {Error} - If sign-in fails or no tokens are retrieved.
   */
  const signIn = async (
    username: string,
    password: string,
    legacy: boolean = false,
  ): Promise<string> => {
    configureAmplify();
    await auth.signOut(); // Ensure the user is signed out first
    const { isSignedIn } = await auth.signIn({ username, password });
    assert.ok(isSignedIn, "Sign-in failed");
    const { tokens } = await auth.fetchAuthSession();
    assert.ok(tokens, "No tokens found");
    if (legacy) {
      assert.ok(tokens.accessToken, "No access token found");
      return tokens.accessToken.toString();
    }
    assert.ok(tokens.idToken, "No ID token found");
    return tokens.idToken.toString();
  };

  /**
   * Retrieves the current session, refreshing tokens if necessary.
   * Requires a prior successful signIn() call.
   * @param {boolean} [forceRefresh=false] - Force token refresh even if valid
   * @param {boolean} [legacy=false] - If true, returns accessToken for legacy API
   * @returns {Promise<string>} - The JWT token (idToken or accessToken)
   * @throws {Error} - If no session exists (user needs to sign in)
   */
  const getSession = async (
    forceRefresh: boolean = false,
    legacy: boolean = false,
  ): Promise<string> => {
    configureAmplify();
    const { tokens } = await auth.fetchAuthSession({ forceRefresh });
    assert.ok(tokens, "No session found - please sign in first");
    if (legacy) {
      assert.ok(tokens.accessToken, "No access token found");
      return tokens.accessToken.toString();
    }
    assert.ok(tokens.idToken, "No ID token found");
    return tokens.idToken.toString();
  };

  return { signIn, getSession };
};

// Create the default auth service using amplifyAuth
const { signIn, getSession } = createAuthService(amplifyAuth);

const deviceInfo =
  (baseURL: string) =>
  /**
   * Retrieves information about a device by its MAC address.
   * Automatically decompresses any gzip-compressed Buffer fields in the response.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<DeviceInfoType>} - A promise that resolves to the device info.
   */
  async (jwtToken: string, macAddress: string): Promise<DeviceInfoType> => {
    const data = await fetchJson<DeviceInfoRawType>(
      baseURL,
      `device/${macAddress}/info`,
      {
        method: "GET",
        headers: headers(jwtToken),
      },
    );
    // Process response to decompress any gzipped Buffer fields
    return processResponse(data) as DeviceInfoType;
  };

const mqttCommand =
  (baseURL: string) =>
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  (jwtToken: string, macAddress: string, payload: any) =>
    fetchJson(baseURL, "mqtt/command", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...headers(jwtToken),
      },
      body: JSON.stringify({ mac_address: macAddress, ...payload }),
    });

const setPower =
  (baseURL: string) =>
  /**
   * Sends a command to set the power state of a device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} value - The desired power state (1 for ON, 0 for OFF).
   * @returns {Promise<string>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, value: number) =>
    mqttCommand(baseURL)(jwtToken, macAddress, { name: "power", value });

const setPowerOn =
  (baseURL: string) =>
  /**
   * Turns a device ON by setting its power state.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<string>} - A promise that resolves to the command response.
   *
   * @example
   * const response = await api.setPowerOn(jwtToken, macAddress);
   * console.log(response);
   */
  (jwtToken: string, macAddress: string) =>
    setPower(baseURL)(jwtToken, macAddress, 1);

const setPowerOff =
  (baseURL: string) =>
  /**
   * Turns a device OFF by setting its power state.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<string>} - A promise that resolves to the command response.
   *
   * @example
   * const response = await api.setPowerOff(jwtToken, macAddress);
   * console.log(response);
   */
  (jwtToken: string, macAddress: string) =>
    setPower(baseURL)(jwtToken, macAddress, 0);

const setPowerLevel =
  (baseURL: string) =>
  /**
   * Sets the manual power level of the device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} level - The power level (1-5).
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, level: number) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "power_level",
      value: level,
    });

const getPowerLevel =
  (baseURL: string) =>
  /**
   * Retrieves the current manual power level of the device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - A promise that resolves to the power level (1-5).
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.user_parameters.manual_power;
  };

const setFanSpeed =
  (baseURL: string) =>
  /**
   * Sets the speed of a fan by index.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {1 | 2 | 3} fanIndex - The fan index (1, 2, or 3).
   * @param {number} speed - The fan speed (0-5, 0=auto on some models).
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, fanIndex: 1 | 2 | 3, speed: number) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: `fan_${fanIndex}_speed`,
      value: speed,
    });

const getFanSpeed =
  (baseURL: string) =>
  /**
   * Retrieves the current speed of a fan by index.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {1 | 2 | 3} fanIndex - The fan index (1, 2, or 3).
   * @returns {Promise<number>} - A promise that resolves to the fan speed.
   */
  async (
    jwtToken: string,
    macAddress: string,
    fanIndex: 1 | 2 | 3,
  ): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    const fields: Record<1 | 2 | 3, number> = {
      1: info.nvm.user_parameters.fan_1_ventilation,
      2: info.nvm.user_parameters.fan_2_ventilation,
      3: info.nvm.user_parameters.fan_3_ventilation,
    };
    return fields[fanIndex];
  };

// Fan speed aliases for convenience
const setFan1Speed =
  (baseURL: string) => (jwtToken: string, macAddress: string, speed: number) =>
    setFanSpeed(baseURL)(jwtToken, macAddress, 1, speed);

const setFan2Speed =
  (baseURL: string) => (jwtToken: string, macAddress: string, speed: number) =>
    setFanSpeed(baseURL)(jwtToken, macAddress, 2, speed);

const setFan3Speed =
  (baseURL: string) => (jwtToken: string, macAddress: string, speed: number) =>
    setFanSpeed(baseURL)(jwtToken, macAddress, 3, speed);

const getFan1Speed =
  (baseURL: string) => (jwtToken: string, macAddress: string) =>
    getFanSpeed(baseURL)(jwtToken, macAddress, 1);

const getFan2Speed =
  (baseURL: string) => (jwtToken: string, macAddress: string) =>
    getFanSpeed(baseURL)(jwtToken, macAddress, 2);

const getFan3Speed =
  (baseURL: string) => (jwtToken: string, macAddress: string) =>
    getFanSpeed(baseURL)(jwtToken, macAddress, 3);

const setAirkare =
  (baseURL: string) =>
  /**
   * Enables or disables Airkare (air quality) mode.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {boolean} enabled - Whether to enable Airkare mode.
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, enabled: boolean) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "airkare_function",
      value: enabled ? 1 : 0,
    });

const setRelax =
  (baseURL: string) =>
  /**
   * Enables or disables Relax (comfort) mode.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {boolean} enabled - Whether to enable Relax mode.
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, enabled: boolean) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "relax_mode",
      value: enabled,
    });

const setStandby =
  (baseURL: string) =>
  /**
   * Enables or disables Standby mode.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {boolean} enabled - Whether to enable Standby mode.
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, enabled: boolean) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "standby_mode",
      value: enabled,
    });

const getStandby =
  (baseURL: string) =>
  /**
   * Retrieves the current Standby mode status.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<boolean>} - A promise that resolves to the standby status.
   */
  async (jwtToken: string, macAddress: string): Promise<boolean> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.user_parameters.is_standby_active;
  };

const setStandbyTime =
  (baseURL: string) =>
  /**
   * Sets the standby waiting time in minutes.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} minutes - The standby waiting time in minutes.
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, minutes: number) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "standby_time",
      value: minutes,
    });

const getStandbyTime =
  (baseURL: string) =>
  /**
   * Retrieves the standby waiting time in minutes.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - A promise that resolves to the standby time in minutes.
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.user_parameters.standby_waiting_time;
  };

const setAuto =
  (baseURL: string) =>
  /**
   * Enables or disables Auto mode for automatic temperature regulation.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {boolean} enabled - Whether to enable Auto mode.
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, enabled: boolean) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "auto_mode",
      value: enabled,
    });

const getAuto =
  (baseURL: string) =>
  /**
   * Retrieves the current Auto mode status.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<boolean>} - A promise that resolves to the auto mode status.
   */
  async (jwtToken: string, macAddress: string): Promise<boolean> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.user_parameters.is_auto;
  };

const getPower =
  (baseURL: string) =>
  /**
   * Retrieves the power status of the device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<boolean>} - A promise that resolves to the power status.
   */
  async (jwtToken: string, macAddress: string): Promise<boolean> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.status.commands.power;
  };

const getEnvironmentTemperature =
  (baseURL: string) =>
  /**
   * Retrieves the environment temperature from the device's sensors.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - A promise that resolves to the temperature value.
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.status.temperatures.enviroment;
  };

const getTargetTemperature =
  (baseURL: string) =>
  /**
   * Retrieves the target temperature for an environment zone.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {1 | 2 | 3} envIndex - The environment zone index (1, 2, or 3).
   * @returns {Promise<number>} - A promise that resolves to the target temperature (degrees Celsius).
   */
  async (
    jwtToken: string,
    macAddress: string,
    envIndex: 1 | 2 | 3,
  ): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    const fields: Record<1 | 2 | 3, number> = {
      1: info.nvm.user_parameters.enviroment_1_temperature,
      2: info.nvm.user_parameters.enviroment_2_temperature,
      3: info.nvm.user_parameters.enviroment_3_temperature,
    };
    return fields[envIndex];
  };

const setTargetTemperature =
  (baseURL: string) =>
  /**
   * Sets the target temperature for an environment zone.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {1 | 2 | 3} envIndex - The environment zone index (1, 2, or 3).
   * @param {number} temperature - The desired target temperature (degrees Celsius).
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (
    jwtToken: string,
    macAddress: string,
    envIndex: 1 | 2 | 3,
    temperature: number,
  ) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: `enviroment_${envIndex}_temperature`,
      value: temperature,
    });

// Environment temperature aliases for convenience
const setEnvironment1Temperature =
  (baseURL: string) =>
  (jwtToken: string, macAddress: string, temperature: number) =>
    setTargetTemperature(baseURL)(jwtToken, macAddress, 1, temperature);

const setEnvironment2Temperature =
  (baseURL: string) =>
  (jwtToken: string, macAddress: string, temperature: number) =>
    setTargetTemperature(baseURL)(jwtToken, macAddress, 2, temperature);

const setEnvironment3Temperature =
  (baseURL: string) =>
  (jwtToken: string, macAddress: string, temperature: number) =>
    setTargetTemperature(baseURL)(jwtToken, macAddress, 3, temperature);

const getEnvironment1Temperature =
  (baseURL: string) => (jwtToken: string, macAddress: string) =>
    getTargetTemperature(baseURL)(jwtToken, macAddress, 1);

const getEnvironment2Temperature =
  (baseURL: string) => (jwtToken: string, macAddress: string) =>
    getTargetTemperature(baseURL)(jwtToken, macAddress, 2);

const getEnvironment3Temperature =
  (baseURL: string) => (jwtToken: string, macAddress: string) =>
    getTargetTemperature(baseURL)(jwtToken, macAddress, 3);

const setMeasureUnit =
  (baseURL: string) =>
  /**
   * Sets the temperature measurement unit (Celsius or Fahrenheit).
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {boolean} isFahrenheit - true for Fahrenheit, false for Celsius.
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, isFahrenheit: boolean) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "measure_unit",
      value: isFahrenheit,
    });

const getMeasureUnit =
  (baseURL: string) =>
  /**
   * Retrieves the current temperature measurement unit setting.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<boolean>} - A promise that resolves to true if Fahrenheit, false if Celsius.
   */
  async (jwtToken: string, macAddress: string): Promise<boolean> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.user_parameters.is_fahrenheit;
  };

const setLanguage =
  (baseURL: string) =>
  /**
   * Sets the display language of the device.
   *
   * Language codes:
   * 0=Italian, 1=French, 2=English, 3=Spanish, 4=Portuguese,
   * 5=Danish, 6=Dutch, 7=German, 8=Hungarian, 9=Polish
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} languageCode - The language code (0-9).
   * @returns {Promise<unknown>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, languageCode: number) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "language",
      value: languageCode,
    });

const getLanguage =
  (baseURL: string) =>
  /**
   * Retrieves the current display language setting.
   *
   * Language codes:
   * 0=Italian, 1=French, 2=English, 3=Spanish, 4=Portuguese,
   * 5=Danish, 6=Dutch, 7=German, 8=Hungarian, 9=Polish
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - A promise that resolves to the language code (0-9).
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.user_parameters.language;
  };

const getPelletInReserve =
  (baseURL: string) =>
  /**
   * Retrieves the pellet reserve status.
   * Returns true if pellet level is low (in reserve), false if pellet level is ok.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<boolean>} - A promise that resolves to the pellet reserve status.
   */
  async (jwtToken: string, macAddress: string): Promise<boolean> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.status.flags.is_pellet_in_reserve;
  };

const getPelletAutonomyTime =
  (baseURL: string) =>
  /**
   * Retrieves the estimated pellet autonomy time.
   * Represents the estimated time remaining with current pellet level.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - A promise that resolves to the autonomy time (likely in minutes or hours).
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.status.pellet.autonomy_time;
  };

const getTotalCounters =
  (baseURL: string) =>
  /**
   * Retrieves lifetime operating counters.
   * Includes power-on count and runtime hours per power level.
   * These counters are never reset.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<TotalCountersType>} - Lifetime operating statistics.
   */
  async (jwtToken: string, macAddress: string): Promise<TotalCountersType> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.total_counters;
  };

const getServiceCounters =
  (baseURL: string) =>
  /**
   * Retrieves service counters (runtime since last maintenance).
   * These counters track hours per power level since last service reset.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<ServiceCountersType>} - Service tracking statistics.
   */
  async (
    jwtToken: string,
    macAddress: string,
  ): Promise<ServiceCountersType> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.service_counters;
  };

const getAlarmHistory =
  (baseURL: string) =>
  /**
   * Retrieves the alarm history log.
   * Contains a circular buffer of recent alarms with timestamps.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<AlarmsLogType>} - Alarm history log.
   */
  async (jwtToken: string, macAddress: string): Promise<AlarmsLogType> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.alarms_log;
  };

const getRegenerationData =
  (baseURL: string) =>
  /**
   * Retrieves regeneration and maintenance data.
   * Includes blackout counter and last intervention timestamp.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<RegenerationDataType>} - Maintenance tracking data.
   */
  async (
    jwtToken: string,
    macAddress: string,
  ): Promise<RegenerationDataType> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.regeneration;
  };

const getServiceTime =
  (baseURL: string) =>
  /**
   * Retrieves the total service time in hours.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - Total service hours.
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.status.counters.service_time;
  };

/**
 * Default service threshold in hours (from OEM parameters).
 * Most devices use 2000 hours.
 */
const DEFAULT_SERVICE_THRESHOLD = 2000;

const getTotalOperatingHours =
  (baseURL: string) =>
  /**
   * Calculates total operating hours across all power levels.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - Total operating hours.
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const counters = await getTotalCounters(baseURL)(jwtToken, macAddress);
    return (
      counters.p1_working_time +
      counters.p2_working_time +
      counters.p3_working_time +
      counters.p4_working_time +
      counters.p5_working_time
    );
  };

const getPowerDistribution =
  (baseURL: string) =>
  /**
   * Calculates power level usage distribution as percentages.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<PowerDistributionType>} - Percentage time at each power level.
   */
  async (
    jwtToken: string,
    macAddress: string,
  ): Promise<PowerDistributionType> => {
    const counters = await getTotalCounters(baseURL)(jwtToken, macAddress);
    const total =
      counters.p1_working_time +
      counters.p2_working_time +
      counters.p3_working_time +
      counters.p4_working_time +
      counters.p5_working_time;

    if (total === 0) {
      return { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 };
    }

    return {
      p1: (counters.p1_working_time / total) * 100,
      p2: (counters.p2_working_time / total) * 100,
      p3: (counters.p3_working_time / total) * 100,
      p4: (counters.p4_working_time / total) * 100,
      p5: (counters.p5_working_time / total) * 100,
    };
  };

const getServiceStatus =
  (baseURL: string) =>
  /**
   * Calculates service status including whether maintenance is due.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} [thresholdHours=2000] - Service threshold in hours.
   * @returns {Promise<ServiceStatusType>} - Service status with computed fields.
   */
  async (
    jwtToken: string,
    macAddress: string,
    thresholdHours: number = DEFAULT_SERVICE_THRESHOLD,
  ): Promise<ServiceStatusType> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    const serviceCounters = info.nvm.service_counters;
    const hoursSinceService =
      serviceCounters.p1_working_time +
      serviceCounters.p2_working_time +
      serviceCounters.p3_working_time +
      serviceCounters.p4_working_time +
      serviceCounters.p5_working_time;

    return {
      totalServiceHours: info.status.counters.service_time,
      hoursSinceService,
      serviceThresholdHours: thresholdHours,
      isServiceDue: hoursSinceService >= thresholdHours,
    };
  };

const getUsageAnalytics =
  (baseURL: string) =>
  /**
   * Retrieves comprehensive usage analytics in a single call.
   * Combines multiple statistics into a unified analytics object.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} [serviceThreshold=2000] - Service threshold in hours.
   * @returns {Promise<UsageAnalyticsType>} - Comprehensive usage analytics.
   */
  async (
    jwtToken: string,
    macAddress: string,
    serviceThreshold: number = DEFAULT_SERVICE_THRESHOLD,
  ): Promise<UsageAnalyticsType> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);

    const totalCounters = info.nvm.total_counters;
    const serviceCounters = info.nvm.service_counters;
    const regeneration = info.nvm.regeneration;
    const alarmsLog = info.nvm.alarms_log;

    const totalOperatingHours =
      totalCounters.p1_working_time +
      totalCounters.p2_working_time +
      totalCounters.p3_working_time +
      totalCounters.p4_working_time +
      totalCounters.p5_working_time;

    const hoursSinceService =
      serviceCounters.p1_working_time +
      serviceCounters.p2_working_time +
      serviceCounters.p3_working_time +
      serviceCounters.p4_working_time +
      serviceCounters.p5_working_time;

    const powerDistribution: PowerDistributionType =
      totalOperatingHours === 0
        ? { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 }
        : {
            p1: (totalCounters.p1_working_time / totalOperatingHours) * 100,
            p2: (totalCounters.p2_working_time / totalOperatingHours) * 100,
            p3: (totalCounters.p3_working_time / totalOperatingHours) * 100,
            p4: (totalCounters.p4_working_time / totalOperatingHours) * 100,
            p5: (totalCounters.p5_working_time / totalOperatingHours) * 100,
          };

    return {
      totalPowerOns: totalCounters.power_ons,
      totalOperatingHours,
      powerDistribution,
      serviceStatus: {
        totalServiceHours: info.status.counters.service_time,
        hoursSinceService,
        serviceThresholdHours: serviceThreshold,
        isServiceDue: hoursSinceService >= serviceThreshold,
      },
      blackoutCount: regeneration.blackout_counter,
      lastMaintenanceDate:
        regeneration.last_intervention > 0
          ? new Date(regeneration.last_intervention * 1000)
          : null,
      alarmCount: alarmsLog.number,
    };
  };

const registerDevice =
  (baseURL: string) =>
  /**
   * Registers a device with the user's account.
   * This must be called before other device operations will work on the new API.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device (colons optional).
   * @param {string} serialNumber - The device serial number.
   * @param {string} deviceName - User-friendly name for the device (default: empty string).
   * @param {string} deviceRoom - Room name for the device (default: empty string).
   * @returns {Promise<DeviceAssociationResponse>} - A promise that resolves to the registration response.
   */
  async (
    jwtToken: string,
    macAddress: string,
    serialNumber: string,
    deviceName: string = "",
    deviceRoom: string = "",
  ): Promise<DeviceAssociationResponse> => {
    const body: DeviceAssociationBody = {
      macAddress: macAddress.replace(/:/g, ""),
      deviceName,
      deviceRoom,
      serialNumber,
    };
    return fetchJson<DeviceAssociationResponse>(baseURL, "device", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers(jwtToken),
      },
      body: JSON.stringify(body),
    });
  };

const editDevice =
  (baseURL: string) =>
  /**
   * Updates a device's name and room.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device (colons optional).
   * @param {string} deviceName - New name for the device (default: empty string).
   * @param {string} deviceRoom - New room for the device (default: empty string).
   * @returns {Promise<DeviceAssociationResponse>} - A promise that resolves to the update response.
   */
  async (
    jwtToken: string,
    macAddress: string,
    deviceName: string = "",
    deviceRoom: string = "",
  ): Promise<DeviceAssociationResponse> => {
    const normalizedMac = macAddress.replace(/:/g, "");
    const body: EditDeviceAssociationBody = {
      deviceName,
      deviceRoom,
    };
    return fetchJson<DeviceAssociationResponse>(
      baseURL,
      `device/${normalizedMac}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...headers(jwtToken),
        },
        body: JSON.stringify(body),
      },
    );
  };

/**
 * Configures the library for API interactions.
 * Initializes API methods with a specified base URL.
 *
 * @param {string} [baseURL=API_URL] - The base URL for the API.
 * @returns {object} - An object containing methods for interacting with the API.
 *
 * @example
 * const api = configure();
 * const power = await api.getPower(jwtToken, macAddress);
 */
const configure = (baseURL: string = API_URL) => ({
  deviceInfo: deviceInfo(baseURL),
  registerDevice: registerDevice(baseURL),
  editDevice: editDevice(baseURL),
  setPower: setPower(baseURL),
  setPowerOff: setPowerOff(baseURL),
  setPowerOn: setPowerOn(baseURL),
  getPower: getPower(baseURL),
  setPowerLevel: setPowerLevel(baseURL),
  getPowerLevel: getPowerLevel(baseURL),
  setFanSpeed: setFanSpeed(baseURL),
  getFanSpeed: getFanSpeed(baseURL),
  setFan1Speed: setFan1Speed(baseURL),
  setFan2Speed: setFan2Speed(baseURL),
  setFan3Speed: setFan3Speed(baseURL),
  getFan1Speed: getFan1Speed(baseURL),
  getFan2Speed: getFan2Speed(baseURL),
  getFan3Speed: getFan3Speed(baseURL),
  setAirkare: setAirkare(baseURL),
  setRelax: setRelax(baseURL),
  setStandby: setStandby(baseURL),
  getStandby: getStandby(baseURL),
  setStandbyTime: setStandbyTime(baseURL),
  getStandbyTime: getStandbyTime(baseURL),
  setAuto: setAuto(baseURL),
  getAuto: getAuto(baseURL),
  getEnvironmentTemperature: getEnvironmentTemperature(baseURL),
  getTargetTemperature: getTargetTemperature(baseURL),
  setTargetTemperature: setTargetTemperature(baseURL),
  setEnvironment1Temperature: setEnvironment1Temperature(baseURL),
  getEnvironment1Temperature: getEnvironment1Temperature(baseURL),
  setEnvironment2Temperature: setEnvironment2Temperature(baseURL),
  getEnvironment2Temperature: getEnvironment2Temperature(baseURL),
  setEnvironment3Temperature: setEnvironment3Temperature(baseURL),
  getEnvironment3Temperature: getEnvironment3Temperature(baseURL),
  setMeasureUnit: setMeasureUnit(baseURL),
  getMeasureUnit: getMeasureUnit(baseURL),
  setLanguage: setLanguage(baseURL),
  getLanguage: getLanguage(baseURL),
  getPelletInReserve: getPelletInReserve(baseURL),
  getPelletAutonomyTime: getPelletAutonomyTime(baseURL),
  // Statistics getters
  getTotalCounters: getTotalCounters(baseURL),
  getServiceCounters: getServiceCounters(baseURL),
  getAlarmHistory: getAlarmHistory(baseURL),
  getRegenerationData: getRegenerationData(baseURL),
  getServiceTime: getServiceTime(baseURL),
  // Analytics functions
  getTotalOperatingHours: getTotalOperatingHours(baseURL),
  getPowerDistribution: getPowerDistribution(baseURL),
  getServiceStatus: getServiceStatus(baseURL),
  getUsageAnalytics: getUsageAnalytics(baseURL),
});

export {
  configure,
  configureAmplify,
  createAuthService,
  getSession,
  headers,
  signIn,
};
