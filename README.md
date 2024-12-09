# Edilkamin.js

[![Tests](https://github.com/AndreMiras/edilkamin.js/workflows/Tests/badge.svg)](https://github.com/AndreMiras/edilkamin.js/actions/workflows/tests.yml)
[![CLI Tests](https://github.com/AndreMiras/edilkamin.js/actions/workflows/cli-tests.yml/badge.svg)](https://github.com/AndreMiras/edilkamin.js/actions/workflows/cli-tests.yml)
[![codecov](https://codecov.io/gh/AndreMiras/edilkamin.js/graph/badge.svg?token=YG3LKXNZWU)](https://app.codecov.io/gh/AndreMiras/edilkamin.js/tree/main)
[![Documentation](https://github.com/AndreMiras/edilkamin.js/workflows/Documentation/badge.svg)](https://github.com/AndreMiras/edilkamin.js/actions/workflows/documentation.yml)
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
const token = signIn(username, password);
deviceInfo(token, macAddress).then(console.log);
setPowerOff(token, macAddress).then(console.log);
```

It's also possible to change the default backend URL:

```js
import { signIn, configure } from "edilkamin";

const baseUrl = "https://my-proxy.com/";
const { deviceInfo, setPower } = configure(baseUrl);
deviceInfo(token, macAddress).then(console.log);
setPower(token, macAddress, 0).then(console.log);
```

## CLI

The library includes a CLI tool that is useful for debugging.

```sh
yarn cli deviceInfo --mac $MAC --username $USERNAME --password $PASSWORD
```

Or with `npx` once the library is installed:

```sh
npx edilkamin deviceInfo --mac $MAC --username $USERNAME --password $PASSWORD
```

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
