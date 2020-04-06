import * as admin from "firebase-admin";
import {deleteUploads} from "../lib/storage";
import {buildCloudFunction} from "../settings";
import {FIRESTORE_CLIENT} from "../lib/database";
import {deleteBuid} from "../functions/delete-buid";
import UserRecord = admin.auth.UserRecord;

async function deleteAllUploads(fuid: string) {
    const registrations = FIRESTORE_CLIENT.collection("registrations");

    try {
        console.log(`Deleting user ${fuid} uploads`);
        const documents = await registrations.where("fuid", "==", fuid).select().get();
        for (const document of documents.docs) {
            await deleteUploads(fuid, document.id)
        }
    } catch (error) {
        console.error(`Failed deleting user ${fuid} uploads: ${error}`);
    }
}

async function deleteRegistrations(fuid: string) {
    const registrations = FIRESTORE_CLIENT.collection("registrations");
    console.log(`Deleting user ${fuid} registrations`);

    try {
        const documents = await registrations.where("fuid", "==", fuid).select().get();
        await Promise.all(documents.docs.map(doc => deleteBuid(fuid, doc.id)));
    } catch (error) {
        console.error(`Failed deleting user ${fuid} registrations: ${error}`);
    }
}

async function deleteUserEntry(fuid: string) {
    const users = FIRESTORE_CLIENT.collection("users");
    const userRef = users.doc(fuid);
    if (!(await userRef.get()).exists) return;

    try {
        console.log(`Deleting user ${fuid} database entry`);
        await users.doc(fuid).delete();
    } catch (error) {
        console.error(`Failed deleting user ${fuid} database entry: ${error}`);
    }
}

export const deleteUserTrigger = buildCloudFunction().auth.user().onDelete(async (user: UserRecord) => {
    const fuid = user.uid;
    await deleteAllUploads(fuid);
    await deleteRegistrations(fuid);
    await deleteUserEntry(fuid);
});
