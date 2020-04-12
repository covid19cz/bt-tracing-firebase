import * as functions from "firebase-functions";
import * as t from "io-ts"
import * as admin from "firebase-admin";
import {buildCloudFunction, INITIAL_TUIDS_PER_BUID, MAX_BUIDS_PER_USER} from "../settings";
import {CollectionReference} from "@google-cloud/firestore";
import {randomBytes} from "crypto";
import {parseRequest} from "../lib/request";
import {FIRESTORE_CLIENT} from "../lib/database";

const MAX_BUID_RETRIES = 10;
const BUID_BYTE_LENGTH = 10;
const MAX_TUID_RETRIES = 10;
const TUID_BYTE_LENGTH = 10;

function getUnixTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

const RequiredSchema = t.type({
    platform: t.string,
    platformVersion: t.string,
    manufacturer: t.string,
    model: t.string,
    locale: t.string,
    pushRegistrationToken: t.string
});
const OptionalSchema = t.partial({
    unverifiedPhoneNumber: t.union([t.null, t.string])
})
const RequestSchema = t.intersection([RequiredSchema, OptionalSchema]);

function generateBytes(count: number): string {
    return randomBytes(count).toString("hex");
}

const generateBuid = () => generateBytes(BUID_BYTE_LENGTH);
const generateTuid = () => generateBytes(TUID_BYTE_LENGTH);

function isAlreadyExistsError(e: { code: number }): boolean {
    return "code" in e && e.code === 6;
}

async function registerUserIfNotExists(collection: CollectionReference,
                                       fuid: string,
                                       unverifiedPhoneNumber?: string | null): Promise<boolean> {
    const args: {[key: string]: any} = {
        createdAt: getUnixTimestamp(),
        registrationCount: 0
    };
    if (unverifiedPhoneNumber !== undefined && unverifiedPhoneNumber !== null) {
        args["unverifiedPhoneNumber"] = unverifiedPhoneNumber;
    }

    try {
        await collection.doc(fuid).create(args);
        return true;
    } catch (e) {
        if (!isAlreadyExistsError(e)) {
            throw e;
        }
    }
    return false;
}

async function hasSpaceforBuids(
    collection: CollectionReference,
    fuid: string,
    maxCount: number
): Promise<boolean> {
    const doc = await collection.doc(fuid).get();
    if (!doc.exists) {
        return false;
    }
    return (doc.get("registrationCount") || 0) < maxCount;
}

async function registerBuid(
    client: admin.firestore.Firestore,
    users: CollectionReference,
    registrations: CollectionReference,
    fuid: string,
    data: {}
): Promise<string> {
    for (let i = 0; i < MAX_BUID_RETRIES; i++) {
        const buid = generateBuid();
        try {
            const batch = client.batch();
            batch.create(registrations.doc(buid), {
                ...data,
                fuid,
                createdAt: getUnixTimestamp()
            });
            batch.update(users.doc(fuid), {
                registrationCount: admin.firestore.FieldValue.increment(1)
            });
            await batch.commit();

            return buid;
        } catch (e) {
            if (!isAlreadyExistsError(e)) {
                throw e;
            }
        }
    }
    throw new functions.https.HttpsError("deadline-exceeded", "Nepodařilo se vygenerovat BUID");
}

async function createTuids(
    client: admin.firestore.Firestore,
    tuidCollection: CollectionReference,
    fuid: string,
    buid: string,
    count: number
): Promise<string[]> {
    for (let r = 0; r < MAX_TUID_RETRIES; r++) {
        const batch = client.batch();
        const tuids = [];

        for (let i = 0; i < count; i++) {
            const tuid = generateTuid();
            batch.create(tuidCollection.doc(tuid), {
                buid,
                fuid,
                createdAt: getUnixTimestamp()
            });
            tuids.push(tuid);
        }

        try {
            await batch.commit();
            return tuids;
        } catch (e) {
            console.error(`Error during TUID generation: ${e} for buid ${buid}`);
        }
    }
    console.error(`Error during TUID generation: could not find enough TUIDs after ${MAX_TUID_RETRIES} for buid ${buid}`);
    throw new functions.https.HttpsError("internal", "Nepodařilo se vygenerovat TUID");
}

export const registerBuidCallable = buildCloudFunction().https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Chybějící autentizace");
    }

    const payload = parseRequest(RequestSchema, data);

    const hasVerifiedPhone = context.auth?.token?.phone_number !== undefined;
    const hasUnverifiedPhone = (payload.unverifiedPhoneNumber !== undefined && payload.unverifiedPhoneNumber !== null);

    if (!hasVerifiedPhone && !hasUnverifiedPhone) {
        throw new functions.https.HttpsError("failed-precondition", "Chybí telefonní číslo");
    } else if (hasVerifiedPhone && hasUnverifiedPhone) {
        throw new functions.https.HttpsError("invalid-argument", "Špatné parametry");
    }

    const fuid = context.auth.uid;
    const client = FIRESTORE_CLIENT;
    const users = client.collection("users");
    const unverifiedPhoneNumber = hasUnverifiedPhone ? payload.unverifiedPhoneNumber : undefined;

    const registered = await registerUserIfNotExists(users, fuid, unverifiedPhoneNumber);
    if (registered) {
        console.log(`Registered user ${fuid}, phoneNumberStatus=${hasUnverifiedPhone? 'UNVERIFIED' : 'VERIFIED'}`);
    }

    if (!(await hasSpaceforBuids(users, fuid, MAX_BUIDS_PER_USER))) {
        throw new functions.https.HttpsError("resource-exhausted", "Na Vašem účtu je již příliš mnoho registrovaných zařízení");
    }

    const buid = await registerBuid(client, users, client.collection("registrations"), fuid, payload);
    console.log(`Registered BUID ${buid} for user ${fuid}`);

    const tuids = await createTuids(client, client.collection("tuids"), fuid, buid, INITIAL_TUIDS_PER_BUID);
    return {buid, tuids};
});
