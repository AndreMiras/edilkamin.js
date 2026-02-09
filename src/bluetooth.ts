import { bleToWifiMac } from "./bluetooth-utils";
import { DiscoveredDevice } from "./types";

/** Device name broadcast by Edilkamin stoves */
const EDILKAMIN_DEVICE_NAME = "EDILKAMIN_EP";

/** GATT Service UUID for Edilkamin devices (0xABF0) */
const EDILKAMIN_SERVICE_UUID = 0xabf0;

/**
 * Check if Web Bluetooth API is available in the current browser.
 *
 * @returns true if Web Bluetooth is supported
 */
const isWebBluetoothSupported = (): boolean => {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
};

/**
 * Scan for nearby Edilkamin stoves using the Web Bluetooth API.
 *
 * This function triggers the browser's Bluetooth device picker dialog,
 * filtered to show only devices named "EDILKAMIN_EP".
 *
 * Note: Web Bluetooth requires:
 * - HTTPS or localhost
 * - User gesture (button click)
 * - Chrome/Edge/Opera (not Firefox/Safari)
 *
 * @returns Promise resolving to array of discovered devices
 * @throws Error if Web Bluetooth is not supported or user cancels
 *
 * @example
 * const devices = await scanForDevices();
 * console.log(devices[0].wifiMac); // Use this for API calls
 */
const scanForDevices = async (): Promise<DiscoveredDevice[]> => {
  if (!isWebBluetoothSupported()) {
    throw new Error(
      "Web Bluetooth API is not supported in this browser. " +
        "Use Chrome, Edge, or Opera on desktop/Android. " +
        "On iOS, use the Bluefy browser app.",
    );
  }

  try {
    // Request device - this opens the browser's device picker
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: EDILKAMIN_DEVICE_NAME }],
      optionalServices: [EDILKAMIN_SERVICE_UUID],
    });

    // Extract BLE MAC from device ID if available
    // Note: device.id format varies by platform, may need adjustment
    const bleMac = device.id || "";
    const name = device.name || EDILKAMIN_DEVICE_NAME;

    // Calculate WiFi MAC for API calls
    let wifiMac = "";
    if (bleMac && /^[0-9a-f:-]{12,17}$/i.test(bleMac)) {
      try {
        wifiMac = bleToWifiMac(bleMac);
      } catch {
        // device.id may not be a valid MAC format on all platforms
        wifiMac = "";
      }
    }

    const discoveredDevice: DiscoveredDevice = {
      bleMac,
      wifiMac,
      name,
      // RSSI not directly available from requestDevice
    };

    return [discoveredDevice];
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "NotFoundError") {
        // User cancelled the device picker
        return [];
      }
      throw error;
    }
    throw new Error("Unknown error during Bluetooth scan");
  }
};

/**
 * Scan for devices with a custom filter.
 * Advanced function for users who need more control over device selection.
 *
 * @param options - Web Bluetooth requestDevice options
 * @returns Promise resolving to the selected BluetoothDevice
 */
const scanWithOptions = async (
  options: RequestDeviceOptions,
): Promise<BluetoothDevice> => {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth API is not supported in this browser.");
  }

  return navigator.bluetooth.requestDevice(options);
};

export {
  EDILKAMIN_DEVICE_NAME,
  EDILKAMIN_SERVICE_UUID,
  isWebBluetoothSupported,
  scanForDevices,
  scanWithOptions,
};

// Re-export DiscoveredDevice for convenience
export type { DiscoveredDevice } from "./types";

// Protocol functions
export {
  aesDecrypt,
  aesEncrypt,
  crc16Modbus,
  createPacket,
  normalizeOperationTaggedPayload,
  // Constants
  NOTIFY_CHARACTERISTIC_UUID,
  parseModbusOperationResponse,
  parseOperationTaggedResponse,
  parseReadWifiStatusPayload,
  parseReadWifiStatusResponse,
  parseResponse,
  // Commands
  parsers,
  readCommands,
  SERVICE_UUID,
  WRITE_CHARACTERISTIC_UUID,
  // Parsers
  writeCommands,
} from "./bluetooth-protocol";

// Protocol types
export type {
  ModbusResponse,
  OperationTaggedPayload,
  OperationTaggedResponse,
  ReadWifiStatusResponse,
} from "./bluetooth-protocol";
