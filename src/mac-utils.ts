/**
 * Normalizes a MAC address by removing separators and converting to lowercase.
 * Accepts formats: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, AABBCCDDEEFF
 *
 * @param mac - MAC address in any common format
 * @returns Normalized MAC address (12 lowercase hex chars, no separators)
 * @throws Error if MAC address format is invalid
 *
 * @example
 * normalizeMac("AA:BB:CC:DD:EE:FF") // returns "aabbccddeeff"
 * normalizeMac("AA-BB-CC-DD-EE-FF") // returns "aabbccddeeff"
 * normalizeMac("AABBCCDDEEFF")      // returns "aabbccddeeff"
 */
const normalizeMac = (mac: string): string => {
  const normalized = mac.replace(/[:-]/g, "").toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`Invalid MAC address format: ${mac}`);
  }
  return normalized;
};

export { normalizeMac };
