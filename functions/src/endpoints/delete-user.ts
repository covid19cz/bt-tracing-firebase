import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {REGION} from "../settings";
import {deleteUploads} from "../lib/storage";

export const deleteUserCallable = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("failed-precondition", "Missing authentication");
    }

    const uid = context.auth.uid;
    try {
        console.log(`Deleting user ${uid}`);
        await admin.auth().deleteUser(uid);
        return true;
    } catch (error) {
        console.error(`Failed deleting user ${uid}: ${error}`);
        return false;
    }
});
export const deleteUserDataTrigger = functions.region(REGION).auth.user().onDelete(async (user) => {
    const uid = user.uid;

    try {
        console.log(`Deleting user ${uid} data`);
        await admin.firestore().collection("users").doc(uid).delete();
    } catch (error) {
        console.error(`Failed deleting user ${uid} data: ${error}`);
    }

    try {
        console.log(`Deleting user ${uid} uploads`);
        await deleteUploads(uid);
    } catch (error) {
        console.error(`Failed deleting user ${uid} uploads: ${error}`);
    }
});
