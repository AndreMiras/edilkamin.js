import { strict as assert } from "assert";
import { Amplify } from "aws-amplify";
import * as amplifyAuth from "aws-amplify/auth";
import axios, { AxiosInstance } from "axios";

import { API_URL } from "./constants";
import { DeviceInfoType } from "./types";

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
   * @returns {Promise<string>} - The JWT token of the signed-in user.
   * @throws {Error} - If sign-in fails or no tokens are retrieved.
   */
  const signIn = async (
    username: string,
    password: string
  ): Promise<string> => {
    configureAmplify();
    await auth.signOut(); // Ensure the user is signed out first
    const { isSignedIn } = await auth.signIn({ username, password });
    assert.ok(isSignedIn, "Sign-in failed");
    const { tokens } = await auth.fetchAuthSession();
    assert.ok(tokens, "No tokens found");
    return tokens.accessToken.toString();
  };
  return { signIn };
};

// Create the default auth service using amplifyAuth
const { signIn } = createAuthService(amplifyAuth);

const deviceInfo =
  (axiosInstance: AxiosInstance) =>
  async (jwtToken: string, macAddress: string) => {
    const response = await axiosInstance.get<DeviceInfoType>(
      `device/${macAddress}/info`,
      {
        headers: headers(jwtToken),
      }
    );
    return response.data;
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

/**
 * Set device power.
 * Return response string e.g. "Command 0123456789abcdef executed successfully".
 */
const setPower =
  (axiosInstance: AxiosInstance) =>
  (jwtToken: string, macAddress: string, value: number) =>
    mqttCommand(axiosInstance)(jwtToken, macAddress, { name: "power", value });

const setPowerOn =
  (axiosInstance: AxiosInstance) => (jwtToken: string, macAddress: string) =>
    setPower(axiosInstance)(jwtToken, macAddress, 1);

const setPowerOff =
  (axiosInstance: AxiosInstance) => (jwtToken: string, macAddress: string) =>
    setPower(axiosInstance)(jwtToken, macAddress, 0);

/**
 * Get device current power value.
 */
const getPower =
  (axiosInstance: AxiosInstance) =>
  async (jwtToken: string, macAddress: string): Promise<boolean> => {
    const info = await deviceInfo(axiosInstance)(jwtToken, macAddress);
    return info.status.commands.power;
  };

/**
 * Get the environment temperature coming from sensors.
 */
const getEnvironmentTemperature =
  (axiosInstance: AxiosInstance) =>
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(axiosInstance)(jwtToken, macAddress);
    return info.status.temperatures.enviroment;
  };

/**
 * Get target temperature value.
 */
const getTargetTemperature =
  (axiosInstance: AxiosInstance) =>
  async (jwtToken: string, macAddress: string): Promise<number> => {
    const info = await deviceInfo(axiosInstance)(jwtToken, macAddress);
    return info.nvm.user_parameters.enviroment_1_temperature;
  };

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
  return {
    deviceInfo: deviceInfoInstance,
    setPower: setPowerInstance,
    setPowerOff: setPowerOffInstance,
    setPowerOn: setPowerOnInstance,
    getPower: getPowerInstance,
    getEnvironmentTemperature: getEnvironmentTemperatureInstance,
    getTargetTemperature: getTargetTemperatureInstance,
  };
};

export { configure, createAuthService, headers, signIn };
