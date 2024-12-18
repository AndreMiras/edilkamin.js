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
const addAuthOptions = (command: Command): Command =>
  command
    .requiredOption("-u, --username <username>", "Username")
    .option("-p, --password <password>", "Password");

/**
 * Adds MAC address option to a command.
 * @param command The command to which the MAC address option should be added.
 * @returns The command with the MAC address option added.
 */
const addMacOption = (command: Command): Command =>
  command.requiredOption("-m, --mac <macAddress>", "MAC address of the device");

/**
 * Handles common authentication and API initialization logic.
 * @param options The options passed from the CLI command.
 * @returns An object containing the normalized MAC, JWT token, and configured API instance.
 */
const initializeCommand = async (options: {
  username: string;
  password?: string;
  mac: string;
}): Promise<{
  normalizedMac: string;
  jwtToken: string;
  api: ReturnType<typeof configure>;
}> => {
  const { username, password, mac } = options;
  const normalizedMac = mac.replace(/:/g, "");
  const pwd = password || (await promptPassword());
  const jwtToken = await signIn(username, pwd);
  const api = configure();
  return { normalizedMac, jwtToken, api };
};

/**
 * Executes a getter command by handling common steps (authentication, API initialization).
 * @param options The options passed from the CLI command.
 * @param getter A function to call on the configured API object.
 */
const executeGetter = async (
  options: { username: string; password?: string; mac: string },
  getter: (
    api: ReturnType<typeof configure>,
    jwtToken: string,
    mac: string
  ) => Promise<unknown>
): Promise<void> => {
  const { normalizedMac, jwtToken, api } = await initializeCommand(options);
  const result = await getter(api, jwtToken, normalizedMac);
  console.log(result);
};

/**
 * Executes a setter command by handling common steps (authentication, API initialization).
 * @param options The options passed from the CLI command.
 * @param setter A function to call on the configured API object.
 */
const executeSetter = async (
  options: { username: string; password?: string; mac: string; value: number },
  setter: (
    api: ReturnType<typeof configure>,
    jwtToken: string,
    mac: string,
    value: number
  ) => Promise<unknown>
): Promise<void> => {
  const { normalizedMac, jwtToken, api } = await initializeCommand(options);
  const result = await setter(api, jwtToken, normalizedMac, options.value);
  console.log(result);
};

const createProgram = (): Command => {
  const program = new Command();
  program
    .name("edilkamin-cli")
    .description("CLI tool for interacting with the Edilkamin API")
    .version(version);
  // Command: signIn
  addAuthOptions(
    program.command("signIn").description("Sign in and retrieve a JWT token")
  ).action(async (options) => {
    const { username, password } = options;
    const pwd = password || (await promptPassword());
    const jwtToken = await signIn(username, pwd);
    console.log("JWT Token:", jwtToken);
  });
  // Generic getter commands
  [
    {
      commandName: "deviceInfo",
      description: "Retrieve device info for a specific MAC address",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string
      ) => api.deviceInfo(jwtToken, mac),
    },
    {
      commandName: "getPower",
      description: "Retrieve device power status",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string
      ) => api.getPower(jwtToken, mac),
    },
    {
      commandName: "getEnvironmentTemperature",
      description: "Retrieve environment temperature",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string
      ) => api.getEnvironmentTemperature(jwtToken, mac),
    },
    {
      commandName: "getTargetTemperature",
      description: "Retrieve target temperature",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string
      ) => api.getTargetTemperature(jwtToken, mac),
    },
  ].forEach(({ commandName, description, getter }) => {
    addMacOption(
      addAuthOptions(program.command(commandName).description(description))
    ).action((options) => executeGetter(options, getter));
  });
  // Generic setter commands
  [
    {
      commandName: "setPower",
      description: "Set the power state of the device (1 for ON, 0 for OFF)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number
      ) => api.setPower(jwtToken, mac, value),
    },
    {
      commandName: "setTargetTemperature",
      description: "Set the target temperature (degree celsius) for a device",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number
      ) => api.setTargetTemperature(jwtToken, mac, value),
    },
  ].forEach(({ commandName, description, setter }) => {
    addMacOption(
      addAuthOptions(
        program.command(commandName).description(description)
      ).requiredOption("-v, --value <number>", "Value to set", parseFloat)
    ).action((options) => executeSetter(options, setter));
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
