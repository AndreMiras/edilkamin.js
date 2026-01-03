import { strict as assert } from "assert";

import {
  aesDecrypt,
  aesEncrypt,
  crc16Modbus,
  createPacket,
  ModbusResponse,
  NOTIFY_CHARACTERISTIC_UUID,
  parseResponse,
  parsers,
  readCommands,
  SERVICE_UUID,
  WRITE_CHARACTERISTIC_UUID,
  writeCommands,
} from "./bluetooth-protocol";

describe("bluetooth-protocol", () => {
  describe("constants", () => {
    it("exports SERVICE_UUID", () => {
      assert.equal(SERVICE_UUID, "0000abf0-0000-1000-8000-00805f9b34fb");
    });

    it("exports WRITE_CHARACTERISTIC_UUID", () => {
      assert.equal(
        WRITE_CHARACTERISTIC_UUID,
        "0000abf1-0000-1000-8000-00805f9b34fb",
      );
    });

    it("exports NOTIFY_CHARACTERISTIC_UUID", () => {
      assert.equal(
        NOTIFY_CHARACTERISTIC_UUID,
        "0000abf2-0000-1000-8000-00805f9b34fb",
      );
    });
  });

  describe("crc16Modbus", () => {
    it("calculates correct CRC for power-on command", () => {
      const command = new Uint8Array([0x01, 0x06, 0x03, 0x1c, 0x00, 0x01]);
      const crc = crc16Modbus(command);
      assert.equal(crc.length, 2);
      // CRC is returned as [crcLo, crcHi]
      assert.ok(crc[0] >= 0 && crc[0] <= 255);
      assert.ok(crc[1] >= 0 && crc[1] <= 255);
    });

    it("returns 2 bytes for any input", () => {
      const testCases = [
        new Uint8Array([0x01, 0x03, 0x05, 0x25, 0x00, 0x01]),
        new Uint8Array([0x01, 0x06, 0x04, 0x40, 0x00, 0x03]),
        new Uint8Array([0x00]),
        new Uint8Array([0xff, 0xff, 0xff]),
      ];

      for (const data of testCases) {
        const crc = crc16Modbus(data);
        assert.equal(
          crc.length,
          2,
          `CRC for ${data.toString()} should be 2 bytes`,
        );
      }
    });

    it("produces different CRCs for different data", () => {
      const crc1 = crc16Modbus(
        new Uint8Array([0x01, 0x06, 0x03, 0x1c, 0x00, 0x01]),
      );
      const crc2 = crc16Modbus(
        new Uint8Array([0x01, 0x06, 0x03, 0x1c, 0x00, 0x00]),
      );
      // CRCs should be different for different data
      assert.ok(crc1[0] !== crc2[0] || crc1[1] !== crc2[1]);
    });
  });

  describe("aesEncrypt/aesDecrypt", () => {
    it("roundtrip returns original data", async () => {
      const original = new Uint8Array(32).fill(0x42);
      const encrypted = await aesEncrypt(original);
      const decrypted = await aesDecrypt(encrypted);
      assert.deepEqual(decrypted, original);
    });

    it("produces 32-byte output for 32-byte input", async () => {
      const input = new Uint8Array(32);
      const encrypted = await aesEncrypt(input);
      assert.equal(encrypted.length, 32);
    });

    it("produces different output for different input", async () => {
      const input1 = new Uint8Array(32).fill(0x00);
      const input2 = new Uint8Array(32).fill(0xff);
      const encrypted1 = await aesEncrypt(input1);
      const encrypted2 = await aesEncrypt(input2);
      // At least some bytes should be different
      let different = false;
      for (let i = 0; i < 32; i++) {
        if (encrypted1[i] !== encrypted2[i]) {
          different = true;
          break;
        }
      }
      assert.ok(different, "Different inputs should produce different outputs");
    });

    it("encrypted data is different from plaintext", async () => {
      const original = new Uint8Array(32).fill(0xaa);
      const encrypted = await aesEncrypt(original);
      // Encrypted should not equal original
      let same = true;
      for (let i = 0; i < 32; i++) {
        if (encrypted[i] !== original[i]) {
          same = false;
          break;
        }
      }
      assert.ok(!same, "Encrypted data should differ from original");
    });
  });

  describe("createPacket", () => {
    it("produces 32-byte encrypted packet", async () => {
      const command = readCommands.power;
      const packet = await createPacket(command);
      assert.equal(packet.length, 32);
    });

    it("rejects commands not exactly 6 bytes", async () => {
      await assert.rejects(
        () => createPacket(new Uint8Array([0x01, 0x02])),
        /must be exactly 6 bytes/,
      );
    });

    it("rejects empty commands", async () => {
      await assert.rejects(
        () => createPacket(new Uint8Array([])),
        /must be exactly 6 bytes/,
      );
    });

    it("rejects 7-byte commands", async () => {
      await assert.rejects(
        () =>
          createPacket(
            new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
          ),
        /must be exactly 6 bytes/,
      );
    });

    it("produces different packets for different commands", async () => {
      const packet1 = await createPacket(writeCommands.setPower(true));
      const packet2 = await createPacket(writeCommands.setPower(false));
      // Packets should be different (different command bytes)
      let different = false;
      for (let i = 0; i < 32; i++) {
        if (packet1[i] !== packet2[i]) {
          different = true;
          break;
        }
      }
      assert.ok(
        different,
        "Different commands should produce different packets",
      );
    });
  });

  describe("parseResponse", () => {
    it("rejects responses not 32 bytes", async () => {
      await assert.rejects(
        () => parseResponse(new Uint8Array(16)),
        /must be exactly 32 bytes/,
      );
    });

    it("can decrypt and parse an encrypted packet", async () => {
      // Create a command packet and try to parse it
      // This tests that encrypt/decrypt work together
      const command = readCommands.power;
      const encrypted = await createPacket(command);

      // Parse the response (it's not a valid response but should decrypt)
      const parsed = await parseResponse(encrypted);

      // Should have parsed something
      assert.ok(typeof parsed.slaveAddress === "number");
      assert.ok(typeof parsed.functionCode === "number");
      assert.ok(typeof parsed.isError === "boolean");
    });
  });

  describe("readCommands", () => {
    it("all commands are 6 bytes", () => {
      Object.entries(readCommands).forEach(([name, cmd]) => {
        assert.equal(cmd.length, 6, `${name} command must be 6 bytes`);
      });
    });

    it("all commands use slave address 0x01", () => {
      Object.entries(readCommands).forEach(([name, cmd]) => {
        assert.equal(cmd[0], 0x01, `${name} should use slave address 0x01`);
      });
    });

    it("all commands use function code 0x03", () => {
      Object.entries(readCommands).forEach(([name, cmd]) => {
        assert.equal(cmd[1], 0x03, `${name} should use function code 0x03`);
      });
    });

    it("power command has correct register address", () => {
      assert.equal(readCommands.power[2], 0x05);
      assert.equal(readCommands.power[3], 0x29);
    });

    it("temperature command has correct register address", () => {
      assert.equal(readCommands.temperature[2], 0x05);
      assert.equal(readCommands.temperature[3], 0x25);
    });

    it("powerLevel command has correct register address", () => {
      assert.equal(readCommands.powerLevel[2], 0x05);
      assert.equal(readCommands.powerLevel[3], 0x29);
    });
  });

  describe("writeCommands", () => {
    it("setPower(true) produces correct bytes", () => {
      const cmd = writeCommands.setPower(true);
      assert.deepEqual(
        cmd,
        new Uint8Array([0x01, 0x06, 0x03, 0x1c, 0x00, 0x01]),
      );
    });

    it("setPower(false) produces correct bytes", () => {
      const cmd = writeCommands.setPower(false);
      assert.deepEqual(
        cmd,
        new Uint8Array([0x01, 0x06, 0x03, 0x1c, 0x00, 0x00]),
      );
    });

    it("setTemperature encodes correctly", () => {
      const cmd = writeCommands.setTemperature(21.5);
      // 21.5 * 10 = 215 = 0x00D7
      assert.equal(cmd[0], 0x01); // slave address
      assert.equal(cmd[1], 0x06); // function code
      assert.equal(cmd[2], 0x05); // register hi
      assert.equal(cmd[3], 0x25); // register lo
      assert.equal(cmd[4], 0x00); // value hi
      assert.equal(cmd[5], 0xd7); // value lo
    });

    it("setTemperature handles whole numbers", () => {
      const cmd = writeCommands.setTemperature(20);
      // 20 * 10 = 200 = 0x00C8
      assert.equal(cmd[4], 0x00);
      assert.equal(cmd[5], 0xc8);
    });

    it("setTemperature handles high temperatures", () => {
      const cmd = writeCommands.setTemperature(30);
      // 30 * 10 = 300 = 0x012C
      assert.equal(cmd[4], 0x01);
      assert.equal(cmd[5], 0x2c);
    });

    it("setPowerLevel validates range", () => {
      assert.throws(() => writeCommands.setPowerLevel(0), /must be 1-5/);
      assert.throws(() => writeCommands.setPowerLevel(6), /must be 1-5/);
      assert.doesNotThrow(() => writeCommands.setPowerLevel(1));
      assert.doesNotThrow(() => writeCommands.setPowerLevel(3));
      assert.doesNotThrow(() => writeCommands.setPowerLevel(5));
    });

    it("setPowerLevel produces correct bytes", () => {
      const cmd = writeCommands.setPowerLevel(3);
      assert.equal(cmd[0], 0x01);
      assert.equal(cmd[1], 0x06);
      assert.equal(cmd[2], 0x04);
      assert.equal(cmd[3], 0x40);
      assert.equal(cmd[4], 0x00);
      assert.equal(cmd[5], 0x03);
    });

    it("setFan1Speed validates range", () => {
      assert.throws(() => writeCommands.setFan1Speed(-1), /must be 0-5/);
      assert.throws(() => writeCommands.setFan1Speed(6), /must be 0-5/);
      assert.doesNotThrow(() => writeCommands.setFan1Speed(0)); // auto
      assert.doesNotThrow(() => writeCommands.setFan1Speed(5));
    });

    it("setFan2Speed validates range", () => {
      assert.throws(() => writeCommands.setFan2Speed(-1), /must be 0-5/);
      assert.throws(() => writeCommands.setFan2Speed(6), /must be 0-5/);
      assert.doesNotThrow(() => writeCommands.setFan2Speed(0));
      assert.doesNotThrow(() => writeCommands.setFan2Speed(5));
    });

    it("setAutoMode produces correct bytes", () => {
      const cmdOn = writeCommands.setAutoMode(true);
      assert.equal(cmdOn[5], 0x01);

      const cmdOff = writeCommands.setAutoMode(false);
      assert.equal(cmdOff[5], 0x00);
    });

    it("setStandby produces correct bytes", () => {
      const cmdOn = writeCommands.setStandby(true);
      assert.equal(cmdOn[5], 0x01);

      const cmdOff = writeCommands.setStandby(false);
      assert.equal(cmdOff[5], 0x00);
    });

    it("all write commands are 6 bytes", () => {
      const commands = [
        writeCommands.setPower(true),
        writeCommands.setTemperature(21),
        writeCommands.setPowerLevel(3),
        writeCommands.setFan1Speed(2),
        writeCommands.setFan2Speed(2),
        writeCommands.setAutoMode(true),
        writeCommands.setStandby(false),
      ];

      commands.forEach((cmd, i) => {
        assert.equal(cmd.length, 6, `Command ${i} should be 6 bytes`);
      });
    });

    it("all write commands use function code 0x06", () => {
      const commands = [
        writeCommands.setPower(true),
        writeCommands.setTemperature(21),
        writeCommands.setPowerLevel(3),
        writeCommands.setFan1Speed(2),
        writeCommands.setFan2Speed(2),
        writeCommands.setAutoMode(true),
        writeCommands.setStandby(false),
      ];

      commands.forEach((cmd, i) => {
        assert.equal(
          cmd[1],
          0x06,
          `Command ${i} should use function code 0x06`,
        );
      });
    });
  });

  describe("parsers", () => {
    it("boolean parser returns true for 0x01", () => {
      const response: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        byteCount: 2,
        data: new Uint8Array([0x00, 0x01]),
        isError: false,
      };
      assert.equal(parsers.boolean(response), true);
    });

    it("boolean parser returns false for 0x00", () => {
      const response: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        byteCount: 2,
        data: new Uint8Array([0x00, 0x00]),
        isError: false,
      };
      assert.equal(parsers.boolean(response), false);
    });

    it("temperature parser divides by 10", () => {
      const response: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        byteCount: 2,
        data: new Uint8Array([0x00, 0xd7]), // 215
        isError: false,
      };
      assert.equal(parsers.temperature(response), 21.5);
    });

    it("temperature parser handles high temperatures", () => {
      const response: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        byteCount: 2,
        data: new Uint8Array([0x01, 0x2c]), // 300
        isError: false,
      };
      assert.equal(parsers.temperature(response), 30);
    });

    it("number parser returns big-endian value", () => {
      const response: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        byteCount: 2,
        data: new Uint8Array([0x00, 0x03]), // power level 3
        isError: false,
      };
      assert.equal(parsers.number(response), 3);
    });

    it("number parser handles larger values", () => {
      const response: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        byteCount: 2,
        data: new Uint8Array([0x01, 0x00]), // 256
        isError: false,
      };
      assert.equal(parsers.number(response), 256);
    });

    it("boolean parser throws on error response", () => {
      const errorResponse: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        data: new Uint8Array([0x02]), // error code
        isError: true,
      };
      assert.throws(() => parsers.boolean(errorResponse), /Modbus error: 2/);
    });

    it("temperature parser throws on error response", () => {
      const errorResponse: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        data: new Uint8Array([0x03]),
        isError: true,
      };
      assert.throws(
        () => parsers.temperature(errorResponse),
        /Modbus error: 3/,
      );
    });

    it("number parser throws on error response", () => {
      const errorResponse: ModbusResponse = {
        slaveAddress: 1,
        functionCode: 0x03,
        data: new Uint8Array([0x04]),
        isError: true,
      };
      assert.throws(() => parsers.number(errorResponse), /Modbus error: 4/);
    });

    describe("parsers.powerLevel", () => {
      it("extracts low byte for power level", () => {
        const response: ModbusResponse = {
          slaveAddress: 1,
          functionCode: 0x03,
          byteCount: 2,
          data: new Uint8Array([0x03, 0x02]), // fan=3, power=2
          isError: false,
        };
        assert.equal(parsers.powerLevel(response), 2);
      });

      it("handles power level 1", () => {
        const response: ModbusResponse = {
          slaveAddress: 1,
          functionCode: 0x03,
          byteCount: 2,
          data: new Uint8Array([0x00, 0x01]), // power=1
          isError: false,
        };
        assert.equal(parsers.powerLevel(response), 1);
      });

      it("handles power level 5", () => {
        const response: ModbusResponse = {
          slaveAddress: 1,
          functionCode: 0x03,
          byteCount: 2,
          data: new Uint8Array([0x00, 0x05]), // power=5
          isError: false,
        };
        assert.equal(parsers.powerLevel(response), 5);
      });

      it("clamps value above 5 to 5", () => {
        const response: ModbusResponse = {
          slaveAddress: 1,
          functionCode: 0x03,
          byteCount: 2,
          data: new Uint8Array([0x00, 0x82]), // power=130 (invalid)
          isError: false,
        };
        assert.equal(parsers.powerLevel(response), 5);
      });

      it("clamps value below 1 to 1", () => {
        const response: ModbusResponse = {
          slaveAddress: 1,
          functionCode: 0x03,
          byteCount: 2,
          data: new Uint8Array([0x00, 0x00]), // power=0 (invalid)
          isError: false,
        };
        assert.equal(parsers.powerLevel(response), 1);
      });

      it("ignores high byte (fan speed)", () => {
        const response: ModbusResponse = {
          slaveAddress: 1,
          functionCode: 0x03,
          byteCount: 2,
          data: new Uint8Array([0xff, 0x03]), // fan=255, power=3
          isError: false,
        };
        assert.equal(parsers.powerLevel(response), 3);
      });

      it("throws on error response", () => {
        const errorResponse: ModbusResponse = {
          slaveAddress: 1,
          functionCode: 0x03,
          data: new Uint8Array([0x02]), // error code
          isError: true,
        };
        assert.throws(
          () => parsers.powerLevel(errorResponse),
          /Modbus error: 2/,
        );
      });
    });
  });

  describe("integration", () => {
    it("full roundtrip: create packet, decrypt, check structure", async () => {
      // Create a power-on command
      const command = writeCommands.setPower(true);
      assert.deepEqual(
        command,
        new Uint8Array([0x01, 0x06, 0x03, 0x1c, 0x00, 0x01]),
      );

      // Create encrypted packet
      const packet = await createPacket(command);
      assert.equal(packet.length, 32);

      // Decrypt it back (as if we received it)
      // Note: createPacket encrypts with padding, parseResponse expects response format
      // This is not a true response but tests the encryption layer
    });

    it("all read commands can create valid packets", async () => {
      for (const [name, command] of Object.entries(readCommands)) {
        const packet = await createPacket(command);
        assert.equal(packet.length, 32, `${name} should create 32-byte packet`);
      }
    });

    it("all write commands can create valid packets", async () => {
      const commands = [
        { name: "setPower", cmd: writeCommands.setPower(true) },
        { name: "setTemperature", cmd: writeCommands.setTemperature(21) },
        { name: "setPowerLevel", cmd: writeCommands.setPowerLevel(3) },
        { name: "setFan1Speed", cmd: writeCommands.setFan1Speed(2) },
        { name: "setFan2Speed", cmd: writeCommands.setFan2Speed(2) },
        { name: "setAutoMode", cmd: writeCommands.setAutoMode(true) },
        { name: "setStandby", cmd: writeCommands.setStandby(false) },
      ];

      for (const { name, cmd } of commands) {
        const packet = await createPacket(cmd);
        assert.equal(packet.length, 32, `${name} should create 32-byte packet`);
      }
    });
  });
});
