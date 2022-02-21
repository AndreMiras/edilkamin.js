import { ok } from "assert";
import axios from "axios";
import { Amplify, Auth } from "aws-amplify";
import { API_URL } from "./constants";

const amplifyconfiguration = {
  Auth: {
    region: "eu-central-1",
    userPoolId: "eu-central-1_BYmQ2VBlo",
    userPoolWebClientId: "7sc1qltkqobo3ddqsk4542dg2h",
  },
};
Amplify.configure(amplifyconfiguration);

const signIn = async (username: string, password: string) => {
  try {
    const user = await Auth.signIn(username, password);
    console.log("user:", user);
  } catch (error) {
    console.log("error signing in", error);
  }
};

const deviceInfo = (macAddress: string) =>
  axios.get(`${API_URL}device/${macAddress}/info`);

const main = () => {
  const { USERNAME, PASSWORD } = process.env;
  ok(USERNAME);
  ok(PASSWORD);
  signIn(USERNAME, PASSWORD);
};

export { main, deviceInfo };
