import { configure } from "./library";

export { API_URL } from "./constants";
export { configure, signIn } from "./library";
export {
  CommandsType,
  DeviceInfoType,
  StatusType,
  TemperaturesType,
  UserParametersType,
} from "./types";

export const {
  deviceInfo,
  setPower,
  setPowerOff,
  setPowerOn,
  getPower,
  getEnvironmentTemperature,
  getTargetTemperature,
  setTargetTemperature,
} = configure();
