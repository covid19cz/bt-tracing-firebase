import * as functions from "firebase-functions";
import {buildCloudFunction} from "../settings";
import {FIREBASE_AUTH_CLIENT, FIRESTORE_CLIENT, getPhoneFromFuid} from "../lib/database";
import * as MaskData from "maskdata";

export function maskPhone(phone: string): string {
    const settings = {
        maskWith: "*",
        unmaskedStartDigits: Math.min(6, Math.floor(phone.length / 2)),
        unmaskedEndDigits: 2
    };
    return MaskData.maskPhone(phone, settings);
}

async function getMaskedPhone(fuid: string): Promise<string> {
    try {
        let phone = await getPhoneFromFuid(fuid);
        if (phone === null) {
            const doc = await FIRESTORE_CLIENT.collection("users").doc(fuid).get();
            if (doc.exists) {
                phone = doc.get("unverifiedPhoneNumber") ?? null;
            }
        }

        if (phone === null) {
            throw new Error(`Phone for ${fuid} not found`);
        }
        return maskPhone(phone);
    }
    catch (e) {
        console.warn(`Error getting masked phone of ${fuid}: ${e}`);
        return "<unknown>";
    }
}

export const deleteUserCallable = buildCloudFunction().https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Chybějící autentizace");
    }

    const fuid = context.auth.uid;
    try {
        const phone = await getMaskedPhone(fuid);
        console.log(`Erasing user ${fuid} with phone ${phone}`);
        await FIREBASE_AUTH_CLIENT.revokeRefreshTokens(fuid);
        await FIREBASE_AUTH_CLIENT.deleteUser(fuid);
    } catch (error) {
        console.error(`Erasing user ${fuid} failed: ${error}`);
        throw new functions.https.HttpsError("unauthenticated", "Nepodařilo se smazat uživatele");
    }
});
