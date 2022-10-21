import { ok } from "assert";
import { Amplify, Auth } from "aws-amplify";
import axios, { AxiosInstance } from "axios";
import { DeviceInfoType } from "./types";
import { API_URL } from "./constants";

const amplifyconfiguration = {
  Auth: {
    region: "eu-central-1",
    userPoolId: "eu-central-1_BYmQ2VBlo",
    userPoolWebClientId: "7sc1qltkqobo3ddqsk4542dg2h",
  },
};
Amplify.configure(amplifyconfiguration);

const headers = (jwtToken: string) => ({ Authorization: `Bearer ${jwtToken}` });

/**
 * Sign in to return the JWT token.
 */
const signIn = async (username: string, password: string): Promise<string> => {
  const user = await Auth.signIn(username, password);
  return user.getSignInUserSession().getAccessToken().jwtToken;
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

const main = async () => {
  const { USERNAME, PASSWORD, MAC_ADDRESS } = process.env;
  ok(USERNAME);
  ok(PASSWORD);
  ok(MAC_ADDRESS);
  const jwtToken = await signIn(USERNAME, PASSWORD);
  const info = await defaultApi.deviceInfo(jwtToken, MAC_ADDRESS);
  console.log({ info });
};

export { signIn, configure };
