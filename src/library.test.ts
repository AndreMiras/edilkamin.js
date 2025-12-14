import { strict as assert } from "assert";
import * as amplifyAuth from "aws-amplify/auth";
import pako from "pako";
import sinon from "sinon";

import { configure, createAuthService } from "../src/library";
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
      "getEnvironmentTemperature",
      "getTargetTemperature",
      "setTargetTemperature",
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
      },
      nvm: {
        user_parameters: {
          enviroment_1_temperature: 22,
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
        method: "getEnvironmentTemperature",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getEnvironmentTemperature(token, mac),
        expectedResult: 19,
      },
      {
        method: "getTargetTemperature",
        call: (api: ReturnType<typeof configure>, token: string, mac: string) =>
          api.getTargetTemperature(token, mac),
        expectedResult: 22,
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
        method: "setTargetTemperature",
        call: (
          api: ReturnType<typeof configure>,
          token: string,
          mac: string,
          value: number,
        ) => api.setTargetTemperature(token, mac, value),
        payload: {
          name: "enviroment_1_temperature",
          value: 20,
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
          macAddress: "AABBCCDDEEFF",
          deviceName: "Test Stove",
          deviceRoom: "Living Room",
          serialNumber: "EDK123",
        }),
      });
      assert.deepEqual(result, mockResponseData);
    });

    it("should normalize MAC address by removing colons", async () => {
      fetchStub.resolves(mockResponse({}));
      const api = configure("https://example.com/api/");

      await api.registerDevice(expectedToken, "AA:BB:CC:DD:EE:FF", "EDK123");

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.equal(body.macAddress, "AABBCCDDEEFF");
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
        "https://example.com/api/device/AABBCCDDEEFF",
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
      );

      assert.equal(result, 22);
    });
  });
});
