import * as functions from "firebase-functions";
import {BUCKET_URL, REGION} from "../settings";
import * as firestore from "@google-cloud/firestore";
import {storage} from "firebase-admin";

async function backupDatabase() {
    const prefix = "backups/database/";

    // delete old backups
    const bucket = storage().bucket(BUCKET_URL);
    await bucket.deleteFiles({
        prefix,
        force: true
    });

    const client = new firestore.v1.FirestoreAdminClient();
    const timestamp = Date.now().toString();
    const outputUriPrefix = `gs://${BUCKET_URL}/${prefix}${timestamp}`;
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const databaseName = client.databasePath(projectId, "(default)");
    await client.exportDocuments({
        name: databaseName,
        outputUriPrefix,
        collectionIds: []
    });
}

export const scheduledBackup = functions.region(REGION).pubsub
    .schedule("every 24 hours")
    .onRun(async (context) => {
        await backupDatabase();
    });
