import { configure } from "./library";

export { bleToWifiMac } from "./bluetooth-utils";
export { decompressBuffer, isBuffer, processResponse } from "./buffer-utils";
export { API_URL, NEW_API_URL, OLD_API_URL } from "./constants";
export {
  configure,
  deriveAirkare,
  deriveAlarmHistory,
  deriveChronoMode,
  deriveContinueCochleaLoading,
  deriveEasyTimer,
  derivePhaseDescription,
  deriveRelax,
  deriveUsageAnalytics,
  getPhaseDescription,
  getSession,
  signIn,
} from "./library";
export { normalizeMac } from "./mac-utils";
export {
  serialNumberDisplay,
  serialNumberFromHex,
  serialNumberToHex,
} from "./serial-utils";
export {
  AlarmEntryType,
  AlarmsLogType,
  BufferEncodedType,
  CommandsType,
  ComponentInfoType,
  ComponentType,
  DeviceAssociationBody,
  DeviceAssociationResponse,
  DeviceInfoRawType,
  DeviceInfoType,
  DiscoveredDevice,
  EasyTimerStateType,
  EasyTimerType,
  EditDeviceAssociationBody,
  FansType,
  PowerDistributionType,
  RegenerationDataType,
  ServiceCountersType,
  ServiceStatusType,
  StateType,
  StatusCountersType,
  StatusType,
  TemperaturesType,
  TotalCountersType,
  UsageAnalyticsType,
  UserParametersType,
} from "./types";
export {
  AlarmCode,
  AlarmDescriptions,
  getIgnitionSubPhaseDescription,
  getOperationalPhaseDescription,
  getStoveStateDescription,
  IgnitionSubPhase,
  IgnitionSubPhaseDescriptions,
  OperationalPhase,
  OperationalPhaseDescriptions,
  StoveState,
  StoveStateDescriptions,
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
