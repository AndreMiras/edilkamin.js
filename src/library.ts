import { strict as assert } from "assert";
import { Amplify } from "aws-amplify";
import * as amplifyAuth from "aws-amplify/auth";
import axios, { AxiosInstance } from "axios";
import { DeviceInfoType } from "./types";
import { API_URL } from "./constants";

const amplifyconfiguration = {
  aws_project_region: "eu-central-1",
  aws_user_pools_id: "eu-central-1_BYmQ2VBlo",
  aws_user_pools_web_client_id: "7sc1qltkqobo3ddqsk4542dg2h",
};
Amplify.configure(amplifyconfiguration);

const headers = (jwtToken: string) => ({ Authorization: `Bearer ${jwtToken}` });

/**
 * Sign in to return the JWT token.
 */
const signIn = async (username: string, password: string): Promise<string> => {
  const { isSignedIn, nextStep } = await amplifyAuth.signIn({
    username,
    password,
  });
  assert.ok(isSignedIn);
  const { tokens } = await amplifyAuth.fetchAuthSession();
  assert.ok(tokens);
  return tokens.accessToken.toString();
};

const deviceInfo =
  (axiosInstance: AxiosInstance) => (jwtToken: string, macAddress: string) =>
    axiosInstance.get<DeviceInfoType>(`device/${macAddress}/info`, {
      headers: headers(jwtToken),
    });

const mqttCommand =
  (axiosInstance: AxiosInstance) =>
  (jwtToken: string, macAddress: string, payload: any) =>
    axiosInstance.put(
      "mqtt/command",
      { mac_address: macAddress, ...payload },
      { headers: headers(jwtToken) }
    );

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

const configure = (baseURL: string = API_URL) => {
  const axiosInstance = axios.create({ baseURL });
  const deviceInfoInstance = deviceInfo(axiosInstance);
  const setPowerInstance = setPower(axiosInstance);
  const setPowerOffInstance = setPowerOff(axiosInstance);
  const setPowerOnInstance = setPowerOn(axiosInstance);
  return {
    deviceInfo: deviceInfoInstance,
    setPower: setPowerInstance,
    setPowerOff: setPowerOffInstance,
    setPowerOn: setPowerOnInstance,
  };
};

const defaultApi = configure();

export { signIn, configure };