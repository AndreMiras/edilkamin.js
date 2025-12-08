import { strict as assert } from "assert";

import {
  serialNumberDisplay,
  serialNumberFromHex,
  serialNumberToHex,
} from "./serial-utils";

describe("serial-utils", () => {
  describe("serialNumberToHex", () => {
    it("should convert ASCII string to hex", () => {
      assert.equal(serialNumberToHex("EDK123"), "45444b313233");
    });

    it("should handle empty string", () => {
      assert.equal(serialNumberToHex(""), "");
    });

    it("should convert string with non-printable chars", () => {
      const input = "EDK\x00123";
      const hex = serialNumberToHex(input);
      assert.equal(hex, "45444b00313233");
    });
  });

  describe("serialNumberFromHex", () => {
    it("should convert hex back to ASCII string", () => {
      assert.equal(serialNumberFromHex("45444b313233"), "EDK123");
    });

    it("should handle empty string", () => {
      assert.equal(serialNumberFromHex(""), "");
    });

    it("should round-trip with toHex", () => {
      const original = "EDK\x00123\x1F";
      const hex = serialNumberToHex(original);
      const restored = serialNumberFromHex(hex);
      assert.equal(restored, original);
    });
  });

  describe("serialNumberDisplay", () => {
    it("should remove non-printable characters", () => {
      assert.equal(serialNumberDisplay("EDK\x00123\x1F"), "EDK123");
    });

    it("should collapse whitespace", () => {
      assert.equal(serialNumberDisplay("EDK  123"), "EDK 123");
    });

    it("should trim leading and trailing whitespace", () => {
      assert.equal(serialNumberDisplay("  EDK123  "), "EDK123");
    });

    it("should handle empty string", () => {
      assert.equal(serialNumberDisplay(""), "");
    });

    it("should preserve normal serial numbers", () => {
      assert.equal(serialNumberDisplay("EDK12345678"), "EDK12345678");
    });
  });
});
