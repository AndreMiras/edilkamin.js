import { strict as assert } from "assert";
import { Amplify } from "aws-amplify";
import * as amplifyAuth from "aws-amplify/auth";
import axios, { AxiosInstance } from "axios";

import { processResponse } from "./buffer-utils";
import { API_URL } from "./constants";
import { DeviceInfoRawType, DeviceInfoType } from "./types";

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

/**
 * Configures Amplify if not already configured.
 * Ensures the configuration is only applied once.
 */
const configureAmplify = () => {
  const currentConfig = Amplify.getConfig();
  if (Object.keys(currentConfig).length !== 0) return;
  Amplify.configure(amplifyconfiguration);
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
    legacy: boolean = false
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
  return { signIn };
};

// Create the default auth service using amplifyAuth
const { signIn } = createAuthService(amplifyAuth);

const deviceInfo =
  (axiosInstance: AxiosInstance) =>
  /**
   * Retrieves information about a device by its MAC address.
   * Automatically decompresses any gzip-compressed Buffer fields in the response.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<DeviceInfoType>} - A promise that resolves to the device info.
   */
  async (jwtToken: string, macAddress: string): Promise<DeviceInfoType> => {
    const response = await axiosInstance.get<DeviceInfoRawType>(
      `device/${macAddress}/info`,
      {
        headers: headers(jwtToken),
      }
    );
    // Process response to decompress any gzipped Buffer fields
    return processResponse(response.data) as DeviceInfoType;
  };

const mqttCommand =
  (axiosInstance: AxiosInstance) =>
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  (jwtToken: string, macAddress: string, payload: any) =>
    axiosInstance.put(
      "mqtt/command",
      { mac_address: macAddress, ...payload },
      { headers: headers(jwtToken) }
    );

const setPower =
  (axiosInstance: AxiosInstance) =>
  /**
   * Sends a command to set the power state of a device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} value - The desired power state (1 for ON, 0 for OFF).
   * @returns {Promise<string>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, value: number) =>
    mqttCommand(axiosInstance)(jwtToken, macAddress, { name: "power", value });

const setPowerOn =
  (axiosInstance: AxiosInstance) =>
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
    setPower(axiosInstance)(jwtToken, macAddress, 1);

const setPowerOff =
  (axiosInstance: AxiosInstance) =>
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
    setPower(axiosInstance)(jwtToken, macAddress, 0);

const getPower =
  (axiosInstance: AxiosInstance) =>
  /**
   * Retrieves the power status of the device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<boolean>} - A promise that resolves to the power status.
   */
  async (jwtToken: string, macAddress: string): Promise<boolean> => {
    const info = await deviceInfo(axiosInstance)(jwtToken, macAddress);
    return info.status.commands.power;
  };

const getEnvironmentTemperature =
  (axiosInstance: AxiosInstance) =>
  /**
   * Retrieves the environment temperature from the device's sensors.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - A promise that resolves to the temperature value.
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(axiosInstance)(jwtToken, macAddress);
    return info.status.temperatures.enviroment;
  };

const getTargetTemperature =
  (axiosInstance: AxiosInstance) =>
  /**
   * Retrieves the target temperature value set on the device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @returns {Promise<number>} - A promise that resolves to the target temperature (degree celsius).
   */
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(axiosInstance)(jwtToken, macAddress);
    return info.nvm.user_parameters.enviroment_1_temperature;
  };

const setTargetTemperature =
  (axiosInstance: AxiosInstance) =>
  /**
   * Sends a command to set the target temperature (degree celsius) of a device.
   *
   * @param {string} jwtToken - The JWT token for authentication.
   * @param {string} macAddress - The MAC address of the device.
   * @param {number} temperature - The desired target temperature (degree celsius).
   * @returns {Promise<string>} - A promise that resolves to the command response.
   */
  (jwtToken: string, macAddress: string, temperature: number) =>
    mqttCommand(axiosInstance)(jwtToken, macAddress, {
      name: "enviroment_1_temperature",
      value: temperature,
    });

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
const configure = (baseURL: string = API_URL) => {
  const axiosInstance = axios.create({ baseURL });
  const deviceInfoInstance = deviceInfo(axiosInstance);
  const setPowerInstance = setPower(axiosInstance);
  const setPowerOffInstance = setPowerOff(axiosInstance);
  const setPowerOnInstance = setPowerOn(axiosInstance);
  const getPowerInstance = getPower(axiosInstance);
  const getEnvironmentTemperatureInstance =
    getEnvironmentTemperature(axiosInstance);
  const getTargetTemperatureInstance = getTargetTemperature(axiosInstance);
  const setTargetTemperatureInstance = setTargetTemperature(axiosInstance);
  return {
    deviceInfo: deviceInfoInstance,
    setPower: setPowerInstance,
    setPowerOff: setPowerOffInstance,
    setPowerOn: setPowerOnInstance,
    getPower: getPowerInstance,
    getEnvironmentTemperature: getEnvironmentTemperatureInstance,
    getTargetTemperature: getTargetTemperatureInstance,
    setTargetTemperature: setTargetTemperatureInstance,
  };
};

export { configure, createAuthService, headers, signIn };
