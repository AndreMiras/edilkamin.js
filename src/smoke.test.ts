import * as assert from "assert";
import * as dotenv from "dotenv";

import { initializeCommand } from "./cli";

dotenv.config();

const {
  EDILKAMIN_USERNAME,
  EDILKAMIN_PASSWORD,
  EDILKAMIN_MAC,
  EDILKAMIN_LEGACY,
} = process.env;

describe("Smoke Test", function () {
  this.timeout(30000); // Live API calls can be slow

  before(function () {
    if (!EDILKAMIN_USERNAME || !EDILKAMIN_PASSWORD || !EDILKAMIN_MAC) {
      this.skip();
    }
  });

  it("should perform a real-world authentication and fetch device info", async () => {
    const cache = new Map<string, string>();
    const storage = {
      setItem: async (key: string, value: string): Promise<void> => {
        cache.set(key, value);
      },
      getItem: async (key: string): Promise<string | null> => {
        return cache.get(key) ?? null;
      },
      removeItem: async (key: string): Promise<void> => {
        cache.delete(key);
      },
      clear: async (): Promise<void> => {
        cache.clear();
      },
    };

    const options = {
      username: EDILKAMIN_USERNAME,
      password: EDILKAMIN_PASSWORD,
      mac: EDILKAMIN_MAC!,
      legacy: EDILKAMIN_LEGACY === "true",
    };

    const { normalizedMac, jwtToken, api } = await initializeCommand(
      options,
      storage,
    );

    assert.ok(jwtToken, "JWT token should be returned");
    assert.strictEqual(
      normalizedMac,
      EDILKAMIN_MAC!.replace(/:/g, "").toLowerCase(),
    );

    const info = await api.deviceInfo(jwtToken, normalizedMac);

    assert.ok(info, "Device info should not be empty");
    assert.ok(info.status, "Device status should be present (pako check)");
    assert.strictEqual(typeof info.status, "object");
  });
});
