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

export type {
  BufferEncodedType,
  CommandsType,
  DeviceInfoRawType,
  DeviceInfoType,
  StatusType,
  TemperaturesType,
  UserParametersType,
};
