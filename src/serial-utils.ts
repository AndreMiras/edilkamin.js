/**
 * Converts a raw serial number string to hex-encoded format.
 * This is useful when serial numbers contain non-printable characters.
 *
 * @param serial - The raw serial number string
 * @returns Hex-encoded string representation
 *
 * @example
 * serialNumberToHex("EDK123") // returns "45444b313233"
 */
const serialNumberToHex = (serial: string): string => {
  return Buffer.from(serial, "utf-8").toString("hex");
};

/**
 * Converts a hex-encoded serial number back to raw string format.
 *
 * @param hex - The hex-encoded serial number
 * @returns Raw serial number string
 *
 * @example
 * serialNumberFromHex("45444b313233") // returns "EDK123"
 */
const serialNumberFromHex = (hex: string): string => {
  return Buffer.from(hex, "hex").toString("utf-8");
};

/**
 * Produces a display-friendly version of a serial number by removing
 * non-printable characters and collapsing whitespace.
 *
 * @param serial - The raw serial number string
 * @returns Display-friendly serial number
 *
 * @example
 * serialNumberDisplay("EDK\x00123\x1F") // returns "EDK123"
 */
const serialNumberDisplay = (serial: string): string => {
  // Remove non-printable characters (ASCII 0-31, 127)
  // Keep printable ASCII (32-126) and extended characters
  return (
    serial
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
};

export { serialNumberDisplay, serialNumberFromHex, serialNumberToHex };
