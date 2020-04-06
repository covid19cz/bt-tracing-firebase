export interface ProximityRecord {
    tuid: string;

    [key: string]: string;
}

export interface PhoneProximityData {
    phone: string;
    devices: { [key: string]: DeviceProximityData };
    metTuids: Set<string>;
}

export type DeviceProximityData = ProximityRecord[];

export interface DeviceMap {
    buidToDevice: {[key: string]: DeviceDetails},
    tuidToPhone: {[key: string]: string}
}

export interface DeviceDetails {
    manufacturer: string;
    model: string;
    platform: string;
    platformVersion: string;
}

export interface ProximityFile {
    stream: NodeJS.ReadableStream,
    updatedAt: Date
}
