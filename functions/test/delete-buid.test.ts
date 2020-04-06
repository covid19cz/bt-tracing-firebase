import {createAuth} from "./common";
import {makeDeviceData, registerBuidMock} from "./register-buid.test";
import {deleteBuid} from "../src/functions/delete-buid";
import {firestore} from "firebase-admin";
import {expect} from "chai";

describe("deleteBuid", () => {
    it("should remove BUID from the database", async () => {
        const auth = createAuth();
        const buid = (await registerBuidMock(makeDeviceData(), auth)).buid;

        await deleteBuid(auth.auth.uid, buid);

        const doc = await firestore().collection("registrations").doc(buid).get();
        expect(doc.exists).to.be.false;
    });
    it("should remove TUIDs from the database", async () => {
        const auth = createAuth();
        const data = await registerBuidMock(makeDeviceData(), auth);
        const buid = data.buid;
        const tuids = data.tuids;

        await deleteBuid(auth.auth.uid, buid);

        for (const tuid of tuids) {
            const doc = await firestore().collection("tuids").doc(tuid).get();
            expect(doc.exists).to.be.false;
        }
    });
    it("should remove user if he has no BUIDs left", async () => {
        const auth = createAuth();
        const data = await registerBuidMock(makeDeviceData(), auth);
        await deleteBuid(auth.auth.uid, data.buid);

        const doc = await firestore().collection("users").doc(auth.auth.uid).get();
        expect(doc.exists).to.be.false;
    });
    it("should not remove user if he has BUIDs left", async () => {
        const auth = createAuth();
        await registerBuidMock(makeDeviceData(), auth);
        const data = await registerBuidMock(makeDeviceData(), auth);
        await deleteBuid(auth.auth.uid, data.buid);

        const doc = await firestore().collection("users").doc(auth.auth.uid).get();
        expect(doc.exists).to.be.true;
    });
});
