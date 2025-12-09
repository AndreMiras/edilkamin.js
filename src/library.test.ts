import { strict as assert } from "assert";
import * as amplifyAuth from "aws-amplify/auth";
import axios from "axios";
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

describe("library", () => {
  let axiosStub: sinon.SinonStub;
  const expectedToken = "mockJwtToken";

  beforeEach(() => {
    axiosStub = sinon.stub(axios, "create").returns({
      get: sinon.stub(),
      put: sinon.stub(),
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    } as any);
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
    it("should create API methods with the correct baseURL", () => {
      const baseURL = "https://example.com/api";
      const api = configure(baseURL);
      assert.deepEqual(axiosStub.args, [
        [
          {
            baseURL,
          },
        ],
      ]);
      assert.deepEqual(Object.keys(api), expectedApi);
    });
    it("should create API methods with the default baseURL", () => {
      const api = configure();
      assert.deepEqual(axiosStub.args, [
        [
          {
            baseURL: API_URL,
          },
        ],
      ]);
      assert.deepEqual(Object.keys(api), expectedApi);
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

    it("should call axios for deviceInfo", async () => {
      const mockAxios = {
        get: sinon.stub().resolves({ data: mockDeviceInfo }),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");
      const result = await api.deviceInfo(expectedToken, "mockMacAddress");
      assert.deepEqual(mockAxios.get.args, [
        [
          "device/mockMacAddress/info",
          { headers: { Authorization: `Bearer ${expectedToken}` } },
        ],
      ]);
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
      it(`should call axios for ${method}`, async () => {
        const mockAxios = {
          put: sinon.stub().resolves({ status: 200 }),
        };
        axiosStub.returns(mockAxios);
        const api = configure("https://example.com/api");

        // Invoke the method using the mapped call function
        const result = await call(api);
        assert.deepEqual(mockAxios.put.args, [
          [
            "mqtt/command",
            {
              mac_address: "mockMacAddress",
              name: "power",
              value: expectedValue,
            },
            {
              headers: { Authorization: "Bearer mockToken" },
            },
          ],
        ]);
        assert.equal(result.status, 200);
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
      it(`should call axios and return the correct value for ${method}`, async () => {
        const mockAxios = {
          get: sinon.stub().resolves({ data: mockDeviceInfo }),
        };
        axiosStub.returns(mockAxios);
        const api = configure("https://example.com/api");

        const result = await call(api, expectedToken, "mockMacAddress");

        assert.deepEqual(mockAxios.get.args, [
          [
            "device/mockMacAddress/info",
            { headers: { Authorization: `Bearer ${expectedToken}` } },
          ],
        ]);
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
      it(`should call axios and send the correct payload for ${method}`, async () => {
        const mockAxios = {
          put: sinon.stub().resolves({ status: 200 }),
        };
        axiosStub.returns(mockAxios);
        const api = configure("https://example.com/api");

        const result = await call(
          api,
          expectedToken,
          "mockMacAddress",
          payload.value,
        );

        assert.deepEqual(mockAxios.put.args, [
          [
            "mqtt/command",
            {
              mac_address: "mockMacAddress",
              ...payload,
            },
            {
              headers: { Authorization: `Bearer ${expectedToken}` },
            },
          ],
        ]);
        assert.equal(result.status, 200);
      });
    });
  });

  describe("registerDevice", () => {
    it("should call POST /device with correct payload", async () => {
      const mockResponse = {
        macAddress: "AABBCCDDEEFF",
        deviceName: "Test Stove",
        deviceRoom: "Living Room",
        serialNumber: "EDK123",
      };
      const mockAxios = {
        post: sinon.stub().resolves({ data: mockResponse }),
        get: sinon.stub(),
        put: sinon.stub(),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

      const result = await api.registerDevice(
        expectedToken,
        "AA:BB:CC:DD:EE:FF",
        "EDK123",
        "Test Stove",
        "Living Room",
      );

      assert.deepEqual(mockAxios.post.args, [
        [
          "device",
          {
            macAddress: "AABBCCDDEEFF",
            deviceName: "Test Stove",
            deviceRoom: "Living Room",
            serialNumber: "EDK123",
          },
          { headers: { Authorization: `Bearer ${expectedToken}` } },
        ],
      ]);
      assert.deepEqual(result, mockResponse);
    });

    it("should normalize MAC address by removing colons", async () => {
      const mockAxios = {
        post: sinon.stub().resolves({ data: {} }),
        get: sinon.stub(),
        put: sinon.stub(),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

      await api.registerDevice(expectedToken, "AA:BB:CC:DD:EE:FF", "EDK123");

      assert.equal(mockAxios.post.args[0][1].macAddress, "AABBCCDDEEFF");
    });

    it("should use empty strings as defaults for name and room", async () => {
      const mockAxios = {
        post: sinon.stub().resolves({ data: {} }),
        get: sinon.stub(),
        put: sinon.stub(),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

      await api.registerDevice(expectedToken, "AABBCCDDEEFF", "EDK123");

      assert.equal(mockAxios.post.args[0][1].deviceName, "");
      assert.equal(mockAxios.post.args[0][1].deviceRoom, "");
    });
  });

  describe("editDevice", () => {
    it("should call PUT /device/{mac} with correct payload", async () => {
      const mockResponse = {
        macAddress: "AABBCCDDEEFF",
        deviceName: "Updated Name",
        deviceRoom: "Basement",
        serialNumber: "EDK123",
      };
      const mockAxios = {
        put: sinon.stub().resolves({ data: mockResponse }),
        get: sinon.stub(),
        post: sinon.stub(),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

      const result = await api.editDevice(
        expectedToken,
        "AA:BB:CC:DD:EE:FF",
        "Updated Name",
        "Basement",
      );

      assert.deepEqual(mockAxios.put.args, [
        [
          "device/AABBCCDDEEFF",
          {
            deviceName: "Updated Name",
            deviceRoom: "Basement",
          },
          { headers: { Authorization: `Bearer ${expectedToken}` } },
        ],
      ]);
      assert.deepEqual(result, mockResponse);
    });

    it("should use empty strings as defaults for name and room", async () => {
      const mockAxios = {
        put: sinon.stub().resolves({ data: {} }),
        get: sinon.stub(),
        post: sinon.stub(),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

      await api.editDevice(expectedToken, "AABBCCDDEEFF");

      assert.equal(mockAxios.put.args[0][1].deviceName, "");
      assert.equal(mockAxios.put.args[0][1].deviceRoom, "");
    });
  });

  describe("deviceInfo with compressed responses", () => {
    it("should decompress Buffer-encoded status field", async () => {
      const statusData = {
        commands: { power: true },
        temperatures: { enviroment: 19, board: 25 },
      };
      const mockResponse = {
        status: createGzippedBuffer(statusData),
        nvm: {
          user_parameters: {
            enviroment_1_temperature: 22,
          },
        },
      };

      const mockAxios = {
        get: sinon.stub().resolves({ data: mockResponse }),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

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
      const mockResponse = {
        status: {
          commands: { power: true },
          temperatures: { enviroment: 19 },
        },
        nvm: createGzippedBuffer(nvmData),
      };

      const mockAxios = {
        get: sinon.stub().resolves({ data: mockResponse }),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

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
      const mockResponse = {
        status: createGzippedBuffer(statusData),
        nvm: createGzippedBuffer(nvmData),
      };

      const mockAxios = {
        get: sinon.stub().resolves({ data: mockResponse }),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

      const result = await api.deviceInfo(expectedToken, "mockMacAddress");

      assert.deepEqual(result.status, statusData);
      assert.deepEqual(result.nvm, nvmData);
    });

    it("should work with getPower on compressed response", async () => {
      const statusData = {
        commands: { power: true },
        temperatures: { enviroment: 19 },
      };
      const mockResponse = {
        status: createGzippedBuffer(statusData),
        nvm: { user_parameters: { enviroment_1_temperature: 22 } },
      };

      const mockAxios = {
        get: sinon.stub().resolves({ data: mockResponse }),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

      const result = await api.getPower(expectedToken, "mockMacAddress");

      assert.equal(result, true);
    });

    it("should work with getEnvironmentTemperature on compressed response", async () => {
      const statusData = {
        commands: { power: true },
        temperatures: { enviroment: 19, board: 25 },
      };
      const mockResponse = {
        status: createGzippedBuffer(statusData),
        nvm: { user_parameters: { enviroment_1_temperature: 22 } },
      };

      const mockAxios = {
        get: sinon.stub().resolves({ data: mockResponse }),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

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
      const mockResponse = {
        status: { commands: { power: true }, temperatures: { enviroment: 19 } },
        nvm: createGzippedBuffer(nvmData),
      };

      const mockAxios = {
        get: sinon.stub().resolves({ data: mockResponse }),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");

      const result = await api.getTargetTemperature(
        expectedToken,
        "mockMacAddress",
      );

      assert.equal(result, 22);
    });
  });
});
