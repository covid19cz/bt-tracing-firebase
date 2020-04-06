import * as functions from "firebase-functions";
import {firestore} from "firebase-admin";
import {buildCloudFunction} from "../settings";
import * as t from "io-ts";
import {parseRequest} from "../lib/request";
import {FIRESTORE_CLIENT, isBuidOwnedByFuid} from "../lib/database";
import {deleteUploads} from "../lib/storage";

const MAX_OPS_IN_BATCH = 500;

export async function deleteBuid(fuid: string, buid: string) {
    const registrations = FIRESTORE_CLIENT.collection("registrations");
    const buidDoc = await registrations.doc(buid).get();
    const buidLastUpdateTime = buidDoc.updateTime;

    const users = FIRESTORE_CLIENT.collection("users");
    const tuids = FIRESTORE_CLIENT.collection("tuids");
    const userRef = users.doc(fuid);
    const user = await userRef.get();
    const userUpdateTime = user.updateTime;

    let tuidRefs = (await tuids.where("buid", "==", buid).get()).docs;

    if (tuidRefs.length + 2 > MAX_OPS_IN_BATCH) {
        // TODO: implement deletion of many TUIDs at once
        console.error(`Too many TUIDs to delete for BUID ${buid}`);
        tuidRefs = tuidRefs.slice(0, MAX_OPS_IN_BATCH - 2);
    }

    const batch = FIRESTORE_CLIENT.batch();

    if (user.get("registrationCount") === 1) {
        batch.delete(userRef, {
            lastUpdateTime: userUpdateTime
        });
    }
    else {
        batch.update(userRef, {
            registrationCount: firestore.FieldValue.increment(-1)
        });
    }

    for (const doc of tuidRefs) {
        batch.delete(doc.ref);
    }

    batch.delete(registrations.doc(buid), {
        lastUpdateTime: buidLastUpdateTime
    });
    await batch.commit();
}

const RequestSchema = t.type({
    buid: t.string,
});

export const deleteBuidCallable = buildCloudFunction().https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Chybějící autentizace");
    }

    const payload = parseRequest(RequestSchema, data);
    const buid = payload.buid;
    const fuid = context.auth.uid;

    if (!await isBuidOwnedByFuid(buid, fuid)) {
        throw new functions.https.HttpsError("unauthenticated", "Zařízení neexistuje nebo nepatří Vašemu účtu");
    }

    try {
        await deleteBuid(fuid, buid);
        console.log(`Deleted buid ${buid}`);
        await deleteUploads(fuid, buid);
    } catch (error) {
        console.error(`Failed deleting buid ${buid}: ${error}`);
        throw new functions.https.HttpsError("unavailable", "Nepodařilo se smazat informace o zařízení");
    }
});
