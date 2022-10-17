import { ok } from "assert";
import { Amplify, Auth } from "aws-amplify";

import axios from "./axios";
import { DeviceInfoType } from "./types";

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

const deviceInfo = (jwtToken: string, macAddress: string) =>
  axios.get<DeviceInfoType>(`device/${macAddress}/info`, {
    headers: headers(jwtToken),
  });

const mqttCommand = (jwtToken: string, macAddress: string, payload: any) =>
  axios.put(
    `mqtt/command`,
    { mac_address: macAddress, ...payload },
    { headers: headers(jwtToken) }
  );

const setPower = (jwtToken: string, macAddress: string, value: number) =>
  mqttCommand(jwtToken, macAddress, { name: "power", value });

const setPowerOn = (jwtToken: string, macAddress: string) =>
  setPower(jwtToken, macAddress, 1);
const setPowerOff = (jwtToken: string, macAddress: string) =>
  setPower(jwtToken, macAddress, 0);

const main = async () => {
  const { USERNAME, PASSWORD, MAC_ADDRESS } = process.env;
  ok(USERNAME);
  ok(PASSWORD);
  ok(MAC_ADDRESS);
  const jwtToken = await signIn(USERNAME, PASSWORD);
  const info = await deviceInfo(jwtToken, MAC_ADDRESS);
  console.log({ info });
};

export { signIn, main, deviceInfo, setPower, setPowerOff, setPowerOn };
