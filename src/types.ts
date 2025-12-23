/**
 * Represents a Node.js Buffer object serialized to JSON.
 * This format is used by the Edilkamin API for gzip-compressed fields.
 */
interface BufferEncodedType {
  type: "Buffer";
  data: number[];
}

interface CommandsType {
  power: boolean;
}

interface TemperaturesType {
  board: number;
  enviroment: number;
}

interface GeneralFlagsType {
  is_pellet_in_reserve: boolean;
}

interface PelletAutonomyType {
  autonomy_time: number;
}

/**
 * Status counters including service time.
 */
interface StatusCountersType {
  service_time: number;
}

interface StatusType {
  commands: CommandsType;
  temperatures: TemperaturesType;
  flags: GeneralFlagsType;
  pellet: PelletAutonomyType;
  counters: StatusCountersType;
}

interface UserParametersType {
  enviroment_1_temperature: number;
  enviroment_2_temperature: number;
  enviroment_3_temperature: number;
  is_auto: boolean;
  is_sound_active: boolean;
  manual_power: number;
  fan_1_ventilation: number;
  fan_2_ventilation: number;
  fan_3_ventilation: number;
  is_standby_active: boolean;
  standby_waiting_time: number;
  is_fahrenheit: boolean;
  language: number;
}

/**
 * Lifetime operating counters - never reset.
 * Tracks total power-on cycles and runtime hours per power level.
 */
interface TotalCountersType {
  power_ons: number;
  p1_working_time: number;
  p2_working_time: number;
  p3_working_time: number;
  p4_working_time: number;
  p5_working_time: number;
}

/**
 * Service counters - reset after maintenance.
 * Tracks runtime hours per power level since last service.
 */
interface ServiceCountersType {
  p1_working_time: number;
  p2_working_time: number;
  p3_working_time: number;
  p4_working_time: number;
  p5_working_time: number;
}

/**
 * Individual alarm entry from the alarm history log.
 */
interface AlarmEntryType {
  type: number;
  timestamp: number;
}

/**
 * Alarm history log - circular buffer of recent alarms.
 */
interface AlarmsLogType {
  number: number;
  index: number;
  alarms: AlarmEntryType[];
}

/**
 * Regeneration and maintenance tracking data.
 */
interface RegenerationDataType {
  time: number;
  last_intervention: number;
  daylight_time_flag: number;
  blackout_counter: number;
  airkare_working_hours_counter: number;
}

/**
 * Power level distribution as percentages.
 */
interface PowerDistributionType {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
}

/**
 * Service status with computed fields.
 */
interface ServiceStatusType {
  totalServiceHours: number;
  hoursSinceService: number;
  serviceThresholdHours: number;
  isServiceDue: boolean;
}

/**
 * Comprehensive usage analytics.
 */
interface UsageAnalyticsType {
  totalPowerOns: number;
  totalOperatingHours: number;
  powerDistribution: PowerDistributionType;
  serviceStatus: ServiceStatusType;
  blackoutCount: number;
  lastMaintenanceDate: Date | null;
  alarmCount: number;
}

/**
 * Alarm type codes from Edilkamin devices.
 * Based on AlarmsEnum.java from Android app (version 1.3.1-RC2 released 2025/12/10).
 */
enum AlarmCode {
  NONE = 0,
  FLUE_BLOCK = 1,
  SMOKE_EXTRACTOR_FAILURE = 2,
  END_PELLET = 3,
  MISSING_LIGHTING = 4,
  NO_NAME_ALARM = 5,
  SMOKE_PROBE_FAILURE = 6,
  FUMES_OVERTEMPERATURE = 7,
  PELLET_TANK_SAFETY_THERMOSTAT = 8,
  GEAR_MOTOR_FAILURE = 9,
  BOARD_OVER_TEMPERATURE = 10,
  SAFETY_PRESSURE_SWITCH_INTERVENTION = 11,
  ROOM_PROBE_FAILURE = 12,
  ROOM_PROBE_2_OR_BOILER_PROBE_FAILURE = 13,
  ROOM_PROBE_3_OR_BOILER_PROBE_FAILURE = 14,
  WATER_EARTHQUAKE_SAFETY_THERMOSTAT_INTERVENTION = 15,
  WATER_PRESSURE_TRANSDUCER_FAILURE = 16,
  OUTSIDE_PROBE_OR_LOW_STORAGE_PROBE_FAILURE = 17,
  PUFFER_PROBE_FAILURE = 18,
  CRUCIBLE_CLEANING_FAILURE = 19,
  TRIAC_FAILURE = 20,
  BLACKOUT = 21,
  OPEN_DOOR = 22,
  OVERTEMPERATURE_PANEL = 23,
  BOARD_FUSE = 24,
}

/**
 * Human-readable descriptions for alarm codes.
 */
const AlarmDescriptions: Record<AlarmCode, string> = {
  [AlarmCode.NONE]: "No alarm",
  [AlarmCode.FLUE_BLOCK]: "Flue/chimney blockage",
  [AlarmCode.SMOKE_EXTRACTOR_FAILURE]: "Smoke extractor motor failure",
  [AlarmCode.END_PELLET]: "Pellet tank empty",
  [AlarmCode.MISSING_LIGHTING]: "Ignition failure",
  [AlarmCode.NO_NAME_ALARM]: "Unnamed alarm",
  [AlarmCode.SMOKE_PROBE_FAILURE]: "Smoke temperature probe failure",
  [AlarmCode.FUMES_OVERTEMPERATURE]: "Exhaust overtemperature",
  [AlarmCode.PELLET_TANK_SAFETY_THERMOSTAT]:
    "Pellet tank safety thermostat triggered",
  [AlarmCode.GEAR_MOTOR_FAILURE]: "Gear motor/auger failure",
  [AlarmCode.BOARD_OVER_TEMPERATURE]: "Control board overtemperature",
  [AlarmCode.SAFETY_PRESSURE_SWITCH_INTERVENTION]:
    "Safety pressure switch activated",
  [AlarmCode.ROOM_PROBE_FAILURE]: "Room temperature probe failure",
  [AlarmCode.ROOM_PROBE_2_OR_BOILER_PROBE_FAILURE]:
    "Room probe 2 or boiler probe failure",
  [AlarmCode.ROOM_PROBE_3_OR_BOILER_PROBE_FAILURE]:
    "Room probe 3 or boiler probe failure",
  [AlarmCode.WATER_EARTHQUAKE_SAFETY_THERMOSTAT_INTERVENTION]:
    "Water/earthquake safety thermostat",
  [AlarmCode.WATER_PRESSURE_TRANSDUCER_FAILURE]:
    "Water pressure transducer failure",
  [AlarmCode.OUTSIDE_PROBE_OR_LOW_STORAGE_PROBE_FAILURE]:
    "Outside probe or low storage probe failure",
  [AlarmCode.PUFFER_PROBE_FAILURE]: "Buffer tank probe failure",
  [AlarmCode.CRUCIBLE_CLEANING_FAILURE]: "Crucible cleaning failure",
  [AlarmCode.TRIAC_FAILURE]: "Power control (TRIAC) failure",
  [AlarmCode.BLACKOUT]: "Power outage detected",
  [AlarmCode.OPEN_DOOR]: "Door open alarm",
  [AlarmCode.OVERTEMPERATURE_PANEL]: "Panel overtemperature",
  [AlarmCode.BOARD_FUSE]: "Control board fuse issue",
};

interface DeviceInfoType {
  status: StatusType;
  nvm: {
    user_parameters: UserParametersType;
    total_counters: TotalCountersType;
    service_counters: ServiceCountersType;
    alarms_log: AlarmsLogType;
    regeneration: RegenerationDataType;
  };
}

/**
 * Raw device info response that may contain Buffer-encoded compressed fields.
 * Used internally before processing; external callers receive DeviceInfoType.
 */
interface DeviceInfoRawType {
  status: StatusType | BufferEncodedType;
  nvm:
    | {
        user_parameters: UserParametersType;
      }
    | BufferEncodedType;
  component_info?: BufferEncodedType | Record<string, unknown>;
}

/**
 * Request body for registering a device with a user account.
 * All fields are required by the API.
 */
interface DeviceAssociationBody {
  macAddress: string;
  deviceName: string;
  deviceRoom: string;
  serialNumber: string;
}

/**
 * Request body for editing a device's name and room.
 * MAC address is specified in the URL path, not the body.
 * Serial number cannot be changed after registration.
 */
interface EditDeviceAssociationBody {
  deviceName: string;
  deviceRoom: string;
}

/**
 * Response from device registration endpoint.
 * Structure based on Android app behavior - may need adjustment after testing.
 */
interface DeviceAssociationResponse {
  macAddress: string;
  deviceName: string;
  deviceRoom: string;
  serialNumber: string;
}

/**
 * Represents a discovered Edilkamin device from Bluetooth scanning.
 */
interface DiscoveredDevice {
  /** BLE MAC address as discovered */
  bleMac: string;
  /** WiFi MAC address (BLE MAC - 2), used for API calls */
  wifiMac: string;
  /** Device name (typically "EDILKAMIN_EP") */
  name: string;
  /** Signal strength in dBm (optional, not all platforms provide this) */
  rssi?: number;
}

export type {
  AlarmEntryType,
  AlarmsLogType,
  BufferEncodedType,
  CommandsType,
  DeviceAssociationBody,
  DeviceAssociationResponse,
  DeviceInfoRawType,
  DeviceInfoType,
  DiscoveredDevice,
  EditDeviceAssociationBody,
  GeneralFlagsType,
  PelletAutonomyType,
  PowerDistributionType,
  RegenerationDataType,
  ServiceCountersType,
  ServiceStatusType,
  StatusCountersType,
  StatusType,
  TemperaturesType,
  TotalCountersType,
  UsageAnalyticsType,
  UserParametersType,
};

export { AlarmCode, AlarmDescriptions };
