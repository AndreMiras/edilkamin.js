interface CommandsType {
  power: boolean;
}

interface StatusType {
  commands: CommandsType;
}

interface DeviceInfoType {
  status: StatusType;
}

export type { DeviceInfoType };
