import pako from "pako";

import { BufferEncodedType } from "./types";

/**
 * Type guard to check if a value is a serialized Node.js Buffer.
 * Node.js Buffers serialize to JSON as: {type: "Buffer", data: [...]}
 *
 * @param value - The value to check
 * @returns True if the value is a Buffer-encoded object
 */
const isBuffer = (value: unknown): value is BufferEncodedType => {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as Record<string, unknown>).type === "Buffer" &&
    "data" in value &&
    Array.isArray((value as Record<string, unknown>).data)
  );
};

/**
 * Decompresses a Buffer-encoded gzip object and parses the resulting JSON.
 *
 * @param bufferObj - A serialized Buffer object containing gzip data
 * @returns The decompressed and parsed JSON data, or the original object on failure
 */
const decompressBuffer = (bufferObj: BufferEncodedType): unknown => {
  try {
    // Convert data array to Uint8Array for pako
    const compressed = new Uint8Array(bufferObj.data);

    // Decompress with gzip
    const decompressed = pako.ungzip(compressed, { to: "string" });

    // Parse JSON
    return JSON.parse(decompressed);
  } catch (error) {
    // Log warning but return original to maintain backward compatibility
    console.warn("Failed to decompress buffer:", error);
    return bufferObj;
  }
};

/**
 * Recursively processes an API response to decompress any Buffer-encoded fields.
 * Handles nested objects and arrays, preserving structure while decompressing.
 *
 * @param data - The API response data to process
 * @returns The processed data with all Buffer fields decompressed
 */
const processResponse = <T>(data: T): T => {
  if (data === null || data === undefined) {
    return data;
  }

  // Check if this is a Buffer object
  if (isBuffer(data)) {
    const decompressed = decompressBuffer(data);
    // Recursively process the decompressed result (may contain nested buffers)
    return processResponse(decompressed) as T;
  }

  // Recursively process arrays
  if (Array.isArray(data)) {
    return data.map((item) => processResponse(item)) as T;
  }

  // Recursively process objects
  if (typeof data === "object") {
    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      processed[key] = processResponse(value);
    }
    return processed as T;
  }

  // Primitive value, return as-is
  return data;
};

export { decompressBuffer, isBuffer, processResponse };
