import { strict as assert } from "assert";
import sinon from "sinon";
import axios from "axios";
import { configure } from "../src/library";

describe("library", () => {
  let axiosStub: sinon.SinonStub;

  beforeEach(() => {
    axiosStub = sinon.stub(axios, "create").returns({
      get: sinon.stub(),
      put: sinon.stub(),
    } as any);
  });

  afterEach(() => {
    sinon.restore();
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
      axiosStub.returns(mockAxios as any);
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
      axiosStub.returns(mockAxios as any);
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
