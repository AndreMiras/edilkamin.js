import { strict as assert } from "assert";
import axios from "axios";
import sinon from "sinon";

import { configure, createAuthService } from "../src/library";

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
      assert.ok(axiosStub.calledOnce);
      assert.deepEqual(axiosStub.firstCall.args[0], { baseURL });
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
      const mockAxios = {
        get: sinon
          .stub()
          .resolves({ data: { id: "123", name: "Mock Device" } }),
      };

      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");
      const result = await api.deviceInfo("mockToken", "mockMacAddress");
      assert.ok(mockAxios.get.calledOnce);
      assert.equal(
        mockAxios.get.firstCall.args[0],
        "device/mockMacAddress/info"
      );
      assert.deepEqual(mockAxios.get.firstCall.args[1], {
        headers: { Authorization: "Bearer mockToken" },
      });
      assert.deepEqual(result.data, { id: "123", name: "Mock Device" });
    });

    it("should call axios for setPowerOn", async () => {
      const mockAxios = {
        put: sinon.stub().resolves({ status: 200 }),
      };
      axiosStub.returns(mockAxios);
      const api = configure("https://example.com/api");
      const result = await api.setPowerOn("mockToken", "mockMacAddress");
      assert.ok(mockAxios.put.calledOnce);
      assert.equal(mockAxios.put.firstCall.args[0], "mqtt/command");
      assert.deepEqual(mockAxios.put.firstCall.args[1], {
        mac_address: "mockMacAddress",
        name: "power",
        value: 1,
      });
      assert.deepEqual(mockAxios.put.firstCall.args[2], {
        headers: { Authorization: "Bearer mockToken" },
      });
      assert.equal(result.status, 200);
    });
  });
});
