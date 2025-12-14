import { strict as assert } from "assert";
import { Amplify } from "aws-amplify";
import * as amplifyAuth from "aws-amplify/auth";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";

import { processResponse } from "./buffer-utils";
import { API_URL } from "./constants";
import {
  DeviceAssociationBody,
  DeviceAssociationResponse,
  DeviceInfoRawType,
  DeviceInfoType,
  EditDeviceAssociationBody,
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
   * Retrieves the target temperature value set on the device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - A promise that resolves to the target temperature (degree celsius).
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(baseURL)(jwtToken, macAddress);
    return info.nvm.user_parameters.enviroment_1_temperature;
  };

const setTargetTemperature =
  (baseURL: string) =>
  /**
   * Sends a command to set the target temperature (degree celsius) of a device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} temperature - The desired target temperature (degree celsius).
   * @returns {Promise<string>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, temperature: number) =>
    mqttCommand(baseURL)(jwtToken, macAddress, {
      name: "enviroment_1_temperature",
      value: temperature,
    });

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
  getEnvironmentTemperature: getEnvironmentTemperature(baseURL),
  getTargetTemperature: getTargetTemperature(baseURL),
  setTargetTemperature: setTargetTemperature(baseURL),
});

export {
  configure,
  configureAmplify,
  createAuthService,
  getSession,
  headers,
  signIn,
};
