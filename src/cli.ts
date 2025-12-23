#!/usr/bin/env node
import { Command } from "commander";
import readline from "readline";

import { version } from "../package.json";
import { NEW_API_URL, OLD_API_URL } from "./constants";
import { configure, configureAmplify, getSession, signIn } from "./library";
import { clearSession, createFileStorage } from "./token-storage";
import { AlarmCode, AlarmDescriptions } from "./types";

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
 * Username is optional if a session already exists.
 * @param command The command to which options should be added.
 * @returns The command with options added.
 */
const addAuthOptions = (command: Command): Command =>
  command
    .option(
      "-u, --username <username>",
      "Username (optional if session exists)",
    )
    .option("-p, --password <password>", "Password");

/**
 * Adds MAC address option to a command.
 * @param command The command to which the MAC address option should be added.
 * @returns The command with the MAC address option added.
 */
const addMacOption = (command: Command): Command =>
  command.requiredOption("-m, --mac <macAddress>", "MAC address of the device");

/**
 * Adds legacy API option to a command.
 * @param command The command to which the legacy option should be added.
 * @returns The command with the legacy option added.
 */
const addLegacyOption = (command: Command): Command =>
  command.option("--legacy", "Use legacy API endpoint (old AWS Gateway)");

/**
 * Handles common authentication and API initialization logic.
 * Tries to use existing session first, falls back to sign-in if needed.
 * @param options The options passed from the CLI command.
 * @returns An object containing the normalized MAC, JWT token, and configured API instance.
 */
const initializeCommand = async (options: {
  username?: string;
  password?: string;
  mac: string;
  legacy?: boolean;
}): Promise<{
  normalizedMac: string;
  jwtToken: string;
  api: ReturnType<typeof configure>;
}> => {
  const { username, password, mac, legacy = false } = options;
  const normalizedMac = mac.replace(/:/g, "");

  // Initialize file storage for session persistence
  const storage = createFileStorage();
  configureAmplify(storage);

  let jwtToken: string;
  try {
    // Try to get existing session first
    jwtToken = await getSession(false, legacy);
  } catch {
    // No session, need to sign in
    if (!username) {
      throw new Error(
        "No session found. Please provide --username to sign in.",
      );
    }
    const pwd = password || (await promptPassword());
    jwtToken = await signIn(username, pwd, legacy);
  }

  const apiUrl = legacy ? OLD_API_URL : NEW_API_URL;
  const api = configure(apiUrl);
  return { normalizedMac, jwtToken, api };
};

/**
 * Executes a getter command by handling common steps (authentication, API initialization).
 * @param options The options passed from the CLI command.
 * @param getter A function to call on the configured API object.
 */
const executeGetter = async (
  options: {
    username?: string;
    password?: string;
    mac: string;
    legacy?: boolean;
  },
  getter: (
    api: ReturnType<typeof configure>,
    jwtToken: string,
    mac: string,
  ) => Promise<unknown>,
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
  options: {
    username?: string;
    password?: string;
    mac: string;
    value: number;
    legacy?: boolean;
  },
  setter: (
    api: ReturnType<typeof configure>,
    jwtToken: string,
    mac: string,
    value: number,
  ) => Promise<unknown>,
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
  program
    .command("signIn")
    .description("Sign in and retrieve a JWT token")
    .requiredOption("-u, --username <username>", "Username")
    .option("-p, --password <password>", "Password")
    .action(async (options) => {
      const { username, password } = options;
      // Initialize file storage for session persistence
      const storage = createFileStorage();
      configureAmplify(storage);
      const pwd = password || (await promptPassword());
      const jwtToken = await signIn(username, pwd);
      console.log("JWT Token:", jwtToken);
    });

  // Command: logout
  program
    .command("logout")
    .description("Clear stored session")
    .action(async () => {
      await clearSession();
      console.log("Session cleared successfully");
    });
  // Generic getter commands
  [
    {
      commandName: "deviceInfo",
      description: "Retrieve device info for a specific MAC address",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.deviceInfo(jwtToken, mac),
    },
    {
      commandName: "getPower",
      description: "Retrieve device power status",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getPower(jwtToken, mac),
    },
    {
      commandName: "getPowerLevel",
      description: "Retrieve manual power level (1-5)",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getPowerLevel(jwtToken, mac),
    },
    {
      commandName: "getEnvironmentTemperature",
      description: "Retrieve environment temperature",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getEnvironmentTemperature(jwtToken, mac),
    },
    {
      commandName: "getEnvironment1Temperature",
      description: "Retrieve Environment 1 target temperature",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getEnvironment1Temperature(jwtToken, mac),
    },
    {
      commandName: "getFan1Speed",
      description: "Retrieve fan 1 speed",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getFan1Speed(jwtToken, mac),
    },
    {
      commandName: "getFan2Speed",
      description: "Retrieve fan 2 speed",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getFan2Speed(jwtToken, mac),
    },
    {
      commandName: "getFan3Speed",
      description: "Retrieve fan 3 speed",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getFan3Speed(jwtToken, mac),
    },
    {
      commandName: "getStandby",
      description: "Retrieve Standby mode status",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getStandby(jwtToken, mac),
    },
    {
      commandName: "getStandbyTime",
      description: "Retrieve standby waiting time in minutes",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getStandbyTime(jwtToken, mac),
    },
    {
      commandName: "getAuto",
      description: "Retrieve Auto mode status",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getAuto(jwtToken, mac),
    },
    {
      commandName: "getEnvironment2Temperature",
      description: "Retrieve Environment 2 target temperature",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getEnvironment2Temperature(jwtToken, mac),
    },
    {
      commandName: "getEnvironment3Temperature",
      description: "Retrieve Environment 3 target temperature",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getEnvironment3Temperature(jwtToken, mac),
    },
    {
      commandName: "getMeasureUnit",
      description: "Retrieve temperature unit (true=Fahrenheit, false=Celsius)",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getMeasureUnit(jwtToken, mac),
    },
    {
      commandName: "getLanguage",
      description: "Retrieve display language code (0-9)",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getLanguage(jwtToken, mac),
    },
    {
      commandName: "getPelletInReserve",
      description:
        "Retrieve pellet reserve status (true=low/reserve, false=ok)",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getPelletInReserve(jwtToken, mac),
    },
    {
      commandName: "getPelletAutonomyTime",
      description: "Retrieve estimated pellet autonomy time",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getPelletAutonomyTime(jwtToken, mac),
    },
    // Statistics getters
    {
      commandName: "getTotalCounters",
      description:
        "Get lifetime operating counters (power-ons, runtime by power level)",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getTotalCounters(jwtToken, mac),
    },
    {
      commandName: "getServiceCounters",
      description: "Get service counters (runtime since last maintenance)",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getServiceCounters(jwtToken, mac),
    },
    {
      commandName: "getRegenerationData",
      description: "Get regeneration and maintenance data",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getRegenerationData(jwtToken, mac),
    },
    {
      commandName: "getServiceTime",
      description: "Get total service time in hours",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getServiceTime(jwtToken, mac),
    },
    // Analytics getters
    {
      commandName: "getTotalOperatingHours",
      description: "Get total operating hours across all power levels",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getTotalOperatingHours(jwtToken, mac),
    },
    {
      commandName: "getPowerDistribution",
      description: "Get power level usage distribution as percentages",
      getter: async (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => {
        const result = await api.getPowerDistribution(jwtToken, mac);
        return {
          p1: `${result.p1.toFixed(1)}%`,
          p2: `${result.p2.toFixed(1)}%`,
          p3: `${result.p3.toFixed(1)}%`,
          p4: `${result.p4.toFixed(1)}%`,
          p5: `${result.p5.toFixed(1)}%`,
        };
      },
    },
    {
      commandName: "getServiceStatus",
      description: "Get service status including whether maintenance is due",
      getter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => api.getServiceStatus(jwtToken, mac),
    },
    {
      commandName: "getUsageAnalytics",
      description: "Get comprehensive usage analytics in single response",
      getter: async (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
      ) => {
        const analytics = await api.getUsageAnalytics(jwtToken, mac);
        return {
          lifetime: {
            powerOnCount: analytics.totalPowerOns,
            totalOperatingHours: analytics.totalOperatingHours,
            blackoutCount: analytics.blackoutCount,
          },
          powerDistribution: {
            p1: `${analytics.powerDistribution.p1.toFixed(1)}%`,
            p2: `${analytics.powerDistribution.p2.toFixed(1)}%`,
            p3: `${analytics.powerDistribution.p3.toFixed(1)}%`,
            p4: `${analytics.powerDistribution.p4.toFixed(1)}%`,
            p5: `${analytics.powerDistribution.p5.toFixed(1)}%`,
          },
          service: {
            totalServiceHours: analytics.serviceStatus.totalServiceHours,
            hoursSinceLastService: analytics.serviceStatus.hoursSinceService,
            thresholdHours: analytics.serviceStatus.serviceThresholdHours,
            isServiceDue: analytics.serviceStatus.isServiceDue,
            lastMaintenanceDate:
              analytics.lastMaintenanceDate?.toISOString() || "Never",
          },
          alarms: {
            totalCount: analytics.alarmCount,
          },
        };
      },
    },
  ].forEach(({ commandName, description, getter }) => {
    addLegacyOption(
      addMacOption(
        addAuthOptions(program.command(commandName).description(description)),
      ),
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
        value: number,
      ) => api.setPower(jwtToken, mac, value),
    },
    {
      commandName: "setPowerLevel",
      description: "Set manual power level (1-5)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setPowerLevel(jwtToken, mac, value),
    },
    {
      commandName: "setEnvironment1Temperature",
      description: "Set Environment 1 target temperature (degrees Celsius)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setEnvironment1Temperature(jwtToken, mac, value),
    },
    {
      commandName: "setFan1Speed",
      description: "Set fan 1 speed (0-5)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setFan1Speed(jwtToken, mac, value),
    },
    {
      commandName: "setFan2Speed",
      description: "Set fan 2 speed (0-5)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setFan2Speed(jwtToken, mac, value),
    },
    {
      commandName: "setFan3Speed",
      description: "Set fan 3 speed (0-5)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setFan3Speed(jwtToken, mac, value),
    },
    {
      commandName: "setAirkare",
      description: "Enable/disable Airkare mode (1=on, 0=off)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setAirkare(jwtToken, mac, value === 1),
    },
    {
      commandName: "setRelax",
      description: "Enable/disable Relax mode (1=on, 0=off)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setRelax(jwtToken, mac, value === 1),
    },
    {
      commandName: "setStandby",
      description: "Enable/disable Standby mode (1=on, 0=off)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setStandby(jwtToken, mac, value === 1),
    },
    {
      commandName: "setStandbyTime",
      description: "Set standby waiting time in minutes",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setStandbyTime(jwtToken, mac, value),
    },
    {
      commandName: "setAuto",
      description: "Enable/disable Auto mode (1=on, 0=off)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setAuto(jwtToken, mac, value === 1),
    },
    {
      commandName: "setEnvironment2Temperature",
      description: "Set Environment 2 target temperature (degrees Celsius)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setEnvironment2Temperature(jwtToken, mac, value),
    },
    {
      commandName: "setEnvironment3Temperature",
      description: "Set Environment 3 target temperature (degrees Celsius)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setEnvironment3Temperature(jwtToken, mac, value),
    },
    {
      commandName: "setMeasureUnit",
      description: "Set temperature unit (1=Fahrenheit, 0=Celsius)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setMeasureUnit(jwtToken, mac, value === 1),
    },
    {
      commandName: "setLanguage",
      description:
        "Set display language (0=IT,1=FR,2=EN,3=ES,4=PT,5=DA,6=NL,7=DE,8=HU,9=PL)",
      setter: (
        api: ReturnType<typeof configure>,
        jwtToken: string,
        mac: string,
        value: number,
      ) => api.setLanguage(jwtToken, mac, value),
    },
  ].forEach(({ commandName, description, setter }) => {
    addLegacyOption(
      addMacOption(
        addAuthOptions(
          program.command(commandName).description(description),
        ).requiredOption("-v, --value <number>", "Value to set", parseFloat),
      ),
    ).action((options) => executeSetter(options, setter));
  });

  // Indexed getter commands (require --index parameter)
  addLegacyOption(
    addMacOption(
      addAuthOptions(
        program
          .command("getFanSpeed")
          .description("Retrieve fan speed by index (1-3)"),
      ).requiredOption(
        "-i, --index <number>",
        "Fan index (1, 2, or 3)",
        parseInt,
      ),
    ),
  ).action(async (options) => {
    const { username, password, mac, index, legacy = false } = options;
    const normalizedMac = mac.replace(/:/g, "");
    const storage = createFileStorage();
    configureAmplify(storage);
    let jwtToken: string;
    try {
      jwtToken = await getSession(false, legacy);
    } catch {
      if (!username) {
        throw new Error(
          "No session found. Please provide --username to sign in.",
        );
      }
      const pwd = password || (await promptPassword());
      jwtToken = await signIn(username, pwd, legacy);
    }
    const apiUrl = legacy ? OLD_API_URL : NEW_API_URL;
    const api = configure(apiUrl);
    const result = await api.getFanSpeed(
      jwtToken,
      normalizedMac,
      index as 1 | 2 | 3,
    );
    console.log(JSON.stringify(result, null, 2));
  });

  addLegacyOption(
    addMacOption(
      addAuthOptions(
        program
          .command("getTargetTemperature")
          .description(
            "Retrieve target temperature by environment index (1-3)",
          ),
      ).requiredOption(
        "-i, --index <number>",
        "Environment index (1, 2, or 3)",
        parseInt,
      ),
    ),
  ).action(async (options) => {
    const { username, password, mac, index, legacy = false } = options;
    const normalizedMac = mac.replace(/:/g, "");
    const storage = createFileStorage();
    configureAmplify(storage);
    let jwtToken: string;
    try {
      jwtToken = await getSession(false, legacy);
    } catch {
      if (!username) {
        throw new Error(
          "No session found. Please provide --username to sign in.",
        );
      }
      const pwd = password || (await promptPassword());
      jwtToken = await signIn(username, pwd, legacy);
    }
    const apiUrl = legacy ? OLD_API_URL : NEW_API_URL;
    const api = configure(apiUrl);
    const result = await api.getTargetTemperature(
      jwtToken,
      normalizedMac,
      index as 1 | 2 | 3,
    );
    console.log(JSON.stringify(result, null, 2));
  });

  // Indexed setter commands (require --index and --value parameters)
  addLegacyOption(
    addMacOption(
      addAuthOptions(
        program
          .command("setFanSpeed")
          .description("Set fan speed by index (1-3)"),
      )
        .requiredOption(
          "-i, --index <number>",
          "Fan index (1, 2, or 3)",
          parseInt,
        )
        .requiredOption("-v, --value <number>", "Fan speed (0-5)", parseFloat),
    ),
  ).action(async (options) => {
    const { username, password, mac, index, value, legacy = false } = options;
    const normalizedMac = mac.replace(/:/g, "");
    const storage = createFileStorage();
    configureAmplify(storage);
    let jwtToken: string;
    try {
      jwtToken = await getSession(false, legacy);
    } catch {
      if (!username) {
        throw new Error(
          "No session found. Please provide --username to sign in.",
        );
      }
      const pwd = password || (await promptPassword());
      jwtToken = await signIn(username, pwd, legacy);
    }
    const apiUrl = legacy ? OLD_API_URL : NEW_API_URL;
    const api = configure(apiUrl);
    const result = await api.setFanSpeed(
      jwtToken,
      normalizedMac,
      index as 1 | 2 | 3,
      value,
    );
    console.log(JSON.stringify(result, null, 2));
  });

  addLegacyOption(
    addMacOption(
      addAuthOptions(
        program
          .command("setTargetTemperature")
          .description("Set target temperature by environment index (1-3)"),
      )
        .requiredOption(
          "-i, --index <number>",
          "Environment index (1, 2, or 3)",
          parseInt,
        )
        .requiredOption(
          "-v, --value <number>",
          "Temperature in degrees Celsius",
          parseFloat,
        ),
    ),
  ).action(async (options) => {
    const { username, password, mac, index, value, legacy = false } = options;
    const normalizedMac = mac.replace(/:/g, "");
    const storage = createFileStorage();
    configureAmplify(storage);
    let jwtToken: string;
    try {
      jwtToken = await getSession(false, legacy);
    } catch {
      if (!username) {
        throw new Error(
          "No session found. Please provide --username to sign in.",
        );
      }
      const pwd = password || (await promptPassword());
      jwtToken = await signIn(username, pwd, legacy);
    }
    const apiUrl = legacy ? OLD_API_URL : NEW_API_URL;
    const api = configure(apiUrl);
    const result = await api.setTargetTemperature(
      jwtToken,
      normalizedMac,
      index as 1 | 2 | 3,
      value,
    );
    console.log(JSON.stringify(result, null, 2));
  });

  // Alarm history command with human-readable descriptions
  addLegacyOption(
    addMacOption(
      addAuthOptions(
        program
          .command("getAlarmHistory")
          .description(
            "Get alarm history log with human-readable descriptions",
          ),
      ),
    ),
  ).action(async (options) => {
    const { username, password, mac, legacy = false } = options;
    const normalizedMac = mac.replace(/:/g, "");
    const storage = createFileStorage();
    configureAmplify(storage);
    let jwtToken: string;
    try {
      jwtToken = await getSession(false, legacy);
    } catch {
      if (!username) {
        throw new Error(
          "No session found. Please provide --username to sign in.",
        );
      }
      const pwd = password || (await promptPassword());
      jwtToken = await signIn(username, pwd, legacy);
    }
    const apiUrl = legacy ? OLD_API_URL : NEW_API_URL;
    const api = configure(apiUrl);
    const result = await api.getAlarmHistory(jwtToken, normalizedMac);
    // Format alarms with human-readable descriptions
    const formattedAlarms = result.alarms.map((alarm) => ({
      ...alarm,
      typeName: AlarmCode[alarm.type] || "UNKNOWN",
      description:
        AlarmDescriptions[alarm.type as AlarmCode] || "Unknown alarm",
      date: new Date(alarm.timestamp * 1000).toISOString(),
    }));
    console.log(
      JSON.stringify({ ...result, alarms: formattedAlarms }, null, 2),
    );
  });

  // Command: register
  addLegacyOption(
    addAuthOptions(
      program
        .command("register")
        .description("Register a device with your account"),
    ),
  )
    .requiredOption("-m, --mac <macAddress>", "MAC address of the device")
    .requiredOption("-s, --serial <serialNumber>", "Device serial number")
    .requiredOption("-n, --name <deviceName>", "Device name")
    .requiredOption("-r, --room <deviceRoom>", "Room name")
    .action(async (options) => {
      const {
        username,
        password,
        mac,
        serial,
        name,
        room,
        legacy = false,
      } = options;
      const normalizedMac = mac.replace(/:/g, "");

      // Initialize file storage for session persistence
      const storage = createFileStorage();
      configureAmplify(storage);

      let jwtToken: string;
      try {
        jwtToken = await getSession(false, legacy);
      } catch {
        if (!username) {
          throw new Error(
            "No session found. Please provide --username to sign in.",
          );
        }
        const pwd = password || (await promptPassword());
        jwtToken = await signIn(username, pwd, legacy);
      }

      const apiUrl = legacy ? OLD_API_URL : NEW_API_URL;
      const api = configure(apiUrl);
      const result = await api.registerDevice(
        jwtToken,
        normalizedMac,
        serial,
        name,
        room,
      );
      console.log("Device registered successfully:");
      console.log(JSON.stringify(result, null, 2));
    });

  // Command: editDevice
  addLegacyOption(
    addMacOption(
      addAuthOptions(
        program
          .command("editDevice")
          .description("Update device name and room"),
      ),
    ),
  )
    .requiredOption("-n, --name <deviceName>", "Device name")
    .requiredOption("-r, --room <deviceRoom>", "Room name")
    .action(async (options) => {
      const { username, password, mac, name, room, legacy = false } = options;
      const normalizedMac = mac.replace(/:/g, "");

      // Initialize file storage for session persistence
      const storage = createFileStorage();
      configureAmplify(storage);

      let jwtToken: string;
      try {
        jwtToken = await getSession(false, legacy);
      } catch {
        if (!username) {
          throw new Error(
            "No session found. Please provide --username to sign in.",
          );
        }
        const pwd = password || (await promptPassword());
        jwtToken = await signIn(username, pwd, legacy);
      }

      const apiUrl = legacy ? OLD_API_URL : NEW_API_URL;
      const api = configure(apiUrl);
      const result = await api.editDevice(jwtToken, normalizedMac, name, room);
      console.log("Device updated successfully:");
      console.log(JSON.stringify(result, null, 2));
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
