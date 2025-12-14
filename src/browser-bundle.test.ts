import { strict as assert } from "assert";
import * as esbuild from "esbuild";

describe("browser-bundle", () => {
  it("should bundle for browser without Node.js built-ins", async () => {
    // This test verifies that the library can be bundled for browser environments
    // without requiring Node.js built-in modules (fs, os, path).
    // If this test fails, it means Node.js-only code has leaked into the main exports.
    const result = await esbuild.build({
      entryPoints: ["dist/esm/src/index.js"],
      platform: "browser",
      bundle: true,
      write: false,
      // External dependencies that are expected (real deps + assert which is used for validation)
      external: ["aws-amplify", "aws-amplify/*", "pako", "assert"],
      logLevel: "silent",
    });
    // If we get here without error, the bundle succeeded
    assert.ok(result.outputFiles.length > 0, "Bundle should produce output");
  });
});
