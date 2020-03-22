import {CollectionReference} from "@google-cloud/firestore";
import {randomBytes} from "crypto";

const MAX_BUID_RETRIES = 10;
const BUID_BYTE_LENGTH = 10;

export async function generateBuid(collection: CollectionReference) {
    for (let i = 0; i < MAX_BUID_RETRIES; i++) {
        const buid = randomBytes(BUID_BYTE_LENGTH).toString("hex");
        const res = await collection.where("buid", "==", buid).get();

        // Note: small data race here, ignored for now
        if (res.empty) {
            return buid;
        }
    }
    return null;
}
