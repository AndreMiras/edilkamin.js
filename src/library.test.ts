import { strict as assert } from "assert";
import * as amplifyAuth from "aws-amplify/auth";
import pako from "pako";
import sinon from "sinon";

import {
  configure,
  createAuthService,
  derivePhaseDescription,
  deriveUsageAnalytics,
  getPhaseDescription,
} from "../src/library";
import {
  getIgnitionSubPhaseDescription,
  getOperationalPhaseDescription,
  getStoveStateDescription,
  IgnitionSubPhase,
  OperationalPhase,
  StoveState,
} from "../src/types";
import { API_URL } from "./constants";

/**
 * Helper to create a gzip-compressed Buffer object for testing.
 */
const createGzippedBuffer = (
  data: unknown,
): { type: "Buffer"; data: number[] } => {
  const json = JSON.stringify(data);
  const compressed = pako.gzip(json);
  return {
    type: "Buffer",
    data: Array.from(compressed),
  };
};

/**
 * Helper to create a mock Response object for fetch.
 */
const mockResponse = (data: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    json: () => Promise.resolve(data),
  }) as Response;

describe("library", () => {
  let fetchStub: sinon.SinonStub;
  const expectedToken = "mockJwtToken";

  beforeEach(() => {
    fetchStub = sinon.stub(globalThis, "fetch");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("signIn", () => {
    it("should sign in and return the ID token by default", async () => {
      const expectedUsername = "testuser";
      const expectedPassword = "testpassword";
      const signIn = sinon.stub().resolves({ isSignedIn: true });
      const signOut = sinon.stub();
      const fetchAuthSession = sinon.stub().resolves({
        tokens: {
          idToken: { toString: () => expectedToken },
          accessToken: { toString: () => "accessToken" },
        },
      });
      const authStub = {
        signIn,
        signOut,
        fetchAuthSession,
      };
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const authService = createAuthService(authStub as any);
      const token = await authService.signIn(
        expectedUsername,
        expectedPassword,
      );
      assert.deepEqual(authStub.signOut.args, [[]]);
      assert.deepEqual(signIn.args, [
        [{ username: expectedUsername, password: expectedPassword }],
      ]);
      assert.equal(token, expectedToken);
    });

    it("should sign in and return the access token in legacy mode", async () => {
      const expectedUsername = "testuser";
      const expectedPassword = "testpassword";
      const signIn = sinon.stub().resolves({ isSignedIn: true });
      const signOut = sinon.stub();
      const fetchAuthSession = sinon.stub().resolves({
        tokens: {
          accessToken: { toString: () => expectedToken },
          idToken: { toString: () => "idToken" },
        },
      });
      const authStub = {
        signIn,
        signOut,
        fetchAuthSession,
      };
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const authService = createAuthService(authStub as any);
      const token = await authService.signIn(
        expectedUsername,
        expectedPassword,
        true, // legacy mode
      );
      assert.equal(token, expectedToken);
    });

    it("should throw an error if sign-in fails", async () => {
      const expectedUsername = "testuser";
      const expectedPassword = "testpassword";
      const signIn = sinon.stub().resolves({ isSignedIn: false });
      const signOut = sinon.stub();
      const fetchAuthSession = sinon.stub().resolves({
        tokens: {
          accessToken: { toString: () => expectedToken },
        },
      });
      const authStub = {
        signIn,
        signOut,
        fetchAuthSession,
      };
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const authService = createAuthService(authStub as any);
      await assert.rejects(
        async () => authService.signIn(expectedUsername, expectedPassword),
        {
          name: "AssertionError",
          message: "Sign-in failed",
        },
      );
    });
  });

  describe("getSession", () => {
    it("should return idToken by default", async () => {
      const mockAuth = {
        signIn: sinon.stub().resolves({ isSignedIn: true }),
        signOut: sinon.stub().resolves(),
        fetchAuthSession: sinon.stub().resolves({
          tokens: {
            idToken: { toString: () => "mock-id-token" },
            accessToken: { toString: () => "mock-access-token" },
          },
        }),
      };
      const { getSession, signIn } = createAuthService(
        mockAuth as unknown as typeof amplifyAuth,
      );
      await signIn("user", "pass");
      const token = await getSession();
      assert.equal(token, "mock-id-token");
    });

    it("should return accessToken when legacy=true", async () => {
      const mockAuth = {
        signIn: sinon.stub().resolves({ isSignedIn: true }),
        signOut: sinon.stub().resolves(),
        fetchAuthSession: sinon.stub().resolves({
          tokens: {
            idToken: { toString: () => "mock-id-token" },
            accessToken: { toString: () => "mock-access-token" },
          },
        }),
      };
      const { getSession, signIn } = createAuthService(
        mockAuth as unknown as typeof amplifyAuth,
      );
      await signIn("user", "pass");
      const token = await getSession(false, true);
      assert.equal(token, "mock-access-token");
    });

    it("should throw error when no session exists", async () => {
      const mockAuth = {
        signIn: sinon.stub().resolves({ isSignedIn: true }),
        signOut: sinon.stub().resolves(),
        fetchAuthSession: sinon.stub().resolves({ tokens: null }),
      };
      const { getSession } = createAuthService(
        mockAuth as unknown as typeof amplifyAuth,
      );
      await assert.rejects(async () => getSession(), {
        name: "AssertionError",
        message: "No session found - please sign in first",
      });
    });

    it("should pass forceRefresh to fetchAuthSession", async () => {
      const mockAuth = {
        signIn: sinon.stub().resolves({ isSignedIn: true }),
        signOut: sinon.stub().resolves(),
        fetchAuthSession: sinon.stub().resolves({
          tokens: {
            idToken: { toString: () => "mock-id-token" },
            accessToken: { toString: () => "mock-access-token" },
          },
        }),
      };
      const { getSession, signIn } = createAuthService(
        mockAuth as unknown as typeof amplifyAuth,
      );
      await signIn("user", "pass");
      await getSession(true);
      assert.ok(mockAuth.fetchAuthSession.calledWith({ forceRefresh: true }));
    });
  });

  describe("configure", () => {
    const expectedApi = [
      "deviceInfo",
      "registerDevice",
      "editDevice",
      "setPower",
      "setPowerOff",
      "setPowerOn",
      "getPower",
      "setPowerLevel",
      "getPowerLevel",
      "setFanSpeed",
      "getFanSpeed",
      "setFan1Speed",
      "setFan2Speed",
      "setFan3Speed",
      "getFan1Speed",
      "getFan2Speed",
      "getFan3Speed",
      "setAirkare",
      "setRelax",
      "setStandby",
      "getStandby",
      "setStandbyTime",
      "getStandbyTime",
      "setAuto",
      "getAuto",
      "getEnvironmentTemperature",
      "getTargetTemperature",
      "setTargetTemperature",
      "setEnvironment1Temperature",
      "getEnvironment1Temperature",
      "setEnvironment2Temperature",
      "getEnvironment2Temperature",
      "setEnvironment3Temperature",
      "getEnvironment3Temperature",
      "setMeasureUnit",
      "getMeasureUnit",
      "setLanguage",
      "getLanguage",
      "getPelletInReserve",
      "getPelletAutonomyTime",
      // Phase/state getters
      "getOperationalPhase",
      "getSubOperationalPhase",
      "getStoveState",
      "getActualPower",
      // Statistics getters
      "getTotalCounters",
      "getServiceCounters",
      "getAlarmHistory",
      "getRegenerationData",
      "getServiceTime",
      // Analytics functions
      "getTotalOperatingHours",
      "getPowerDistribution",
      "getServiceStatus",
      "getUsageAnalytics",
    ];
    it("should create API methods with the correct baseURL", async () => {
      const baseURL = "https://example.com/api/";
      fetchStub.resolves(mockResponse({ test: "data" }));
      const api = configure(baseURL);
      assert.deepEqual(Object.keys(api), expectedApi);
      // Verify baseURL is used when making a request
      await api.deviceInfo(expectedToken, "mockMac");
      assert.ok(fetchStub.calledOnce);
      assert.ok(fetchStub.firstCall.args[0].startsWith(baseURL));
    });
    it("should create API methods with the default baseURL", async () => {
      fetchStub.resolves(mockResponse({ test: "data" }));
      const api = configure();
      assert.deepEqual(Object.keys(api), expectedApi);
      // Verify default baseURL is used when making a request
      await api.deviceInfo(expectedToken, "mockMac");
      assert.ok(fetchStub.calledOnce);
      assert.ok(fetchStub.firstCall.args[0].startsWith(API_URL));
    });
  });

  describe("API Methods", () => {
    const mockDeviceInfo = {
      status: {
        commands: {
          power: true,
        },
        temperatures: {
          enviroment: 19,
        },
        flags: {
          is_pellet_in_reserve: false,
        },
        pellet: {
          autonomy_time: 180,
        },
      },
      nvm: {
        user_parameters: {
          enviroment_1_temperature: 22,
          enviroment_2_temperature: 18,
          enviroment_3_temperature: 20,
          manual_power: 3,
          fan_1_ventilation: 2,
          fan_2_ventilation: 3,
          fan_3_ventilation: 4,
          is_standby_active: true,
          standby_waiting_time: 30,
          is_auto: true,
          is_fahrenheit: false,
          language: 2,
        },
      },
    };

    it("should call fetch for deviceInfo", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfo));
      const api = configure("https://example.com/api/");
      const result = await api.deviceInfo(expectedToken, "mockMacAddress");
      assert.ok(fetchStub.calledOnce);
      assert.equal(
        fetchStub.firstCall.args[0],
        "https://example.com/api/device/mockMacAddress/info",
      );
      assert.deepEqual(fetchStub.firstCall.args[1], {
        method: "GET",
        headers: { Authorization: `Bearer ${expectedToken}` },
      });
      assert.deepEqual(result, mockDeviceInfo);
    });

    // Tests for setPowerOn and setPowerOff
    [
      {
        method: "setPowerOn",
        call: (api: ReturnType<typeof configure>) =>
          api.setPowerOn("mockToken", "mockMacAddress"),
        expectedValue: 1,
      },
      {
        method: "setPowerOff",
        call: (api: ReturnType<typeof configure>) =>
          api.setPowerOff("mockToken", "mockMacAddress"),
        expectedValue: 0,
      },
    ].forEach(({ method, call, expectedValue }) => {
      it(`should call fetch for ${method}`, async () => {
        fetchStub.resolves(mockResponse({ success: true }));
        const api = configure("https://example.com/api/");

        // Invoke the method using the mapped call function
        await call(api);
        assert.ok(fetchStub.calledOnce);
        assert.equal(
          fetchStub.firstCall.args[0],
          "https://example.com/api/mqtt/command",
        );
        assert.deepEqual(fetchStub.firstCall.args[1], {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mockToken",
          },
          body: JSON.stringify({
            mac_address: "mockMacAddress",
            name: "power",
            value: expectedValue,
          }),
        });
      });
    });

    const getterTests = [
      {
        method: "getPower",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getPower(token, mac),
        expectedResult: true,
      },
      {
        method: "getPowerLevel",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getPowerLevel(token, mac),
        expectedResult: 3,
      },
      {
        method: "getFan1Speed",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getFan1Speed(token, mac),
        expectedResult: 2,
      },
      {
        method: "getFan2Speed",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getFan2Speed(token, mac),
        expectedResult: 3,
      },
      {
        method: "getFan3Speed",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getFan3Speed(token, mac),
        expectedResult: 4,
      },
      {
        method: "getEnvironmentTemperature",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getEnvironmentTemperature(token, mac),
        expectedResult: 19,
      },
      {
        method: "getTargetTemperature",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getTargetTemperature(token, mac, 1),
        expectedResult: 22,
      },
      {
        method: "getStandby",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getStandby(token, mac),
        expectedResult: true,
      },
      {
        method: "getStandbyTime",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getStandbyTime(token, mac),
        expectedResult: 30,
      },
      {
        method: "getAuto",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getAuto(token, mac),
        expectedResult: true,
      },
      {
        method: "getEnvironment2Temperature",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getEnvironment2Temperature(token, mac),
        expectedResult: 18,
      },
      {
        method: "getEnvironment3Temperature",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getEnvironment3Temperature(token, mac),
        expectedResult: 20,
      },
      {
        method: "getMeasureUnit",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getMeasureUnit(token, mac),
        expectedResult: false,
      },
      {
        method: "getLanguage",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getLanguage(token, mac),
        expectedResult: 2,
      },
      {
        method: "getPelletInReserve",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getPelletInReserve(token, mac),
        expectedResult: false,
      },
      {
        method: "getPelletAutonomyTime",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getPelletAutonomyTime(token, mac),
        expectedResult: 180,
      },
    ];
    getterTests.forEach(({ method, call, expectedResult }) => {
      it(`should call fetch and return the correct value for ${method}`, async () => {
        fetchStub.resolves(mockResponse(mockDeviceInfo));
        const api = configure("https://example.com/api/");

        const result = await call(api, expectedToken, "mockMacAddress");

        assert.ok(fetchStub.calledOnce);
        assert.equal(
          fetchStub.firstCall.args[0],
          "https://example.com/api/device/mockMacAddress/info",
        );
        assert.deepEqual(fetchStub.firstCall.args[1], {
          method: "GET",
          headers: { Authorization: `Bearer ${expectedToken}` },
        });
        assert.equal(result, expectedResult);
      });
    });
    // Setter tests
    const setterTests = [
      {
        method: "setPowerLevel",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setPowerLevel(token, mac, value),
        payload: {
          name: "power_level",
          value: 4,
        },
      },
      {
        method: "setFan1Speed",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setFan1Speed(token, mac, value),
        payload: {
          name: "fan_1_speed",
          value: 3,
        },
      },
      {
        method: "setFan2Speed",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setFan2Speed(token, mac, value),
        payload: {
          name: "fan_2_speed",
          value: 4,
        },
      },
      {
        method: "setFan3Speed",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setFan3Speed(token, mac, value),
        payload: {
          name: "fan_3_speed",
          value: 5,
        },
      },
      {
        method: "setTargetTemperature",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setTargetTemperature(token, mac, 1, value),
        payload: {
          name: "enviroment_1_temperature",
          value: 20,
        },
      },
      {
        method: "setStandbyTime",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setStandbyTime(token, mac, value),
        payload: {
          name: "standby_time",
          value: 45,
        },
      },
      {
        method: "setEnvironment2Temperature",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setEnvironment2Temperature(token, mac, value),
        payload: {
          name: "enviroment_2_temperature",
          value: 21,
        },
      },
      {
        method: "setEnvironment3Temperature",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setEnvironment3Temperature(token, mac, value),
        payload: {
          name: "enviroment_3_temperature",
          value: 23,
        },
      },
      {
        method: "setLanguage",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setLanguage(token, mac, value),
        payload: {
          name: "language",
          value: 2,
        },
      },
    ];
    setterTests.forEach(({ method, call, payload }) => {
      it(`should call fetch and send the correct payload for ${method}`, async () => {
        fetchStub.resolves(mockResponse({ success: true }));
        const api = configure("https://example.com/api/");

        await call(api, expectedToken, "mockMacAddress", payload.value);

        assert.ok(fetchStub.calledOnce);
        assert.equal(
          fetchStub.firstCall.args[0],
          "https://example.com/api/mqtt/command",
        );
        assert.deepEqual(fetchStub.firstCall.args[1], {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${expectedToken}`,
          },
          body: JSON.stringify({
            mac_address: "mockMacAddress",
            ...payload,
          }),
        });
      });
    });

    // Boolean setter tests (for mode controls)
    const booleanSetterTests = [
      {
        method: "setAirkare",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          enabled: boolean,
        ) => api.setAirkare(token, mac, enabled),
        truePayload: { name: "airkare_function", value: 1 },
        falsePayload: { name: "airkare_function", value: 0 },
      },
      {
        method: "setRelax",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          enabled: boolean,
        ) => api.setRelax(token, mac, enabled),
        truePayload: { name: "relax_mode", value: true },
        falsePayload: { name: "relax_mode", value: false },
      },
      {
        method: "setStandby",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          enabled: boolean,
        ) => api.setStandby(token, mac, enabled),
        truePayload: { name: "standby_mode", value: true },
        falsePayload: { name: "standby_mode", value: false },
      },
      {
        method: "setAuto",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          enabled: boolean,
        ) => api.setAuto(token, mac, enabled),
        truePayload: { name: "auto_mode", value: true },
        falsePayload: { name: "auto_mode", value: false },
      },
      {
        method: "setMeasureUnit",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          enabled: boolean,
        ) => api.setMeasureUnit(token, mac, enabled),
        truePayload: { name: "measure_unit", value: true },
        falsePayload: { name: "measure_unit", value: false },
      },
    ];
    booleanSetterTests.forEach(
      ({ method, call, truePayload, falsePayload }) => {
        it(`should call fetch with correct payload for ${method}(true)`, async () => {
          fetchStub.resolves(mockResponse({ success: true }));
          const api = configure("https://example.com/api/");

          await call(api, expectedToken, "mockMacAddress", true);

          assert.ok(fetchStub.calledOnce);
          assert.deepEqual(fetchStub.firstCall.args[1], {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${expectedToken}`,
            },
            body: JSON.stringify({
              mac_address: "mockMacAddress",
              ...truePayload,
            }),
          });
        });

        it(`should call fetch with correct payload for ${method}(false)`, async () => {
          fetchStub.resolves(mockResponse({ success: true }));
          const api = configure("https://example.com/api/");

          await call(api, expectedToken, "mockMacAddress", false);

          assert.ok(fetchStub.calledOnce);
          assert.deepEqual(fetchStub.firstCall.args[1], {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${expectedToken}`,
            },
            body: JSON.stringify({
              mac_address: "mockMacAddress",
              ...falsePayload,
            }),
          });
        });
      },
    );
  });

  describe("registerDevice", () => {
    it("should call POST /device with correct payload", async () => {
      const mockResponseData = {
        macAddress: "AABBCCDDEEFF",
        deviceName: "Test Stove",
        deviceRoom: "Living Room",
        serialNumber: "EDK123",
      };
      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.registerDevice(
        expectedToken,
        "AA:BB:CC:DD:EE:FF",
        "EDK123",
        "Test Stove",
        "Living Room",
      );

      assert.ok(fetchStub.calledOnce);
      assert.equal(
        fetchStub.firstCall.args[0],
        "https://example.com/api/device",
      );
      assert.deepEqual(fetchStub.firstCall.args[1], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${expectedToken}`,
        },
        body: JSON.stringify({
          macAddress: "aabbccddeeff",
          deviceName: "Test Stove",
          deviceRoom: "Living Room",
          serialNumber: "EDK123",
        }),
      });
      assert.deepEqual(result, mockResponseData);
    });

    it("should normalize MAC address by removing colons and converting to lowercase", async () => {
      fetchStub.resolves(mockResponse({}));
      const api = configure("https://example.com/api/");

      await api.registerDevice(expectedToken, "AA:BB:CC:DD:EE:FF", "EDK123");

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.equal(body.macAddress, "aabbccddeeff");
    });

    it("should use empty strings as defaults for name and room", async () => {
      fetchStub.resolves(mockResponse({}));
      const api = configure("https://example.com/api/");

      await api.registerDevice(expectedToken, "AABBCCDDEEFF", "EDK123");

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.equal(body.deviceName, "");
      assert.equal(body.deviceRoom, "");
    });
  });

  describe("editDevice", () => {
    it("should call PUT /device/{mac} with correct payload", async () => {
      const mockResponseData = {
        macAddress: "AABBCCDDEEFF",
        deviceName: "Updated Name",
        deviceRoom: "Basement",
        serialNumber: "EDK123",
      };
      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.editDevice(
        expectedToken,
        "AA:BB:CC:DD:EE:FF",
        "Updated Name",
        "Basement",
      );

      assert.ok(fetchStub.calledOnce);
      assert.equal(
        fetchStub.firstCall.args[0],
        "https://example.com/api/device/aabbccddeeff",
      );
      assert.deepEqual(fetchStub.firstCall.args[1], {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${expectedToken}`,
        },
        body: JSON.stringify({
          deviceName: "Updated Name",
          deviceRoom: "Basement",
        }),
      });
      assert.deepEqual(result, mockResponseData);
    });

    it("should use empty strings as defaults for name and room", async () => {
      fetchStub.resolves(mockResponse({}));
      const api = configure("https://example.com/api/");

      await api.editDevice(expectedToken, "AABBCCDDEEFF");

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.equal(body.deviceName, "");
      assert.equal(body.deviceRoom, "");
    });
  });

  describe("deviceInfo with compressed responses", () => {
    it("should decompress Buffer-encoded status field", async () => {
      const statusData = {
        commands: { power: true },
        temperatures: { enviroment: 19, board: 25 },
      };
      const mockResponseData = {
        status: createGzippedBuffer(statusData),
        nvm: {
          user_parameters: {
            enviroment_1_temperature: 22,
          },
        },
      };

      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.deviceInfo(expectedToken, "mockMacAddress");

      assert.deepEqual(result.status, statusData);
    });

    it("should decompress Buffer-encoded nvm field", async () => {
      const nvmData = {
        user_parameters: {
          enviroment_1_temperature: 22,
          enviroment_2_temperature: 0,
          enviroment_3_temperature: 0,
          is_auto: false,
          is_sound_active: true,
        },
      };
      const mockResponseData = {
        status: {
          commands: { power: true },
          temperatures: { enviroment: 19 },
        },
        nvm: createGzippedBuffer(nvmData),
      };

      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.deviceInfo(expectedToken, "mockMacAddress");

      assert.deepEqual(result.nvm, nvmData);
    });

    it("should handle fully compressed response (status and nvm)", async () => {
      const statusData = {
        commands: { power: false },
        temperatures: { enviroment: 21, board: 30 },
      };
      const nvmData = {
        user_parameters: {
          enviroment_1_temperature: 20,
          enviroment_2_temperature: 0,
          enviroment_3_temperature: 0,
          is_auto: true,
          is_sound_active: false,
        },
      };
      const mockResponseData = {
        status: createGzippedBuffer(statusData),
        nvm: createGzippedBuffer(nvmData),
      };

      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.deviceInfo(expectedToken, "mockMacAddress");

      assert.deepEqual(result.status, statusData);
      assert.deepEqual(result.nvm, nvmData);
    });

    it("should work with getPower on compressed response", async () => {
      const statusData = {
        commands: { power: true },
        temperatures: { enviroment: 19 },
      };
      const mockResponseData = {
        status: createGzippedBuffer(statusData),
        nvm: { user_parameters: { enviroment_1_temperature: 22 } },
      };

      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.getPower(expectedToken, "mockMacAddress");

      assert.equal(result, true);
    });

    it("should work with getEnvironmentTemperature on compressed response", async () => {
      const statusData = {
        commands: { power: true },
        temperatures: { enviroment: 19, board: 25 },
      };
      const mockResponseData = {
        status: createGzippedBuffer(statusData),
        nvm: { user_parameters: { enviroment_1_temperature: 22 } },
      };

      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.getEnvironmentTemperature(
        expectedToken,
        "mockMacAddress",
      );

      assert.equal(result, 19);
    });

    it("should work with getTargetTemperature on compressed response", async () => {
      const nvmData = {
        user_parameters: {
          enviroment_1_temperature: 22,
        },
      };
      const mockResponseData = {
        status: { commands: { power: true }, temperatures: { enviroment: 19 } },
        nvm: createGzippedBuffer(nvmData),
      };

      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.getTargetTemperature(
        expectedToken,
        "mockMacAddress",
        1,
      );

      assert.equal(result, 22);
    });

    it("should work with getPelletInReserve on compressed response", async () => {
      const statusData = {
        commands: { power: true },
        temperatures: { enviroment: 19 },
        flags: { is_pellet_in_reserve: true },
        pellet: { autonomy_time: 120 },
      };
      const mockResponseData = {
        status: createGzippedBuffer(statusData),
        nvm: { user_parameters: { enviroment_1_temperature: 22 } },
      };

      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.getPelletInReserve(
        expectedToken,
        "mockMacAddress",
      );

      assert.equal(result, true);
    });

    it("should work with getPelletAutonomyTime on response", async () => {
      const mockResponseData = {
        status: {
          commands: { power: true },
          temperatures: { enviroment: 19 },
          flags: { is_pellet_in_reserve: false },
          pellet: { autonomy_time: 240 },
        },
        nvm: { user_parameters: { enviroment_1_temperature: 22 } },
      };

      fetchStub.resolves(mockResponse(mockResponseData));
      const api = configure("https://example.com/api/");

      const result = await api.getPelletAutonomyTime(
        expectedToken,
        "mockMacAddress",
      );

      assert.equal(result, 240);
    });
  });

  describe("statistics getters", () => {
    const mockDeviceInfoWithStats = {
      status: {
        commands: { power: true },
        temperatures: { board: 25, enviroment: 20 },
        flags: { is_pellet_in_reserve: false },
        pellet: { autonomy_time: 900 },
        counters: { service_time: 1108 },
      },
      nvm: {
        user_parameters: {
          language: 1,
          is_auto: false,
          is_fahrenheit: false,
          is_sound_active: false,
          enviroment_1_temperature: 19,
          enviroment_2_temperature: 20,
          enviroment_3_temperature: 20,
          manual_power: 1,
          fan_1_ventilation: 3,
          fan_2_ventilation: 0,
          fan_3_ventilation: 0,
          is_standby_active: false,
          standby_waiting_time: 60,
        },
        total_counters: {
          power_ons: 278,
          p1_working_time: 833,
          p2_working_time: 15,
          p3_working_time: 19,
          p4_working_time: 8,
          p5_working_time: 17,
        },
        service_counters: {
          p1_working_time: 100,
          p2_working_time: 10,
          p3_working_time: 5,
          p4_working_time: 2,
          p5_working_time: 1,
        },
        alarms_log: {
          number: 2,
          index: 2,
          alarms: [
            { type: 3, timestamp: 1700000000 },
            { type: 21, timestamp: 1700001000 },
          ],
        },
        regeneration: {
          time: 0,
          last_intervention: 1577836800,
          daylight_time_flag: 0,
          blackout_counter: 43,
          airkare_working_hours_counter: 0,
        },
      },
    };

    it("should get total counters", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getTotalCounters(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.deepEqual(result, mockDeviceInfoWithStats.nvm.total_counters);
    });

    it("should get service counters", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getServiceCounters(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.deepEqual(result, mockDeviceInfoWithStats.nvm.service_counters);
    });

    it("should get alarm history", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getAlarmHistory(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.deepEqual(result, mockDeviceInfoWithStats.nvm.alarms_log);
    });

    it("should get regeneration data", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getRegenerationData(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.deepEqual(result, mockDeviceInfoWithStats.nvm.regeneration);
    });

    it("should get service time", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getServiceTime(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.equal(result, 1108);
    });
  });

  describe("analytics functions", () => {
    const mockDeviceInfoWithStats = {
      status: {
        commands: { power: true },
        temperatures: { board: 25, enviroment: 20 },
        flags: { is_pellet_in_reserve: false },
        pellet: { autonomy_time: 900 },
        counters: { service_time: 1108 },
      },
      nvm: {
        user_parameters: {
          language: 1,
          is_auto: false,
          is_fahrenheit: false,
          is_sound_active: false,
          enviroment_1_temperature: 19,
          enviroment_2_temperature: 20,
          enviroment_3_temperature: 20,
          manual_power: 1,
          fan_1_ventilation: 3,
          fan_2_ventilation: 0,
          fan_3_ventilation: 0,
          is_standby_active: false,
          standby_waiting_time: 60,
        },
        total_counters: {
          power_ons: 278,
          p1_working_time: 833,
          p2_working_time: 15,
          p3_working_time: 19,
          p4_working_time: 8,
          p5_working_time: 17,
        },
        service_counters: {
          p1_working_time: 100,
          p2_working_time: 10,
          p3_working_time: 5,
          p4_working_time: 2,
          p5_working_time: 1,
        },
        alarms_log: {
          number: 2,
          index: 2,
          alarms: [
            { type: 3, timestamp: 1700000000 },
            { type: 21, timestamp: 1700001000 },
          ],
        },
        regeneration: {
          time: 0,
          last_intervention: 1577836800,
          daylight_time_flag: 0,
          blackout_counter: 43,
          airkare_working_hours_counter: 0,
        },
      },
    };

    it("should calculate total operating hours", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getTotalOperatingHours(
        expectedToken,
        "00:11:22:33:44:55",
      );
      // 833 + 15 + 19 + 8 + 17 = 892
      assert.equal(result, 892);
    });

    it("should calculate power distribution percentages", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getPowerDistribution(
        expectedToken,
        "00:11:22:33:44:55",
      );
      // Total: 892 hours
      assert.ok(result.p1 > 90); // 833/892 = 93.4%
      assert.ok(result.p2 < 5); // 15/892 = 1.7%
      // Sum should be ~100%
      const sum = result.p1 + result.p2 + result.p3 + result.p4 + result.p5;
      assert.ok(Math.abs(sum - 100) < 0.1);
    });

    it("should handle zero operating hours in power distribution", async () => {
      const zeroHoursInfo = {
        ...mockDeviceInfoWithStats,
        nvm: {
          ...mockDeviceInfoWithStats.nvm,
          total_counters: {
            power_ons: 0,
            p1_working_time: 0,
            p2_working_time: 0,
            p3_working_time: 0,
            p4_working_time: 0,
            p5_working_time: 0,
          },
        },
      };
      fetchStub.resolves(mockResponse(zeroHoursInfo));
      const api = configure(API_URL);
      const result = await api.getPowerDistribution(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.deepEqual(result, { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 });
    });

    it("should calculate service status", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getServiceStatus(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.equal(result.totalServiceHours, 1108);
      // 100 + 10 + 5 + 2 + 1 = 118 hours since service
      assert.equal(result.hoursSinceService, 118);
      assert.equal(result.isServiceDue, false); // 118 < 2000
    });

    it("should indicate service is due when threshold exceeded", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      // Use threshold of 100 hours
      const result = await api.getServiceStatus(
        expectedToken,
        "00:11:22:33:44:55",
        100,
      );
      assert.equal(result.isServiceDue, true); // 118 >= 100
    });

    it("should get comprehensive usage analytics", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithStats));
      const api = configure(API_URL);
      const result = await api.getUsageAnalytics(
        expectedToken,
        "00:11:22:33:44:55",
      );

      assert.equal(result.totalPowerOns, 278);
      assert.equal(result.totalOperatingHours, 892);
      assert.equal(result.blackoutCount, 43);
      assert.equal(result.alarmCount, 2);
      assert.ok(result.lastMaintenanceDate instanceof Date);
      assert.equal(result.serviceStatus.isServiceDue, false);
    });

    it("should handle null lastMaintenanceDate when timestamp is 0", async () => {
      const noMaintenanceInfo = {
        ...mockDeviceInfoWithStats,
        nvm: {
          ...mockDeviceInfoWithStats.nvm,
          regeneration: {
            ...mockDeviceInfoWithStats.nvm.regeneration,
            last_intervention: 0,
          },
        },
      };
      fetchStub.resolves(mockResponse(noMaintenanceInfo));
      const api = configure(API_URL);
      const result = await api.getUsageAnalytics(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.equal(result.lastMaintenanceDate, null);
    });
  });

  describe("deriveUsageAnalytics", () => {
    const mockDeviceInfoForDerive = {
      status: {
        commands: {
          power: false,
        },
        temperatures: {
          enviroment: 20,
          set_air: 21,
          get_air: 20,
          set_water: 40,
          get_water: 35,
        },
        counters: {
          service_time: 1108,
        },
        flags: {
          is_pellet_in_reserve: false,
        },
        pellet: {
          autonomy_time: 180,
        },
      },
      nvm: {
        user_parameters: {
          language: 1,
          is_auto: false,
          is_fahrenheit: false,
          is_sound_active: false,
          enviroment_1_temperature: 19,
          enviroment_2_temperature: 20,
          enviroment_3_temperature: 20,
          manual_power: 1,
          fan_1_ventilation: 3,
          fan_2_ventilation: 0,
          fan_3_ventilation: 0,
          is_standby_active: false,
          standby_waiting_time: 60,
        },
        total_counters: {
          power_ons: 278,
          p1_working_time: 833,
          p2_working_time: 15,
          p3_working_time: 19,
          p4_working_time: 8,
          p5_working_time: 17,
        },
        service_counters: {
          p1_working_time: 100,
          p2_working_time: 10,
          p3_working_time: 5,
          p4_working_time: 2,
          p5_working_time: 1,
        },
        regeneration: {
          time: 0,
          last_intervention: 1577836800,
          daylight_time_flag: 0,
          blackout_counter: 43,
          airkare_working_hours_counter: 0,
        },
        alarms_log: {
          number: 6,
          index: 6,
          alarms: [],
        },
      },
    };

    it("should derive analytics from device info without API call", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analytics = deriveUsageAnalytics(mockDeviceInfoForDerive as any);

      assert.equal(analytics.totalPowerOns, 278);
      assert.equal(analytics.totalOperatingHours, 892); // 833+15+19+8+17
      assert.equal(analytics.blackoutCount, 43);
      assert.equal(analytics.alarmCount, 6);
    });

    it("should calculate power distribution correctly", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analytics = deriveUsageAnalytics(mockDeviceInfoForDerive as any);

      // P1: 833/892 ≈ 93.4%
      assert.ok(analytics.powerDistribution.p1 > 93);
      assert.ok(analytics.powerDistribution.p1 < 94);

      // Sum should be 100%
      const sum = Object.values(analytics.powerDistribution).reduce(
        (a, b) => a + b,
        0,
      );
      assert.ok(Math.abs(sum - 100) < 0.001);
    });

    it("should handle zero operating hours", () => {
      const zeroHoursInfo = {
        ...mockDeviceInfoForDerive,
        nvm: {
          ...mockDeviceInfoForDerive.nvm,
          total_counters: {
            power_ons: 0,
            p1_working_time: 0,
            p2_working_time: 0,
            p3_working_time: 0,
            p4_working_time: 0,
            p5_working_time: 0,
          },
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analytics = deriveUsageAnalytics(zeroHoursInfo as any);
      assert.deepEqual(analytics.powerDistribution, {
        p1: 0,
        p2: 0,
        p3: 0,
        p4: 0,
        p5: 0,
      });
    });

    it("should respect custom service threshold", () => {
      const analytics = deriveUsageAnalytics(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockDeviceInfoForDerive as any,
        100,
      );

      // 118 hours since service >= 100 threshold
      assert.equal(analytics.serviceStatus.isServiceDue, true);
      assert.equal(analytics.serviceStatus.serviceThresholdHours, 100);
    });

    it("should use default threshold of 2000 hours", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analytics = deriveUsageAnalytics(mockDeviceInfoForDerive as any);

      assert.equal(analytics.serviceStatus.serviceThresholdHours, 2000);
      assert.equal(analytics.serviceStatus.isServiceDue, false); // 118 < 2000
    });

    it("should convert last_intervention timestamp to Date", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analytics = deriveUsageAnalytics(mockDeviceInfoForDerive as any);

      assert.ok(analytics.lastMaintenanceDate instanceof Date);
      assert.equal(analytics.lastMaintenanceDate?.getTime(), 1577836800 * 1000);
    });

    it("should return null for lastMaintenanceDate when timestamp is 0", () => {
      const noMaintenanceInfo = {
        ...mockDeviceInfoForDerive,
        nvm: {
          ...mockDeviceInfoForDerive.nvm,
          regeneration: {
            ...mockDeviceInfoForDerive.nvm.regeneration,
            last_intervention: 0,
          },
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analytics = deriveUsageAnalytics(noMaintenanceInfo as any);
      assert.equal(analytics.lastMaintenanceDate, null);
    });
  });

  describe("phase getters", () => {
    const mockDeviceInfoWithState = {
      status: {
        commands: { power: true },
        temperatures: { board: 25, enviroment: 20 },
        flags: { is_pellet_in_reserve: false },
        pellet: { autonomy_time: 900 },
        counters: { service_time: 1108 },
        state: {
          operational_phase: 2,
          sub_operational_phase: 3,
          stove_state: 4,
          alarm_type: 0,
          actual_power: 3,
        },
        fans: { fan_1_speed: 3, fan_2_speed: 0, fan_3_speed: 0 },
      },
      nvm: {
        user_parameters: {
          language: 1,
          is_auto: false,
          is_fahrenheit: false,
          is_sound_active: false,
          enviroment_1_temperature: 19,
          enviroment_2_temperature: 20,
          enviroment_3_temperature: 20,
          manual_power: 1,
          fan_1_ventilation: 3,
          fan_2_ventilation: 0,
          fan_3_ventilation: 0,
          is_standby_active: false,
          standby_waiting_time: 60,
        },
        total_counters: {
          power_ons: 278,
          p1_working_time: 833,
          p2_working_time: 15,
          p3_working_time: 19,
          p4_working_time: 8,
          p5_working_time: 17,
        },
        service_counters: {
          p1_working_time: 100,
          p2_working_time: 10,
          p3_working_time: 5,
          p4_working_time: 2,
          p5_working_time: 1,
        },
        alarms_log: {
          number: 2,
          index: 2,
          alarms: [],
        },
        regeneration: {
          time: 0,
          last_intervention: 1577836800,
          daylight_time_flag: 0,
          blackout_counter: 43,
          airkare_working_hours_counter: 0,
        },
      },
    };

    it("should get operational phase", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithState));
      const api = configure(API_URL);
      const result = await api.getOperationalPhase(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.equal(result, 2);
    });

    it("should get sub-operational phase", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithState));
      const api = configure(API_URL);
      const result = await api.getSubOperationalPhase(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.equal(result, 3);
    });

    it("should get stove state", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithState));
      const api = configure(API_URL);
      const result = await api.getStoveState(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.equal(result, 4);
    });

    it("should get actual power", async () => {
      fetchStub.resolves(mockResponse(mockDeviceInfoWithState));
      const api = configure(API_URL);
      const result = await api.getActualPower(
        expectedToken,
        "00:11:22:33:44:55",
      );
      assert.equal(result, 3);
    });
  });

  describe("getPhaseDescription", () => {
    it("should return 'Off' for phase 0", () => {
      assert.equal(getPhaseDescription(0, 0), "Off");
    });

    it("should return 'Ignition' with sub-phase for phase 1", () => {
      assert.equal(getPhaseDescription(1, 0), "Ignition - Hot stove cleaning");
    });

    it("should return 'On' for phase 2", () => {
      assert.equal(getPhaseDescription(2, 0), "On");
    });

    it("should return 'Shutting down' for phase 3", () => {
      assert.equal(getPhaseDescription(3, 0), "Shutting down");
    });

    it("should return 'Cooling' for phase 4", () => {
      assert.equal(getPhaseDescription(4, 0), "Cooling");
    });

    it("should return 'Final cleaning' for phase 5", () => {
      assert.equal(getPhaseDescription(5, 0), "Final cleaning");
    });

    it("should return combined description for ignition phase", () => {
      assert.equal(getPhaseDescription(1, 0), "Ignition - Hot stove cleaning");
      assert.equal(
        getPhaseDescription(1, 1),
        "Ignition - Cleaning without cleaner",
      );
      assert.equal(
        getPhaseDescription(1, 2),
        "Ignition - Cleaning with cleaner",
      );
      assert.equal(getPhaseDescription(1, 3), "Ignition - Pellet load");
      assert.equal(getPhaseDescription(1, 4), "Ignition - Loading break");
      assert.equal(
        getPhaseDescription(1, 5),
        "Ignition - Smoke temperature check",
      );
      assert.equal(getPhaseDescription(1, 6), "Ignition - Threshold check");
      assert.equal(getPhaseDescription(1, 7), "Ignition - Warmup");
    });

    it("should return fallback for unknown operational phase", () => {
      assert.equal(getPhaseDescription(99, 0), "Unknown phase (99)");
    });

    it("should return fallback for unknown ignition sub-phase", () => {
      assert.equal(
        getPhaseDescription(1, 99),
        "Ignition - Unknown sub-phase (99)",
      );
    });
  });

  describe("derivePhaseDescription", () => {
    it("should derive phase description from device info", () => {
      const mockDeviceInfo = {
        status: {
          commands: { power: true },
          temperatures: { board: 25, enviroment: 22 },
          flags: { is_pellet_in_reserve: true },
          pellet: { autonomy_time: 120 },
          counters: { service_time: 100 },
          state: {
            operational_phase: 1, // IGNITION
            sub_operational_phase: 7, // WARMUP
            stove_state: 5,
            alarm_type: 0,
            actual_power: 3,
          },
          fans: { fan_1_speed: 3, fan_2_speed: 0, fan_3_speed: 0 },
        },
        nvm: {
          user_parameters: {},
          total_counters: {},
          service_counters: {},
          alarms_log: { number: 0, index: 0, alarms: [] },
          regeneration: {},
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const desc = derivePhaseDescription(mockDeviceInfo as any);
      assert.equal(desc, "Ignition - Warmup");
    });

    it("should return 'On' for device in On state", () => {
      const mockDeviceInfo = {
        status: {
          commands: { power: true },
          temperatures: { board: 25, enviroment: 22 },
          flags: { is_pellet_in_reserve: false },
          pellet: { autonomy_time: 120 },
          counters: { service_time: 100 },
          state: {
            operational_phase: 2, // ON
            sub_operational_phase: 0,
            stove_state: 6,
            alarm_type: 0,
            actual_power: 3,
          },
          fans: { fan_1_speed: 3, fan_2_speed: 0, fan_3_speed: 0 },
        },
        nvm: {
          user_parameters: {},
          total_counters: {},
          service_counters: {},
          alarms_log: { number: 0, index: 0, alarms: [] },
          regeneration: {},
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const desc = derivePhaseDescription(mockDeviceInfo as any);
      assert.equal(desc, "On");
    });
  });

  describe("OperationalPhase descriptions", () => {
    it("should return descriptions for known phases", () => {
      assert.equal(getOperationalPhaseDescription(OperationalPhase.OFF), "Off");
      assert.equal(
        getOperationalPhaseDescription(OperationalPhase.IGNITION),
        "Ignition",
      );
      assert.equal(getOperationalPhaseDescription(OperationalPhase.ON), "On");
      assert.equal(
        getOperationalPhaseDescription(OperationalPhase.SHUTTING_DOWN),
        "Shutting down",
      );
      assert.equal(
        getOperationalPhaseDescription(OperationalPhase.COOLING),
        "Cooling",
      );
      assert.equal(
        getOperationalPhaseDescription(OperationalPhase.FINAL_CLEANING),
        "Final cleaning",
      );
    });

    it("should return fallback for unknown phases", () => {
      assert.equal(getOperationalPhaseDescription(6), "Unknown phase (6)");
      assert.equal(getOperationalPhaseDescription(99), "Unknown phase (99)");
    });
  });

  describe("IgnitionSubPhase descriptions", () => {
    it("should return descriptions for all ignition sub-phases", () => {
      assert.equal(
        getIgnitionSubPhaseDescription(IgnitionSubPhase.HOT_STOVE_CLEANING),
        "Hot stove cleaning",
      );
      assert.equal(
        getIgnitionSubPhaseDescription(
          IgnitionSubPhase.CLEANING_WITHOUT_CLEANER,
        ),
        "Cleaning without cleaner",
      );
      assert.equal(
        getIgnitionSubPhaseDescription(IgnitionSubPhase.CLEANING_WITH_CLEANER),
        "Cleaning with cleaner",
      );
      assert.equal(
        getIgnitionSubPhaseDescription(IgnitionSubPhase.PELLET_LOAD),
        "Pellet load",
      );
      assert.equal(
        getIgnitionSubPhaseDescription(IgnitionSubPhase.LOADING_BREAK),
        "Loading break",
      );
      assert.equal(
        getIgnitionSubPhaseDescription(IgnitionSubPhase.SMOKE_TEMP_CHECK),
        "Smoke temperature check",
      );
      assert.equal(
        getIgnitionSubPhaseDescription(IgnitionSubPhase.THRESHOLD_CHECK),
        "Threshold check",
      );
      assert.equal(
        getIgnitionSubPhaseDescription(IgnitionSubPhase.WARMUP),
        "Warmup",
      );
    });

    it("should return fallback for unknown sub-phases", () => {
      assert.equal(
        getIgnitionSubPhaseDescription(99),
        "Unknown sub-phase (99)",
      );
    });
  });

  describe("StoveState descriptions", () => {
    it("should return descriptions for known states", () => {
      assert.equal(getStoveStateDescription(StoveState.OFF), "Off");
      assert.equal(getStoveStateDescription(StoveState.STANDBY), "Standby");
      assert.equal(
        getStoveStateDescription(StoveState.IGNITION_CLEANING),
        "Ignition - Cleaning",
      );
      assert.equal(
        getStoveStateDescription(StoveState.IGNITION_LOADING),
        "Ignition - Loading pellets",
      );
      assert.equal(
        getStoveStateDescription(StoveState.IGNITION_WAITING),
        "Ignition - Waiting",
      );
      assert.equal(
        getStoveStateDescription(StoveState.IGNITION_WARMUP),
        "Ignition - Warming up",
      );
      assert.equal(getStoveStateDescription(StoveState.ON), "On");
      assert.equal(
        getStoveStateDescription(StoveState.COOLING),
        "Cooling down",
      );
      assert.equal(getStoveStateDescription(StoveState.ALARM), "Alarm");
    });

    it("should return fallback for unknown states", () => {
      assert.equal(getStoveStateDescription(99), "Unknown state (99)");
    });
  });

  describe("Error Handling", () => {
    const errorTests = [
      { status: 400, statusText: "Bad Request" },
      { status: 401, statusText: "Unauthorized" },
      { status: 404, statusText: "Not Found" },
      { status: 500, statusText: "Internal Server Error" },
    ];

    errorTests.forEach(({ status, statusText }) => {
      it(`should throw error when fetch returns ${status}`, async () => {
        const errorResponse = {
          ok: false,
          status,
          statusText,
          json: () => Promise.resolve({ error: statusText }),
        } as Response;
        fetchStub.resolves(errorResponse);
        const api = configure("https://example.com/api/");

        await assert.rejects(
          async () => api.deviceInfo(expectedToken, "mockMac"),
          {
            message: `HTTP ${status}: ${statusText}`,
          },
        );
      });
    });
  });
});
