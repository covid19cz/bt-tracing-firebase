import * as functions from "firebase-functions";
import {firestore} from "firebase-admin";
import {REGION} from "../settings";
import * as t from "io-ts";
import {parseRequest} from "../lib/request";
import {isBuidOwnedByFuid} from "../lib/database";

const RequestSchema = t.type({
    buid: t.string
});

export const isBuidActiveCallable = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Chybějící autentizace");
    }

    const payload = parseRequest(RequestSchema, data);
    const buid = payload.buid;
    const fuid = context.auth.uid;
    const client = firestore();

    return await isBuidOwnedByFuid(client, buid, fuid);
});
