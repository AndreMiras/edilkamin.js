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

## Motivations

- providing an open source web alternative
  to the [proprietary mobile app](https://play.google.com/store/apps/details?id=com.edilkamin.stufe)
- improving the interoperability (Nest, HomeAssistant...)

## Roadmap

- [x] AWS Amplify/ Cognito authentication
- [x] unauthenticated endpoint call
- [x] authenticated endpoint call
- [ ] ~list stoves~
- [x] turn stove on/off
- [ ] set temperature

## Limitations

It seems like there's no endpoint to list stoves associated to a user.
The way the official app seem to work is by probing the stove via bluetooth.
Then cache the stove MAC address to a local database for later use.
