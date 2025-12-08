import { configure } from "./library";

export { decompressBuffer, isBuffer, processResponse } from "./buffer-utils";
export { API_URL, NEW_API_URL, OLD_API_URL } from "./constants";
export { configure, signIn } from "./library";
export {
  BufferEncodedType,
  CommandsType,
  DeviceInfoRawType,
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
