import { normalizeMac } from "./mac-utils";

/**
 * Converts a BLE MAC address to WiFi MAC address.
 * The WiFi MAC is the BLE MAC minus 2 in hexadecimal.
 *
 * @param bleMac - BLE MAC address (with or without colons/dashes)
 * @returns WiFi MAC address in lowercase without separators
 *
 * @example
 * bleToWifiMac("A8:03:2A:FE:D5:0A") // returns "a8032afed508"
 * bleToWifiMac("a8032afed50a")      // returns "a8032afed508"
 */
const bleToWifiMac = (bleMac: string): string => {
  const normalized = normalizeMac(bleMac);

  // Convert to number, subtract 2, convert back to hex
  const bleValue = BigInt(`0x${normalized}`);
  const wifiValue = bleValue - BigInt(2);

  // Pad to 12 characters and return lowercase
  return wifiValue.toString(16).padStart(12, "0");
};

export { bleToWifiMac };
