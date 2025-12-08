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

interface StatusType {
  commands: CommandsType;
  temperatures: TemperaturesType;
}

interface UserParametersType {
  enviroment_1_temperature: number;
  enviroment_2_temperature: number;
  enviroment_3_temperature: number;
  is_auto: boolean;
  is_sound_active: boolean;
}

interface DeviceInfoType {
  status: StatusType;
  nvm: {
    user_parameters: UserParametersType;
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

export type {
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
};
