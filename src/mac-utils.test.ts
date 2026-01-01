import { strict as assert } from "assert";

import { normalizeMac } from "./mac-utils";

describe("mac-utils", () => {
  describe("normalizeMac", () => {
    it("should normalize MAC address with colons", () => {
      assert.equal(normalizeMac("AA:BB:CC:DD:EE:FF"), "aabbccddeeff");
    });

    it("should normalize MAC address with dashes", () => {
      assert.equal(normalizeMac("AA-BB-CC-DD-EE-FF"), "aabbccddeeff");
    });

    it("should normalize MAC address without separators", () => {
      assert.equal(normalizeMac("AABBCCDDEEFF"), "aabbccddeeff");
    });

    it("should normalize lowercase MAC address", () => {
      assert.equal(normalizeMac("aa:bb:cc:dd:ee:ff"), "aabbccddeeff");
    });

    it("should normalize mixed case MAC address", () => {
      assert.equal(normalizeMac("Aa:Bb:Cc:Dd:Ee:Ff"), "aabbccddeeff");
    });

    it("should normalize MAC address with mixed separators", () => {
      assert.equal(normalizeMac("AA:BB-CC:DD-EE:FF"), "aabbccddeeff");
    });

    it("should throw on MAC address with invalid length (too short)", () => {
      assert.throws(
        () => normalizeMac("AA:BB:CC:DD:EE"),
        /Invalid MAC address format: AA:BB:CC:DD:EE/,
      );
    });

    it("should throw on MAC address with invalid length (too long)", () => {
      assert.throws(
        () => normalizeMac("AA:BB:CC:DD:EE:FF:00"),
        /Invalid MAC address format: AA:BB:CC:DD:EE:FF:00/,
      );
    });

    it("should throw on MAC address with invalid characters", () => {
      assert.throws(
        () => normalizeMac("GG:HH:II:JJ:KK:LL"),
        /Invalid MAC address format: GG:HH:II:JJ:KK:LL/,
      );
    });

    it("should throw on empty string", () => {
      assert.throws(() => normalizeMac(""), /Invalid MAC address format: /);
    });

    it("should throw on whitespace-only string", () => {
      assert.throws(() => normalizeMac("   "), /Invalid MAC address format:/);
    });
  });
});
