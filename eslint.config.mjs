import typescriptEslint from "@typescript-eslint/eslint-plugin";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // Sorting imports and exports
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
];
