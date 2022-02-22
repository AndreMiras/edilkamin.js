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

export type {
  CommandsType,
  DeviceInfoType,
  StatusType,
  TemperaturesType,
  UserParametersType,
};
