#!/usr/bin/env node
import { Command } from "commander";
import readline from "readline";

import { version } from "../package.json";
import { configure, signIn } from "./library";

const promptPassword = (): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  return new Promise((resolve) => {
    rl.question("Enter password: ", (password) => {
      // Hide the password input
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      rl.close();
      resolve(password);
    });
    // Disable input echoing for password
    process.stdin.on("data", (char) => {
      if (char.toString("hex") === "0d0a") return; // Enter key
      process.stdout.write("*");
    });
  });
};

/**
 * Adds common options (username and password) to a command.
 * @param command The command to which options should be added.
 * @returns The command with options added.
 */
const addCommonOptions = (command: Command): Command =>
  command
    .requiredOption("-u, --username <username>", "Username")
    .option("-p, --password <password>", "Password");

const createProgram = (): Command => {
  const program = new Command();
  program
    .name("edilkamin-cli")
    .description("CLI tool for interacting with the Edilkamin API")
    .version(version);
  // Command: signIn
  addCommonOptions(
    program.command("signIn").description("Sign in and retrieve a JWT token")
  ).action(async (options) => {
    const { username, password } = options;
    const pwd = password || (await promptPassword());
    const jwtToken = await signIn(username, pwd);
    console.log("JWT Token:", jwtToken);
  });
  // Command: deviceInfo
  addCommonOptions(
    program
      .command("deviceInfo")
      .description("Retrieve device info for a specific MAC address")
      .requiredOption("-m, --mac <macAddress>", "MAC address of the device")
  ).action(async (options) => {
    const { username, password, mac } = options;
    const normalizedMac = mac.replace(/:/g, "");
    const pwd = password || (await promptPassword());
    const jwtToken = await signIn(username, pwd);
    const api = configure(); // Use the default API configuration
    const deviceInfo = await api.deviceInfo(jwtToken, normalizedMac);
    console.log("Device Info:", deviceInfo.data);
  });
  return program;
};

const main = (): void => {
  const program = createProgram();
  program.parse(process.argv);
};

if (require.main === module) {
  main();
}

export { main };
