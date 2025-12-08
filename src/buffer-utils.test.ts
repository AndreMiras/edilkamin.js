import { strict as assert } from "assert";
import pako from "pako";
import sinon from "sinon";

import { decompressBuffer, isBuffer, processResponse } from "./buffer-utils";

/**
 * Helper to create a gzip-compressed Buffer object for testing.
 */
const createGzippedBuffer = (
  data: unknown
): { type: "Buffer"; data: number[] } => {
  const json = JSON.stringify(data);
  const compressed = pako.gzip(json);
  return {
    type: "Buffer",
    data: Array.from(compressed),
  };
};

describe("buffer-utils", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("isBuffer", () => {
    it("should detect valid Buffer objects", () => {
      const buffer = { type: "Buffer", data: [31, 139, 8, 0] };
      assert.ok(isBuffer(buffer));
    });

    it("should detect empty Buffer objects", () => {
      const buffer = { type: "Buffer", data: [] };
      assert.ok(isBuffer(buffer));
    });

    it("should reject non-Buffer objects with wrong type", () => {
      assert.ok(!isBuffer({ type: "NotBuffer", data: [] }));
    });

    it("should reject objects without type field", () => {
      assert.ok(!isBuffer({ data: [1, 2, 3] }));
    });

    it("should reject objects without data field", () => {
      assert.ok(!isBuffer({ type: "Buffer" }));
    });

    it("should reject objects with non-array data", () => {
      assert.ok(!isBuffer({ type: "Buffer", data: "not an array" }));
    });

    it("should reject null", () => {
      assert.ok(!isBuffer(null));
    });

    it("should reject undefined", () => {
      assert.ok(!isBuffer(undefined));
    });

    it("should reject primitives", () => {
      assert.ok(!isBuffer("string"));
      assert.ok(!isBuffer(123));
      assert.ok(!isBuffer(true));
    });
  });

  describe("decompressBuffer", () => {
    it("should decompress gzipped JSON buffer", () => {
      const originalData = { test: "value", nested: { key: 123 } };
      const bufferObj = createGzippedBuffer(originalData);

      const result = decompressBuffer(bufferObj);
      assert.deepEqual(result, originalData);
    });

    it("should handle gzipped arrays", () => {
      const originalData = [1, 2, 3, "test"];
      const bufferObj = createGzippedBuffer(originalData);

      const result = decompressBuffer(bufferObj);
      assert.deepEqual(result, originalData);
    });

    it("should handle gzipped strings", () => {
      const originalData = "test string";
      const bufferObj = createGzippedBuffer(originalData);

      const result = decompressBuffer(bufferObj);
      assert.equal(result, originalData);
    });

    it("should return original value if decompression fails", () => {
      const consoleWarnStub = sinon.stub(console, "warn");
      const invalidBuffer = { type: "Buffer" as const, data: [1, 2, 3] };

      const result = decompressBuffer(invalidBuffer);

      assert.deepEqual(result, invalidBuffer);
      assert.ok(consoleWarnStub.calledOnce);
    });

    it("should return original value if JSON parsing fails", () => {
      const consoleWarnStub = sinon.stub(console, "warn");
      // Create valid gzip but invalid JSON
      const invalidJson = "not valid json {";
      const compressed = pako.gzip(invalidJson);
      const bufferObj = {
        type: "Buffer" as const,
        data: Array.from(compressed),
      };

      const result = decompressBuffer(bufferObj);

      assert.deepEqual(result, bufferObj);
      assert.ok(consoleWarnStub.calledOnce);
    });
  });

  describe("processResponse", () => {
    it("should pass through null", () => {
      assert.equal(processResponse(null), null);
    });

    it("should pass through undefined", () => {
      assert.equal(processResponse(undefined), undefined);
    });

    it("should pass through primitives", () => {
      assert.equal(processResponse("string"), "string");
      assert.equal(processResponse(123), 123);
      assert.equal(processResponse(true), true);
    });

    it("should pass through plain objects", () => {
      const obj = { key: "value", nested: { num: 42 } };
      assert.deepEqual(processResponse(obj), obj);
    });

    it("should pass through plain arrays", () => {
      const arr = [1, "two", { three: 3 }];
      assert.deepEqual(processResponse(arr), arr);
    });

    it("should decompress Buffer at root level", () => {
      const originalData = { decompressed: true };
      const buffer = createGzippedBuffer(originalData);

      const result = processResponse(buffer);
      assert.deepEqual(result, originalData);
    });

    it("should decompress nested Buffer fields", () => {
      const statusData = { commands: { power: true } };
      const response = {
        plain: "data",
        status: createGzippedBuffer(statusData),
      };

      const result = processResponse(response);
      assert.equal(result.plain, "data");
      assert.deepEqual(result.status, statusData);
    });

    it("should recursively decompress deeply nested Buffers", () => {
      const innerData = { value: 42 };
      const middleData = { inner: createGzippedBuffer(innerData) };
      const response = {
        outer: createGzippedBuffer(middleData),
      };

      const result = processResponse(response);
      assert.deepEqual(result, { outer: { inner: { value: 42 } } });
    });

    it("should handle arrays containing Buffers", () => {
      const itemData = { id: 1 };
      const response = {
        items: [createGzippedBuffer(itemData), { id: 2 }],
      };

      const result = processResponse(response);
      assert.deepEqual(result.items, [{ id: 1 }, { id: 2 }]);
    });

    it("should handle mixed compressed and uncompressed fields", () => {
      const compressedStatus = { commands: { power: true } };
      const response = {
        status: createGzippedBuffer(compressedStatus),
        nvm: { user_parameters: { temperature: 22 } },
        plain_field: "unchanged",
      };

      const result = processResponse(response);
      assert.deepEqual(result.status, compressedStatus);
      assert.deepEqual(result.nvm, { user_parameters: { temperature: 22 } });
      assert.equal(result.plain_field, "unchanged");
    });

    it("should handle real-world DeviceInfo structure with compressed status", () => {
      const statusData = {
        commands: { power: true },
        temperatures: { board: 25, enviroment: 20 },
      };
      const nvmData = {
        user_parameters: {
          enviroment_1_temperature: 22,
          enviroment_2_temperature: 0,
          enviroment_3_temperature: 0,
          is_auto: false,
          is_sound_active: true,
        },
      };

      const response = {
        status: createGzippedBuffer(statusData),
        nvm: createGzippedBuffer(nvmData),
      };

      const result = processResponse(response);
      assert.deepEqual(result.status, statusData);
      assert.deepEqual(result.nvm, nvmData);
    });
  });
});
