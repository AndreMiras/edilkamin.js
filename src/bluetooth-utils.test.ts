import { strict as assert } from "assert";

import { bleToWifiMac } from "./bluetooth-utils";

describe("bleToWifiMac", () => {
  it("converts BLE MAC with colons to WiFi MAC", () => {
    assert.equal(bleToWifiMac("A8:03:2A:FE:D5:0A"), "a8032afed508");
  });

  it("converts BLE MAC without separators", () => {
    assert.equal(bleToWifiMac("a8032afed50a"), "a8032afed508");
  });

  it("converts BLE MAC with dashes", () => {
    assert.equal(bleToWifiMac("A8-03-2A-FE-D5-0A"), "a8032afed508");
  });

  it("handles lowercase input", () => {
    assert.equal(bleToWifiMac("a8:03:2a:fe:d5:0a"), "a8032afed508");
  });

  it("handles edge case where subtraction crosses byte boundary", () => {
    // FF:FF:FF:FF:FF:01 - 2 = FF:FF:FF:FF:FE:FF
    assert.equal(bleToWifiMac("FF:FF:FF:FF:FF:01"), "fffffffffeff");
  });

  it("handles minimum value edge case", () => {
    // 00:00:00:00:00:02 - 2 = 00:00:00:00:00:00
    assert.equal(bleToWifiMac("00:00:00:00:00:02"), "000000000000");
  });

  it("throws on invalid MAC format - too short", () => {
    assert.throws(() => bleToWifiMac("A8:03:2A"), /Invalid MAC address format/);
  });

  it("throws on invalid MAC format - invalid characters", () => {
    assert.throws(
      () => bleToWifiMac("G8:03:2A:FE:D5:0A"),
      /Invalid MAC address format/,
    );
  });

  it("throws on empty string", () => {
    assert.throws(() => bleToWifiMac(""), /Invalid MAC address format/);
  });
});
