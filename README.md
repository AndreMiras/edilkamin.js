# Edilkamin.js

[![Tests](https://github.com/AndreMiras/edilkamin.js/actions/workflows/tests.yml/badge.svg)](https://github.com/AndreMiras/edilkamin.js/actions/workflows/tests.yml)
[![CLI Tests](https://github.com/AndreMiras/edilkamin.js/actions/workflows/cli-tests.yml/badge.svg)](https://github.com/AndreMiras/edilkamin.js/actions/workflows/cli-tests.yml)
[![codecov](https://codecov.io/gh/AndreMiras/edilkamin.js/graph/badge.svg?token=YG3LKXNZWU)](https://app.codecov.io/gh/AndreMiras/edilkamin.js/tree/main)
[![Documentation](https://github.com/AndreMiras/edilkamin.js/actions/workflows/documentation.yml/badge.svg)](https://github.com/AndreMiras/edilkamin.js/actions/workflows/documentation.yml)
[![npm version](https://badge.fury.io/js/edilkamin.svg)](https://badge.fury.io/js/edilkamin)

This is a library for the [Reverse Engineered](docs/ReverseEngineering.md) "The Mind" Edilkamin API.
The Mind offers an app/API to remote control the Edilkamin pellet stoves.

## Install

Using npm:

```sh
npm install edilkamin
```

Using yarn:

```sh
yarn add edilkamin
```

## Usage

Basic usage:

```js
import { signIn, deviceInfo, setPowerOff } from "edilkamin";

const macAddress = "aabbccddeeff";
const token = await signIn(username, password);
console.log(await deviceInfo(token, macAddress));
console.log(await setPowerOff(token, macAddress));
```

For long-running applications, use `getSession()` to automatically refresh tokens:

```js
import { signIn, getSession, deviceInfo } from "edilkamin";

// Authenticate once
await signIn(username, password);

// Get current session (auto-refreshes if expired)
const token = await getSession();
console.log(await deviceInfo(token, macAddress));
```

Sessions persist for ~30 days without re-authentication. Call `getSession()` to retrieve fresh tokens as needed.

It's also possible to change the default backend URL:

```js
import { signIn, configure } from "edilkamin";

const baseUrl = "https://my-proxy.com/";
const { deviceInfo, setPower } = configure(baseUrl);
console.log(await deviceInfo(token, macAddress));
console.log(await setPower(token, macAddress, 0));
```

## CLI

The library includes a CLI tool that is useful for debugging.

```sh
# First time: provide credentials to authenticate
yarn cli deviceInfo --mac $MAC --username $USERNAME --password $PASSWORD

# Subsequent calls: session persists, credentials optional
yarn cli deviceInfo --mac $MAC

# Clear stored session
yarn cli logout
```

Or with `npx` once the library is installed:

```sh
npx edilkamin deviceInfo --mac $MAC --username $USERNAME --password $PASSWORD
```

The CLI stores session data in `~/.edilkamin/session.json` and automatically refreshes tokens when needed. Sessions remain valid for ~30 days.

## API Versions

This library supports both the new and legacy Edilkamin API endpoints.

### CLI Usage

```sh
# New API (default)
yarn cli deviceInfo --mac $MAC --username $USERNAME --password $PASSWORD

# Legacy API
yarn cli deviceInfo --mac $MAC --username $USERNAME --password $PASSWORD --legacy
```

### Library Usage

```js
import { configure, signIn, OLD_API_URL, NEW_API_URL } from "edilkamin";

// New API (default)
const token = await signIn(username, password);
const api = configure();

// Legacy API
const legacyToken = await signIn(username, password, true);
const legacyApi = configure(OLD_API_URL);
```

> **Note**: The legacy API uses AWS API Gateway and may be deprecated in the future.

## Bluetooth Device Discovery

For automatic device discovery in web browsers, use the `edilkamin/bluetooth` subpath export.

### Quick Example (Web)

```javascript
import { scanForDevices } from "edilkamin/bluetooth";
import { deviceInfo, signIn } from "edilkamin";

// Scan for nearby stoves (requires user gesture)
const devices = await scanForDevices();
const { wifiMac } = devices[0];

// Use discovered MAC for API calls
const token = await signIn(username, password);
const info = await deviceInfo(token, wifiMac);
```

### MAC Address Helper

The core library includes a helper to convert BLE MAC to WiFi MAC:

```javascript
import { bleToWifiMac } from "edilkamin";

// BLE MAC from Bluetooth scan
const bleMac = "A8:03:2A:FE:D5:0A";

// WiFi MAC for API calls (BLE - 2)
const wifiMac = bleToWifiMac(bleMac); // "a8032afed508"
```

## Motivations

- providing an open source web alternative
  to the [proprietary mobile app](https://play.google.com/store/apps/details?id=com.edilkamin.stufe)
- improving the interoperability (Nest, HomeAssistant...)

## Device Control Methods

The library provides comprehensive control over Edilkamin stoves:

### Power Control

```js
setPowerOn(token, mac); // Turn on
setPowerOff(token, mac); // Turn off
setPower(token, mac, 1); // 1=on, 0=off
getPower(token, mac); // Returns boolean
setPowerLevel(token, mac, 3); // Set power level (1-5)
getPowerLevel(token, mac); // Returns 1-5
```

### Fan Speed

```js
setFan1Speed(token, mac, 3); // Set fan 1 speed (0-5)
setFan2Speed(token, mac, 3); // Set fan 2 speed (0-5)
setFan3Speed(token, mac, 3); // Set fan 3 speed (0-5)
getFan1Speed(token, mac); // Get fan 1 speed
getFan2Speed(token, mac); // Get fan 2 speed
getFan3Speed(token, mac); // Get fan 3 speed
```

### Operating Modes

```js
setAirkare(token, mac, true); // Enable/disable air quality mode
setRelax(token, mac, true); // Enable/disable comfort mode
setStandby(token, mac, true); // Enable/disable standby mode
getStandby(token, mac); // Get standby status
setStandbyTime(token, mac, 30); // Set standby timer (minutes)
getStandbyTime(token, mac); // Get standby timer
setAuto(token, mac, true); // Enable/disable auto mode
getAuto(token, mac); // Get auto mode status
```

### Temperature Control

```js
setTargetTemperature(token, mac, 22); // Set zone 1 temperature
getTargetTemperature(token, mac); // Get zone 1 target
getEnvironmentTemperature(token, mac); // Get ambient temperature
setEnvironment2Temperature(token, mac, 20); // Set zone 2 temperature
getEnvironment2Temperature(token, mac); // Get zone 2 target
setEnvironment3Temperature(token, mac, 18); // Set zone 3 temperature
getEnvironment3Temperature(token, mac); // Get zone 3 target
```

## Roadmap

- [x] AWS Amplify/ Cognito authentication
- [x] unauthenticated endpoint call
- [x] authenticated endpoint call
- [ ] ~list stoves~
- [x] turn stove on/off
- [x] set temperature
- [x] power level control
- [x] fan speed control
- [x] operating modes (Airkare, Relax, Standby, Auto)
- [x] multi-zone temperature control

## Limitations

- **No server-side device listing**: The API doesn't provide an endpoint to list stoves associated to a user.
- **Bluetooth discovery available**: Use `edilkamin/bluetooth` for web browser device discovery, similar to the official app.
- **Manual MAC entry fallback**: For unsupported browsers or CLI, users can find the BLE MAC with different means and use `bleToWifiMac()` to calculate the WiFi MAC for API calls.
