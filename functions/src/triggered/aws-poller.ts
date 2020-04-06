import {S3} from "aws-sdk";
import {
    AWS_PHONE_CSV_PATH,
    buildCloudFunction,
    loadAwsReadBucket,
    loadAwsWriteBucket
} from "../settings";
import {format, parseStream, parseString} from "fast-csv";
import {DeviceMap, PhoneProximityData, ProximityFile, ProximityRecord} from "../lib/proximity";
import {AWSBucket} from "../lib/aws";
import {FIRESTORE_CLIENT, getFuidFromPhone, getPhoneFromFuid} from "../lib/database";
import {STORAGE_CLIENT} from "../lib/storage";

async function getFileIfExists(bucket: AWSBucket, file: string, headOnly: boolean = false): Promise<S3.Types.GetObjectOutput | null> {
    try {
        const params = {
            ...bucket.key(file)
        };
        if (headOnly) {
            return await bucket.s3.headObject(params).promise();
        } else {
            return await bucket.s3.getObject(params).promise();
        }
    } catch (e) {
        if ("statusCode" in e && e.statusCode === 404) {
            return null;
        }
        throw e;
    }
}

function parsePhoneCSVRecords(stream: NodeJS.ReadableStream): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const phones: string[] = [];
        stream
            .on('error', error => reject(error))
            .on('data', row => phones.push(`+${row["msisdn"]}`))
            .on('end', () => resolve(phones));
    });
}

async function getPhoneNumbers(bucket: AWSBucket, path: string): Promise<string[]> {
    const file = await getFileIfExists(bucket, path);
    if (file === null) return [];

    const buffer = (file.Body as Buffer);
    const stream = parseString(buffer.toString("utf-8"), {headers: true});
    try {
        return await parsePhoneCSVRecords(stream);
    } catch (e) {
        console.error(`Error while parsing CSV phone numbers: ${e}`);
        return [];
    }
}

async function getProximityRecord(fuid: string, buid: string): Promise<ProximityFile | null> {
    const bucket = STORAGE_CLIENT.bucket();
    const files = (await bucket.getFiles({
        prefix: `proximity/${fuid}/${buid}/`,
        delimiter: "/",
        maxResults: 50
    }))[0];
    if (files.length === 0) return null;

    // sort by newest file first (based on UNIX timestamp filename)
    files.sort((a, b) => b.name.localeCompare(a.name));

    return {
        stream: files[0].createReadStream(),
        updatedAt: new Date(files[0].metadata.updated)
    };
}

function parseBuidCSVRecords(stream: NodeJS.ReadableStream, metTuids: Set<string>): Promise<ProximityRecord[]> {
    return new Promise((resolve, reject) => {
        const encounters: ProximityRecord[] = [];
        stream
            .on('error', error => reject(error))
            .on('data', row => {
                const tuid = row["tuid"];
                if (tuid !== undefined) {
                    metTuids.add(tuid);
                    encounters.push(row);
                }
            })
            .on('end', () => resolve(encounters));
    });
}

async function getOutputCSVUpdateTime(phone: string, bucket: AWSBucket): Promise<Date | null> {
    const path = outputCSVFilePath(phone);
    const file = await getFileIfExists(bucket, path, true);
    return file?.LastModified ?? null;
}

function needsNewUpload(lastUploadTime: Date | null, recordTimes: (Date | null)[]): boolean {
    const validDates = recordTimes.filter(date => date !== null) as Date[];
    if (validDates.length === 0) {
        return false;
    }
    return (lastUploadTime === null) || lastUploadTime < new Date(Math.max.apply(null, validDates as unknown as number[]));
}

async function getPhoneRecords(phone: string, bucket: AWSBucket): Promise<PhoneProximityData | null> {
    const result: PhoneProximityData = {
        phone,
        devices: {},
        metTuids: new Set()
    };

    const fuid = await getFuidFromPhone(phone);
    if (fuid === null) return null;

    const registrations = FIRESTORE_CLIENT.collection("registrations");
    const query = await registrations.where("fuid", "==", fuid).get();
    const buids = await Promise.all(query.docs.map(async doc => ({
        buid: doc.id,
        file: await getProximityRecord(fuid, doc.id)
    })));

    const lastUploadTime = await getOutputCSVUpdateTime(phone, bucket);
    if (!needsNewUpload(lastUploadTime, buids.map(record => record.file?.updatedAt ?? null))) {
        console.log(`Skipping uploading ${fuid} (last upload at ${lastUploadTime})`);
        return null;
    }

    console.log(`Getting records for ${phone}`);

    for (const {buid, file} of buids) {
        if (file !== null) {
            try {
                result.devices[buid] = await parseBuidCSVRecords(parseStream(file.stream, {
                    headers: true,
                }), result.metTuids);
            } catch (e) {
                console.error(`Error during BUID ${buid} CSV parsing: ${e}`);
            }
        }
    }
    return result;
}

async function buildDeviceMap(buidSet: Set<string>, tuidSet: Set<string>): Promise<DeviceMap> {
    const registrations = FIRESTORE_CLIENT.collection("registrations");
    const users = FIRESTORE_CLIENT.collection("users");
    const tuidCollection = FIRESTORE_CLIENT.collection("tuids");

    const map: DeviceMap = {
        buidToDevice: {},
        tuidToPhone: {}
    };

    const buidRefs = [...buidSet.values()].map(buid => registrations.doc(buid));
    if (buidRefs.length > 0) {
        for (const document of await FIRESTORE_CLIENT.getAll(...buidRefs)) {
            const buid = document.id;
            if (document.exists) {
                map.buidToDevice[buid] = {
                    manufacturer: document.get("manufacturer"),
                    model: document.get("model"),
                    platform: document.get("platform"),
                    platformVersion: document.get("platformVersion")
                };
            }
        }
    }

    const fuidSet = new Set<string>();
    // FUID -> TUID
    const pendingTuids: { [key: string]: string } = {};

    const tuidRefs = [...tuidSet.values()].map(tuid => tuidCollection.doc(tuid));
    if (tuidRefs.length > 0) {
        if (tuidRefs.length > 0) {
            for (const document of await FIRESTORE_CLIENT.getAll(...tuidRefs)) {
                const tuid = document.id;
                if (document.exists) {
                    const fuid = document.get("fuid");
                    pendingTuids[fuid] = tuid;
                    fuidSet.add(fuid);
                }
            }
        }
    }

    const records = await Promise.all([...fuidSet.values()].map(async fuid => {
        const phone = (await getPhoneFromFuid(fuid)) ?? "";
        return {phone, fuid};
    }));

    for (const {fuid, phone} of records) {
        const tuid = pendingTuids[fuid];
        map.tuidToPhone[tuid] = phone;
    }

    return map;
}

function outputCSVFilePath(phone: string): string {
    let name = phone;
    if (name.length > 0 && name[0] === "+") {
        name = name.substr(1);
    }

    return `${name}.csv`;
}

async function uploadPhone(bucket: AWSBucket, phoneData: PhoneProximityData, deviceMap: DeviceMap) {
    const buids = Object.keys(phoneData.devices).sort();
    const stream = format({headers: true});

    for (const buid of buids) {
        const deviceDetails = deviceMap.buidToDevice[buid] ?? {};
        const {model, manufacturer, platform, platformVersion} = deviceDetails;

        for (const row of phoneData.devices[buid]) {
            const neighbourTuid = row.tuid;
            const phone = deviceMap.tuidToPhone[neighbourTuid];
            row["buid"] = buid;
            row["phone"] = phone ?? "";
            row["device"] = model !== undefined ? `${manufacturer} ${model} ${platform} ${platformVersion}` : "";
            delete row["tuid"];
            stream.write(row);
        }
    }
    stream.end();

    const filePath = outputCSVFilePath(phoneData.phone);
    await bucket.s3.upload({
        ...bucket.key(filePath),
        Body: stream
    }).promise();
}

async function uploadPhones(bucket: AWSBucket, phones: string[]) {
    const records = (await Promise.all(phones.map((phone) => getPhoneRecords(phone, bucket)))).filter(rec => rec !== null) as PhoneProximityData[];

    if (records.length > 0) {
        const tuidSet = new Set<string>();
        const buidSet = new Set<string>();
        for (const record of records) {
            for (const buid of Object.keys(record.devices)) {
                buidSet.add(buid);
            }
            for (const tuid of record.metTuids) {
                tuidSet.add(tuid);
            }
        }
        const deviceMap = await buildDeviceMap(buidSet, tuidSet);
        await Promise.all(records.map(record => uploadPhone(bucket, record, deviceMap)));
    }
}

export async function sendProximityToAws() {
    const readBucket = await loadAwsReadBucket();
    const writeBucket = await loadAwsWriteBucket();

    const phones = await getPhoneNumbers(readBucket, AWS_PHONE_CSV_PATH);
    if (phones.length === 0) return;

    await uploadPhones(writeBucket, phones);
}

export const awsPollerCron = buildCloudFunction({
    memory: "1GB",
    timeoutSeconds: 480
}).pubsub
    .schedule("every 10 minutes")
    .onRun(async (context) => {
        await sendProximityToAws();
    });
