import * as functions from "firebase-functions";
import {REGION} from "../settings";
import {deleteUploads} from "../lib/storage";

export const deleteUploadsCallable = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("failed-precondition", "Missing authentication");
    }

    const uid = context.auth.uid;

    try {
        console.log(`Deleting user ${uid} uploads`);
        await deleteUploads(uid);
        return true;
    } catch (error) {
        console.error(`Failed deleting user ${uid} uploads: ${error}`);
        return false;
    }
});
