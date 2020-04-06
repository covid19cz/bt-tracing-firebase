import {FIREBASE_TEST} from "./setup.test"; // must be first import
import {equal, rejects} from "assert";
import {registerBuid} from "../src";
import {firestore} from "firebase-admin";
import * as functions from "firebase-functions";
import {createAuth} from "./common";
import {MAX_BUIDS_PER_USER} from "../src/settings";
import {expect} from "chai";

export const registerBuidMock = FIREBASE_TEST.wrap(registerBuid);

export function makeDeviceData() {
    return {
        model: "model",
        manufacturer: "manufacturer",
        platform: "platform",
        platformVersion: "platformVersion",
        locale: "locale",
        pushRegistrationToken: "pushRegistrationToken"
    };
}

describe("registerBuid", () => {
    it("should not accept unauthorized calls", async () => {
        await rejects(async () => {
            await registerBuidMock({});
        }, new functions.https.HttpsError("unauthenticated", "Chybějící autentizace"));
    });
    it("should not accept users without phone numbers", async () => {
        await rejects(async () => {
            await registerBuidMock({}, {
                auth: {
                    uid: "1"
                }
            });
        }, new functions.https.HttpsError("failed-precondition", "Chybí telefonní číslo"));
    });
    it("should not accept wrong input", async () => {
        await rejects(async () => {
            await registerBuidMock({}, createAuth());
        }, new functions.https.HttpsError("invalid-argument", "Wrong arguments"));

        await rejects(async () => {
            await registerBuidMock({
                model: "model1",
                manufacturer: "model2"
            }, createAuth("uid1", "123456789"));
        }, new functions.https.HttpsError("invalid-argument", "Wrong arguments"));
    });
    it("should create a user with the correct phone number", async () => {
        const fuid = "uid1";
        const phone = "123456789";
        await registerBuidMock(makeDeviceData(), createAuth(fuid, phone));
        const doc = await firestore().collection("users").doc(fuid).get();
        equal(doc.exists, true);
        equal(doc.get("registrationCount"), 1);
    });
    it("should create BUID", async () => {
        const fuid = "uid1";
        const phone = "123456789";
        const data = makeDeviceData();
        const response = await registerBuidMock(data, createAuth(fuid, phone));
        const buid = response.buid;

        const doc = await firestore().collection("registrations").doc(buid).get();
        equal(doc.exists, true);
        equal(doc.get("fuid"), fuid);
        equal(doc.get("model"), data.model);
        equal(doc.get("manufacturer"), data.manufacturer);
        equal(doc.get("platform"), data.platform);
        equal(doc.get("platformVersion"), data.platformVersion);
        equal(doc.get("locale"), data.locale);
        equal(doc.get("pushRegistrationToken"), data.pushRegistrationToken);
    });
    it("should create TUIDs", async () => {
        const fuid = "uid1";
        const phone = "123456789";
        const data = makeDeviceData();
        const response = await registerBuidMock(data, createAuth(fuid, phone));
        const buid = response.buid;
        const tuids = response.tuids;

        const dbTuids = [];
        for (const doc of (await firestore().collection("tuids").where("buid", "==", buid).get()).docs) {
            equal(doc.get("buid"), buid);
            equal(doc.get("fuid"), fuid);
            dbTuids.push(doc.id);
        }
        expect(tuids).to.have.members(dbTuids);
    });
    it("should support multiple BUIDs per user", async () => {
        const fuid = "uid1";
        const phone = "123456789";
        const data = makeDeviceData();

        const buids = await Promise.all([0, 0, 0].map(() => registerBuidMock(data, createAuth(fuid, phone))));
        const doc = await firestore().collection("users").doc(fuid).get();
        equal(doc.get("registrationCount"), buids.length);

        for (const buid of buids) {
            const buidDoc = await firestore().collection("registrations").doc(buid.buid).get();
            equal(buidDoc.exists, true);
        }
    });
    it("should not allow too many BUIDs per user", async () => {
        const auth = createAuth();
        const data = makeDeviceData();

        await Promise.all(Array.from(Array(MAX_BUIDS_PER_USER)).map(() => registerBuidMock(data, auth)));
        await rejects(async () => {
            await registerBuidMock(data, auth);
        }, new functions.https.HttpsError("resource-exhausted", "Na Vašem účtu je již příliš mnoho registrovaných zařízení"));
    });
});
