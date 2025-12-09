import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

const TOKEN_DIR = path.join(os.homedir(), ".edilkamin");
const TOKEN_FILE = path.join(TOKEN_DIR, "session.json");

interface StoredData {
  [key: string]: string;
}

/**
 * Custom storage adapter for AWS Amplify that persists to file system.
 * Used for CLI to maintain sessions between invocations.
 */
export const createFileStorage = () => {
  let cache: StoredData = {};
  let loaded = false;

  const ensureDir = async (): Promise<void> => {
    try {
      await fs.mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
    } catch {
      // Directory may already exist
    }
  };

  const load = async (): Promise<void> => {
    if (loaded) return;
    try {
      const data = await fs.readFile(TOKEN_FILE, "utf-8");
      cache = JSON.parse(data);
    } catch {
      cache = {};
    }
    loaded = true;
  };

  const save = async (): Promise<void> => {
    await ensureDir();
    await fs.writeFile(TOKEN_FILE, JSON.stringify(cache), {
      encoding: "utf-8",
      mode: 0o600,
    });
  };

  return {
    setItem: async (key: string, value: string): Promise<void> => {
      await load();
      cache[key] = value;
      await save();
    },
    getItem: async (key: string): Promise<string | null> => {
      await load();
      return cache[key] ?? null;
    },
    removeItem: async (key: string): Promise<void> => {
      await load();
      delete cache[key];
      await save();
    },
    clear: async (): Promise<void> => {
      cache = {};
      await save();
    },
  };
};

/**
 * Clears all stored session data.
 */
export const clearSession = async (): Promise<void> => {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch {
    // File may not exist
  }
};
