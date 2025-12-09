import { configure } from "./library";

export { decompressBuffer, isBuffer, processResponse } from "./buffer-utils";
export { API_URL, NEW_API_URL, OLD_API_URL } from "./constants";
export { configure, getSession, signIn } from "./library";
export {
  serialNumberDisplay,
  serialNumberFromHex,
  serialNumberToHex,
} from "./serial-utils";
export { clearSession } from "./token-storage";
export {
  BufferEncodedType,
  CommandsType,
  DeviceAssociationBody,
  DeviceAssociationResponse,
  DeviceInfoRawType,
  DeviceInfoType,
  EditDeviceAssociationBody,
  StatusType,
  TemperaturesType,
  UserParametersType,
} from "./types";

export const {
  deviceInfo,
  registerDevice,
  editDevice,
  setPower,
  setPowerOff,
  setPowerOn,
  getPower,
  getEnvironmentTemperature,
  getTargetTemperature,
  setTargetTemperature,
} = configure();
