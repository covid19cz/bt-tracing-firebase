import {spawn} from "child_process";
import * as fftest from "firebase-functions-test";
import {waitUntilUsed} from "tcp-port-used";
import {clearFirestoreData} from "@firebase/testing";

// initialize admin
const PROJECT_ID = "erouska-test";
const PORT = 8080;
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = `localhost:${PORT}`;
// @ts-ignore
const _ = require("../src/index");

export const FIREBASE_TEST = fftest();

const emulator = spawn("firebase", ["emulators:start", "--only", "firestore"], {cwd: process.cwd()});

// wait for emulator to start
waitUntilUsed(PORT, 500, 30000)
    .then(run, () => {
        console.log("Timed out waiting for Firestore emulator to start");
        process.exit(1);
    });

beforeEach(async () => {
    await clearFirestoreData({projectId: PROJECT_ID});
});

after(() => {
    console.log("Killing emulator");
    emulator.kill("SIGKILL");
    FIREBASE_TEST.cleanup();
});
