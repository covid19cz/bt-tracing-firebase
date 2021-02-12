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

function calculateRssi(rssi: number, device: DeviceDetails): number {
    const manufacturer = device.manufacturer.toLowerCase();
    const model = device.model.toLowerCase();
    const os = device.platform.toLowerCase();
    if (manufacturer === "apple" || os === "ios") {
        return rssi - 7;
    }
    if (manufacturer === "huawei" && model.includes("y6")) {
        return rssi + 10.5;
    }
    if (manufacturer === "samsung" && model.includes("s8")) {
        return rssi + 8;
    }

    return rssi;
}

export function normalizeRssi(rssi: string, device: DeviceDetails): string {
    if (rssi === undefined || rssi === "") return "";

    const value = Number.parseInt(rssi, 10);
    return calculateRssi(value, device).toString();
}
