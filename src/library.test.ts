import { strict as assert } from "assert";
import axios from "axios";
import sinon from "sinon";

import { configure, createAuthService } from "../src/library";
import { API_URL } from "./constants";

describe("library", () => {
  let axiosStub: sinon.SinonStub;

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
    it("should sign in and return the JWT token", async () => {
      const expectedUsername = "testuser";
      const expectedPassword = "testpassword";
      const expectedToken = "mockJwtToken";
      const signIn = sinon.stub().resolves({ isSignedIn: true });
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

    it("should throw an error if sign-in fails", async () => {
      const expectedUsername = "testuser";
      const expectedPassword = "testpassword";
      const expectedToken = "mockJwtToken";
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
      assert.deepEqual(Object.keys(api), [
        "deviceInfo",
        "setPower",
        "setPowerOff",
        "setPowerOn",
      ]);
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
      assert.deepEqual(Object.keys(api), [
        "deviceInfo",
        "setPower",
        "setPowerOff",
        "setPowerOn",
      ]);
    });
  });

  describe("API Methods", () => {
    it("should call axios for deviceInfo", async () => {
      const expectedDevice = { id: "123", name: "Mock Device" };
      const expectedToken = "mockToken";
      const mockAxios = {
        get: sinon.stub().resolves({ data: expectedDevice }),
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
      assert.deepEqual(result.data, expectedDevice);
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
  });
});
