import {expect} from "chai";
import {maskPhone} from "../src/functions/delete-user";

describe("maskPhone", () => {
    it("should mask empty string", async () => {
        expect(maskPhone("")).to.equal("");
    });
    it("should mask short numbers", async () => {
        expect(maskPhone("123456789")).to.equal("1234***89");
    });
    it("should mask long numbers", async () => {
        expect(maskPhone("+420123456789")).to.equal("+42012*****89");
    });
});
