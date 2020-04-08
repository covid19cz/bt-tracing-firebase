import {buildCloudFunction, FIREBASE_REGION, GCP_PROJECT} from "../settings";
import {ObjectMetadata} from "firebase-functions/lib/providers/storage";
import {CloudTasksClient} from "@google-cloud/tasks";
import {google} from "@google-cloud/tasks/build/protos/protos";
import {https} from "firebase-functions";
import {STORAGE_CLIENT} from "../lib/storage";
import ITask = google.cloud.tasks.v2.ITask;

const UPLOAD_REMOVAL_QUEUE = "upload-removal";
const REMOVE_AFTER_SECONDS = 6 * 3600;

const client = new CloudTasksClient();

export const createObjectTrigger = buildCloudFunction().storage.object().onFinalize(async (object: ObjectMetadata) => {
    const path = object.name;
    if (!path?.startsWith("proximity")) return;

    const queuePath = client.queuePath(GCP_PROJECT, FIREBASE_REGION, UPLOAD_REMOVAL_QUEUE);
    const serviceAccountEmail = `${GCP_PROJECT}@appspot.gserviceaccount.com`;
    const url = `https://${FIREBASE_REGION}-${GCP_PROJECT}.cloudfunctions.net/deleteUploadTask`;
    const payload = {path};

    const timeToRun = (Date.now() / 1000) + REMOVE_AFTER_SECONDS;
    const task: ITask = {
        httpRequest: {
            httpMethod: "POST",
            url: url,
            body: Buffer.from(JSON.stringify(payload)),
            headers: {
                "Content-Type": "application/json"
            },
            oidcToken: {
                serviceAccountEmail
            }
        },
        scheduleTime: {
            seconds: timeToRun
        }
    };
    const request = {
        parent: queuePath,
        task: task
    };
    const [response] = await client.createTask(request);
    console.log(`Scheduling ${path} to be deleted at ${new Date(timeToRun * 1000)} with task ${response.name}`);
});

async function deleteUpload(req: https.Request) {
    const path = req.body.path;
    if (!path) return;

    const bucket = STORAGE_CLIENT.bucket();
    const files = (await bucket.getFiles({
        prefix: path
    }))[0];
    if (files.length === 0) {
        console.log(`Upload at ${path} does not exist anymore`);
        return;
    }

    const file = files[0];
    const created = new Date(file.metadata.timeCreated);
    const expectedCreated = new Date(Date.now() - ((REMOVE_AFTER_SECONDS / 2) * 1000));

    if (created > expectedCreated) {
        console.log(`Upload at ${path} was rewritten at ${created}, not deleting yet`);
        return;
    }
    try {
        await bucket.deleteFiles({
            prefix: path,
            force: true
        });
        console.log(`Upload at ${path} succesfully deleted`);
    } catch (error) {
        console.error(`Cannot delete the uploaded file at ${path}, ${error}`);
    }
}

/**
 * This function must not be publicly available. It should only be callable with OIDC authentication.
 */
export const deleteUploadTask = buildCloudFunction().https.onRequest(async (req, res) => {
    await deleteUpload(req);
    res.end();
});
