import * as functions from 'firebase-functions';
import * as t from 'io-ts'
import {isLeft} from "fp-ts/lib/Either";
import * as admin from 'firebase-admin';
import {CollectionReference} from "@google-cloud/firestore";
import {PathReporter} from "io-ts/lib/PathReporter";
import {randomBytes} from 'crypto';

const Request = t.type({
    platform: t.string,
    platformVersion: t.string,
    manufacturer: t.string,
    model: t.string,
    locale: t.string,
});

const MAX_BUID_RETRIES = 10;
const BUID_BYTE_LENGTH = 10;

// Initialize Firebase
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

async function generateBuid(collection: CollectionReference) {
    for (let i = 0; i < MAX_BUID_RETRIES; i++) {
        const buid = randomBytes(BUID_BYTE_LENGTH).toString('hex');
        const res = await collection.where("buid", "==", buid).get();

        // Note: small data race here, ignored for now
        if (res.empty) {
            return buid;
        }
    }
    return null;
}

function getUTCTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

export const createUser = functions.region('europe-west2').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('failed-precondition', 'Missing authentication');
    }
    const parsed = t.exact(Request).decode(data);
    if (isLeft(parsed)) {
        console.error(PathReporter.report(parsed));
        throw new functions.https.HttpsError('invalid-argument', 'Wrong arguments');
    }
    const payload = parsed.right;
    const uid = context.auth.uid;

    const phoneNumber = context.auth.token.phone_number;
    if (phoneNumber === undefined) {
        throw new functions.https.HttpsError('failed-precondition', 'Phone number is missing');
    }

    const collection = admin.firestore().collection("users");

    const document = collection.doc(uid);
    const snapshot = await document.get();

    let buid: string | null;
    if (snapshot.exists) {
        buid = snapshot.get("buid");

        console.log(`Updating user ${uid}`);
        await document.update({...payload});
    } else {
        buid = await generateBuid(collection);
        if (buid === null) {
            throw new functions.https.HttpsError('unavailable', 'BUID could not be generated');
        }

        // Note: small data race here, will throw if already exists
        await document.create({
            ...payload,
            buid,
            phoneNumber,
            status: "unknown",
            createdAt: getUTCTimestamp()
        });
    }
    return {buid};
});
