import {configure} from './library';

export {API_URL} from './constants';

export {
    CommandsType,
    DeviceInfoType,
    StatusType,
    TemperaturesType,
    UserParametersType,
} from './types';

export {signIn, configure} from './library';

export const {deviceInfo, setPower, setPowerOff, setPowerOn} = configure();
