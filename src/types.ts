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

interface ComponentInfoType {
    board_name: string;
    application_name: string;
    bootloader_version: string;
    serial_number: string;
    compatibility: number;
    bootloader_name: string;
    application_version: string;
}

interface ComponentInfosType {
    temp_umidity_voc_probe_3: ComponentInfoType,
    remote_user_panel_1: ComponentInfoType,
    remote_user_panel_3: ComponentInfoType,
    expansion_board: ComponentInfoType,
    remote_user_panel_2: ComponentInfoType,
    motherboard: ComponentInfoType,
    radio_control: ComponentInfoType,
    wifi_ble_module: ComponentInfoType,
    general: ComponentInfoType,
    idro_panel: ComponentInfoType,
    emergency_panel: ComponentInfoType,
    temp_umidity_voc_probe_2: ComponentInfoType,
    timestamp: number,
    temp_umidity_voc_probe_1: ComponentInfoType
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
    component_info: ComponentInfosType;
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
