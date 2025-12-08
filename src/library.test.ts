import { strict as assert } from "assert";
import axios from "axios";
import sinon from "sinon";

import { configure, createAuthService } from "../src/library";
import { API_URL } from "./constants";

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
        expectedPassword
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
        true // legacy mode
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
        }
      );
    });
  });

  describe("configure", () => {
    const expectedApi = [
      "deviceInfo",
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
          value: number
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
          payload.value
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
});
