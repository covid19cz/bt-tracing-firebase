import * as admin from "firebase-admin";

export const FIRESTORE_CLIENT = admin.firestore();
export const FIREBASE_AUTH_CLIENT = admin.auth();

export async function isBuidOwnedByFuid(buid: string,
                                        fuid: string): Promise<boolean> {
    const buidDocRef = FIRESTORE_CLIENT.collection("registrations").doc(buid);
    const buidDoc = await buidDocRef.get();
    return buidDoc.exists && buidDoc.get("fuid") === fuid;
}

export async function getFuidFromPhone(phone: string): Promise<string | null> {
    try {
        const user = await FIREBASE_AUTH_CLIENT.getUserByPhoneNumber(phone);
        return user?.uid ?? null;
    }
    catch (error) {
        return null;
    }
}
export async function getPhoneFromFuid(fuid: string): Promise<string | null> {
    try {
        const user = await FIREBASE_AUTH_CLIENT.getUser(fuid);
        return user?.phoneNumber ?? null;
    }
    catch (error) {
        return null;
    }
}
