/**
 * Edilkamin BLE Protocol Implementation
 *
 * Transport-agnostic protocol layer for communicating with Edilkamin stoves via BLE.
 * Handles AES-128-CBC encryption, CRC16-Modbus checksums, and Modbus packet building/parsing.
 *
 * The consuming application is responsible for:
 * - BLE device scanning and connection
 * - Writing to BLE characteristics
 * - Subscribing to BLE notifications
 *
 * Protocol details derived from: https://github.com/netmb/Edilkamin_BT
 */

// =============================================================================
// BLE Characteristic UUIDs (for consuming apps)
// =============================================================================

/** Edilkamin GATT service UUID */
export const SERVICE_UUID = "0000abf0-0000-1000-8000-00805f9b34fb";

/** Write characteristic UUID (WRITE NO RESPONSE) */
export const WRITE_CHARACTERISTIC_UUID = "0000abf1-0000-1000-8000-00805f9b34fb";

/** Notify characteristic UUID (NOTIFY) */
export const NOTIFY_CHARACTERISTIC_UUID =
  "0000abf2-0000-1000-8000-00805f9b34fb";

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed Modbus response from the device.
 */
export interface ModbusResponse {
  /** Slave address (always 0x01 for Edilkamin) */
  slaveAddress: number;
  /** Function code (0x03 for read, 0x06 for write) */
  functionCode: number;
  /** Byte count (for read responses) */
  byteCount?: number;
  /** Response data */
  data: Uint8Array;
  /** Whether the response indicates an error */
  isError: boolean;
}

// =============================================================================
// Constants (private)
// =============================================================================

/** AES-128-CBC key (16 bytes) */
const AES_KEY = new Uint8Array([
  0x80, 0x29, 0x47, 0x46, 0xdb, 0x35, 0x4d, 0xb7, 0x4c, 0x37, 0x01, 0xcf, 0x30,
  0xef, 0xdd, 0x65,
]);

/** AES-128-CBC initialization vector (16 bytes) */
const AES_IV = new Uint8Array([
  0xda, 0x1a, 0x55, 0x73, 0x49, 0xf2, 0x5c, 0x64, 0x1b, 0x1a, 0x21, 0xd2, 0x6f,
  0x5b, 0x21, 0x8a,
]);

/** Fixed key embedded in every packet (16 bytes) */
const FIXED_KEY = new Uint8Array([
  0x31, 0xdd, 0x34, 0x51, 0x26, 0x39, 0x20, 0x23, 0x9f, 0x4b, 0x68, 0x20, 0xe7,
  0x25, 0xfc, 0x75,
]);

/** CRC16-Modbus high byte lookup table */
const CRC_HI_TABLE = new Uint8Array([
  0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x01, 0xc0, 0x80, 0x41, 0x00,
  0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x00, 0xc1,
  0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81,
  0x40, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40,
  0x01, 0xc0, 0x80, 0x41, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x01,
  0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0,
  0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x01, 0xc0, 0x80,
  0x41, 0x00, 0xc1, 0x81, 0x40, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41,
  0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x00,
  0xc1, 0x81, 0x40, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x01, 0xc0,
  0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80,
  0x41, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x01, 0xc0, 0x80, 0x41,
  0x00, 0xc1, 0x81, 0x40, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x01,
  0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1,
  0x81, 0x40, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81,
  0x40, 0x01, 0xc0, 0x80, 0x41, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40,
  0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x00, 0xc1, 0x81, 0x40, 0x01,
  0xc0, 0x80, 0x41, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x00, 0xc1,
  0x81, 0x40, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40, 0x01, 0xc0, 0x80,
  0x41, 0x01, 0xc0, 0x80, 0x41, 0x00, 0xc1, 0x81, 0x40,
]);

/** CRC16-Modbus low byte lookup table */
const CRC_LO_TABLE = new Uint8Array([
  0x00, 0xc0, 0xc1, 0x01, 0xc3, 0x03, 0x02, 0xc2, 0xc6, 0x06, 0x07, 0xc7, 0x05,
  0xc5, 0xc4, 0x04, 0xcc, 0x0c, 0x0d, 0xcd, 0x0f, 0xcf, 0xce, 0x0e, 0x0a, 0xca,
  0xcb, 0x0b, 0xc9, 0x09, 0x08, 0xc8, 0xd8, 0x18, 0x19, 0xd9, 0x1b, 0xdb, 0xda,
  0x1a, 0x1e, 0xde, 0xdf, 0x1f, 0xdd, 0x1d, 0x1c, 0xdc, 0x14, 0xd4, 0xd5, 0x15,
  0xd7, 0x17, 0x16, 0xd6, 0xd2, 0x12, 0x13, 0xd3, 0x11, 0xd1, 0xd0, 0x10, 0xf0,
  0x30, 0x31, 0xf1, 0x33, 0xf3, 0xf2, 0x32, 0x36, 0xf6, 0xf7, 0x37, 0xf5, 0x35,
  0x34, 0xf4, 0x3c, 0xfc, 0xfd, 0x3d, 0xff, 0x3f, 0x3e, 0xfe, 0xfa, 0x3a, 0x3b,
  0xfb, 0x39, 0xf9, 0xf8, 0x38, 0x28, 0xe8, 0xe9, 0x29, 0xeb, 0x2b, 0x2a, 0xea,
  0xee, 0x2e, 0x2f, 0xef, 0x2d, 0xed, 0xec, 0x2c, 0xe4, 0x24, 0x25, 0xe5, 0x27,
  0xe7, 0xe6, 0x26, 0x22, 0xe2, 0xe3, 0x23, 0xe1, 0x21, 0x20, 0xe0, 0xa0, 0x60,
  0x61, 0xa1, 0x63, 0xa3, 0xa2, 0x62, 0x66, 0xa6, 0xa7, 0x67, 0xa5, 0x65, 0x64,
  0xa4, 0x6c, 0xac, 0xad, 0x6d, 0xaf, 0x6f, 0x6e, 0xae, 0xaa, 0x6a, 0x6b, 0xab,
  0x69, 0xa9, 0xa8, 0x68, 0x78, 0xb8, 0xb9, 0x79, 0xbb, 0x7b, 0x7a, 0xba, 0xbe,
  0x7e, 0x7f, 0xbf, 0x7d, 0xbd, 0xbc, 0x7c, 0xb4, 0x74, 0x75, 0xb5, 0x77, 0xb7,
  0xb6, 0x76, 0x72, 0xb2, 0xb3, 0x73, 0xb1, 0x71, 0x70, 0xb0, 0x50, 0x90, 0x91,
  0x51, 0x93, 0x53, 0x52, 0x92, 0x96, 0x56, 0x57, 0x97, 0x55, 0x95, 0x94, 0x54,
  0x9c, 0x5c, 0x5d, 0x9d, 0x5f, 0x9f, 0x9e, 0x5e, 0x5a, 0x9a, 0x9b, 0x5b, 0x99,
  0x59, 0x58, 0x98, 0x88, 0x48, 0x49, 0x89, 0x4b, 0x8b, 0x8a, 0x4a, 0x4e, 0x8e,
  0x8f, 0x4f, 0x8d, 0x4d, 0x4c, 0x8c, 0x44, 0x84, 0x85, 0x45, 0x87, 0x47, 0x46,
  0x86, 0x82, 0x42, 0x43, 0x83, 0x41, 0x81, 0x80, 0x40,
]);

// =============================================================================
// CRC16-Modbus
// =============================================================================

/**
 * Calculate CRC16-Modbus checksum.
 *
 * @param data - Data to calculate CRC for
 * @returns 2-byte CRC in little-endian order [crcLo, crcHi]
 */
export const crc16Modbus = (data: Uint8Array): Uint8Array => {
  let crcHi = 0xff;
  let crcLo = 0xff;

  for (let i = 0; i < data.length; i++) {
    const index = crcLo ^ data[i];
    crcLo = crcHi ^ CRC_HI_TABLE[index];
    crcHi = CRC_LO_TABLE[index];
  }

  // Return [crcLo, crcHi] - note the order!
  return new Uint8Array([crcLo, crcHi]);
};

// =============================================================================
// AES-128-CBC Encryption
// =============================================================================

/**
 * Import AES key for encryption/decryption.
 */
const importAesKey = async (
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    "raw",
    AES_KEY.buffer as ArrayBuffer,
    { name: "AES-CBC" },
    false,
    [usage],
  );
};

/**
 * Encrypt data using AES-128-CBC (raw, without PKCS7 padding).
 *
 * This manually applies PKCS7 padding to make input a multiple of 16 bytes,
 * encrypts with Web Crypto, then strips the extra padding block from output.
 *
 * @param plaintext - Data to encrypt (must be 32 bytes)
 * @returns Encrypted data (32 bytes)
 */
export const aesEncrypt = async (
  plaintext: Uint8Array,
): Promise<Uint8Array> => {
  const key = await importAesKey("encrypt");

  // Clone IV since AES-CBC modifies it during operation
  const iv = new Uint8Array(AES_IV);

  // Add PKCS7 padding (16 bytes of 0x10 for 32-byte input)
  const padded = new Uint8Array(48);
  padded.set(plaintext, 0);
  padded.fill(0x10, 32);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: iv.buffer as ArrayBuffer },
    key,
    padded.buffer as ArrayBuffer,
  );

  // Return first 32 bytes (skip the padding block)
  return new Uint8Array(encrypted).slice(0, 32);
};

/**
 * Decrypt data using AES-128-CBC (raw, handling PKCS7 padding).
 *
 * @param ciphertext - Data to decrypt (must be 32 bytes)
 * @returns Decrypted data (32 bytes)
 */
export const aesDecrypt = async (
  ciphertext: Uint8Array,
): Promise<Uint8Array> => {
  const key = await importAesKey("decrypt");

  // Clone IV since AES-CBC modifies it during operation
  const iv = new Uint8Array(AES_IV);

  // To decrypt without padding validation, we need to:
  // 1. Decrypt to get raw blocks
  // 2. Handle padding ourselves
  //
  // The trick is to append a valid padding block that we encrypt separately,
  // then decrypt the whole thing.

  // First, encrypt a padding block using the last ciphertext block as IV
  // This creates the correct padding block for decryption
  const lastBlock = ciphertext.slice(16, 32);
  const paddingPlain = new Uint8Array(16).fill(0x10); // Valid PKCS7 for 0 extra bytes

  const paddingKey = await importAesKey("encrypt");
  const encryptedPadding = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: lastBlock.buffer as ArrayBuffer },
    paddingKey,
    paddingPlain.buffer as ArrayBuffer,
  );

  // Build full ciphertext with valid padding block
  const fullCiphertext = new Uint8Array(48);
  fullCiphertext.set(ciphertext, 0);
  fullCiphertext.set(new Uint8Array(encryptedPadding).slice(0, 16), 32);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: iv.buffer as ArrayBuffer },
    key,
    fullCiphertext.buffer as ArrayBuffer,
  );

  // Return first 32 bytes (the actual data)
  return new Uint8Array(decrypted).slice(0, 32);
};

// =============================================================================
// Packet Building
// =============================================================================

/**
 * Get current Unix timestamp as 4 big-endian bytes.
 */
const getTimestamp = (): Uint8Array => {
  const now = Math.floor(Date.now() / 1000);
  return new Uint8Array([
    (now >> 24) & 0xff,
    (now >> 16) & 0xff,
    (now >> 8) & 0xff,
    now & 0xff,
  ]);
};

/**
 * Build and encrypt a command packet to send to the device.
 *
 * Packet structure (32 bytes before encryption):
 * - Bytes 0-3: Unix timestamp (big-endian)
 * - Bytes 4-19: Fixed key
 * - Bytes 20-25: Modbus command (6 bytes)
 * - Bytes 26-27: CRC16-Modbus of command
 * - Bytes 28-31: Padding [0x04, 0x04, 0x04, 0x04]
 *
 * @param modbusCommand - 6-byte Modbus RTU command
 * @returns 32-byte encrypted packet ready to send via BLE
 */
export const createPacket = async (
  modbusCommand: Uint8Array,
): Promise<Uint8Array> => {
  if (modbusCommand.length !== 6) {
    throw new Error("Modbus command must be exactly 6 bytes");
  }

  // Build 32-byte plaintext packet
  const packet = new Uint8Array(32);

  // Timestamp (4 bytes, big-endian)
  packet.set(getTimestamp(), 0);

  // Fixed key (16 bytes)
  packet.set(FIXED_KEY, 4);

  // Modbus payload (6 bytes)
  packet.set(modbusCommand, 20);

  // CRC16-Modbus (2 bytes)
  const crc = crc16Modbus(modbusCommand);
  packet.set(crc, 26);

  // Padding (4 bytes)
  packet.set([0x04, 0x04, 0x04, 0x04], 28);

  // Encrypt with AES-128-CBC
  return aesEncrypt(packet);
};

// =============================================================================
// Response Parsing
// =============================================================================

/**
 * Decrypt and parse a response packet from the device.
 *
 * Response structure (32 bytes before decryption):
 * - Bytes 0-3: Unix timestamp
 * - Bytes 4-19: Fixed key
 * - Bytes 20-26: Modbus response (7 bytes)
 * - Bytes 27-28: CRC16-Modbus
 * - Bytes 29-31: Padding [0x03, 0x03, 0x03]
 *
 * @param encrypted - 32-byte encrypted response from BLE notification
 * @returns Parsed Modbus response
 */
export const parseResponse = async (
  encrypted: Uint8Array,
): Promise<ModbusResponse> => {
  if (encrypted.length !== 32) {
    throw new Error("Response must be exactly 32 bytes");
  }

  // Decrypt
  const decrypted = await aesDecrypt(encrypted);

  // Extract Modbus response (bytes 20-26, 7 bytes)
  const modbusResponse = decrypted.slice(20, 27);

  const slaveAddress = modbusResponse[0];
  const functionCode = modbusResponse[1];

  // Check for Modbus error (function code has high bit set)
  const isError = (functionCode & 0x80) !== 0;

  if (isError) {
    return {
      slaveAddress,
      functionCode: functionCode & 0x7f,
      data: new Uint8Array([modbusResponse[2]]), // Error code
      isError: true,
    };
  }

  // Read response: [slaveAddr, funcCode, byteCount, dataHi, dataLo, crcLo, crcHi]
  if (functionCode === 0x03) {
    const byteCount = modbusResponse[2];
    return {
      slaveAddress,
      functionCode,
      byteCount,
      data: modbusResponse.slice(3, 3 + byteCount),
      isError: false,
    };
  }

  // Write response: [slaveAddr, funcCode, regHi, regLo, valHi, valLo, crcLo, crcHi]
  // (echo of command - return register and value bytes)
  return {
    slaveAddress,
    functionCode,
    data: modbusResponse.slice(2, 6),
    isError: false,
  };
};

// =============================================================================
// Modbus Read Commands (Function Code 0x03)
// =============================================================================

/**
 * Pre-built Modbus read commands for querying device state.
 * Each command is 6 bytes: [SlaveAddr, FuncCode, RegHi, RegLo, CountHi, CountLo]
 */
export const readCommands = {
  /** Power state (0=off, 1=on) */
  power: new Uint8Array([0x01, 0x03, 0x05, 0x29, 0x00, 0x01]),

  /** Current ambient temperature (value / 10 = °C) */
  temperature: new Uint8Array([0x01, 0x03, 0x05, 0x25, 0x00, 0x01]),

  /** Target temperature (value / 10 = °C) */
  targetTemperature: new Uint8Array([0x01, 0x03, 0x05, 0x37, 0x00, 0x01]),

  /** Power level (1-5) - register 0x0529 contains [fan1_speed, power_level] */
  powerLevel: new Uint8Array([0x01, 0x03, 0x05, 0x29, 0x00, 0x01]),

  /** Fan 1 speed (0=auto, 1-5=speed) */
  fan1Speed: new Uint8Array([0x01, 0x03, 0x05, 0x4b, 0x00, 0x01]),

  /** Fan 2 speed (0=auto, 1-5=speed) */
  fan2Speed: new Uint8Array([0x01, 0x03, 0x05, 0x4d, 0x00, 0x01]),

  /** Device state code */
  state: new Uint8Array([0x01, 0x03, 0x05, 0x3b, 0x00, 0x01]),

  /** Alarm status code */
  alarm: new Uint8Array([0x01, 0x03, 0x04, 0xc7, 0x00, 0x01]),

  /** Pellet warning status */
  pelletAlarm: new Uint8Array([0x01, 0x03, 0x04, 0xd5, 0x00, 0x01]),

  /** Auto mode (0=manual, 1=auto) */
  autoMode: new Uint8Array([0x01, 0x03, 0x04, 0x43, 0x00, 0x01]),

  /** Standby mode status */
  standby: new Uint8Array([0x01, 0x03, 0x04, 0x44, 0x00, 0x01]),
};

// =============================================================================
// Modbus Write Commands (Function Code 0x06)
// =============================================================================

/**
 * Builder functions for Modbus write commands.
 * Each function returns a 6-byte command: [SlaveAddr, FuncCode, RegHi, RegLo, ValHi, ValLo]
 */
export const writeCommands = {
  /**
   * Turn power on or off.
   * @param on - true to turn on, false to turn off
   */
  setPower: (on: boolean): Uint8Array =>
    new Uint8Array([0x01, 0x06, 0x03, 0x1c, 0x00, on ? 0x01 : 0x00]),

  /**
   * Set target temperature.
   * @param tempCelsius - Temperature in Celsius (e.g., 21.5)
   */
  setTemperature: (tempCelsius: number): Uint8Array => {
    const value = Math.round(tempCelsius * 10);
    return new Uint8Array([
      0x01,
      0x06,
      0x05,
      0x25,
      (value >> 8) & 0xff,
      value & 0xff,
    ]);
  },

  /**
   * Set power level.
   * @param level - Power level (1-5)
   */
  setPowerLevel: (level: number): Uint8Array => {
    if (level < 1 || level > 5) throw new Error("Power level must be 1-5");
    return new Uint8Array([0x01, 0x06, 0x04, 0x40, 0x00, level]);
  },

  /**
   * Set fan 1 speed.
   * @param speed - Fan speed (0=auto, 1-5=manual speed)
   */
  setFan1Speed: (speed: number): Uint8Array => {
    if (speed < 0 || speed > 5) throw new Error("Fan speed must be 0-5");
    return new Uint8Array([0x01, 0x06, 0x05, 0x4b, 0x00, speed]);
  },

  /**
   * Set fan 2 speed.
   * @param speed - Fan speed (0=auto, 1-5=manual speed)
   */
  setFan2Speed: (speed: number): Uint8Array => {
    if (speed < 0 || speed > 5) throw new Error("Fan speed must be 0-5");
    return new Uint8Array([0x01, 0x06, 0x05, 0x4d, 0x00, speed]);
  },

  /**
   * Enable or disable auto mode.
   * @param enabled - true to enable auto mode
   */
  setAutoMode: (enabled: boolean): Uint8Array =>
    new Uint8Array([0x01, 0x06, 0x04, 0x43, 0x00, enabled ? 0x01 : 0x00]),

  /**
   * Enable or disable standby mode.
   * @param enabled - true to enable standby mode
   */
  setStandby: (enabled: boolean): Uint8Array =>
    new Uint8Array([0x01, 0x06, 0x04, 0x44, 0x00, enabled ? 0x01 : 0x00]),
};

// =============================================================================
// Response Parsers
// =============================================================================

/**
 * Parser functions to extract meaningful values from Modbus responses.
 */
export const parsers = {
  /**
   * Parse boolean response (power state, auto mode, etc.).
   * @param response - Parsed Modbus response
   * @returns true if value is 0x01, false if 0x00
   */
  boolean: (response: ModbusResponse): boolean => {
    if (response.isError) throw new Error(`Modbus error: ${response.data[0]}`);
    return response.data[1] === 0x01;
  },

  /**
   * Parse temperature response.
   * @param response - Parsed Modbus response
   * @returns Temperature in Celsius
   */
  temperature: (response: ModbusResponse): number => {
    if (response.isError) throw new Error(`Modbus error: ${response.data[0]}`);
    const value = (response.data[0] << 8) | response.data[1];
    return value / 10;
  },

  /**
   * Parse numeric value (power level, fan speed, state code, etc.).
   * @param response - Parsed Modbus response
   * @returns Numeric value
   */
  number: (response: ModbusResponse): number => {
    if (response.isError) throw new Error(`Modbus error: ${response.data[0]}`);
    return (response.data[0] << 8) | response.data[1];
  },

  /**
   * Parse power level from combined fan+power register.
   * Register 0x0529 contains: [fan1_speed, power_level]
   * Extracts only the low byte and validates range 1-5.
   * @param response - Parsed Modbus response
   * @returns Power level (1-5)
   */
  powerLevel: (response: ModbusResponse): number => {
    if (response.isError) throw new Error(`Modbus error: ${response.data[0]}`);
    const value = response.data[1]; // Low byte only
    // Validate range (clamp to 1-5)
    if (value < 1) return 1;
    if (value > 5) return 5;
    return value;
  },
};
