# Edilkamin.js

[![Tests](https://github.com/AndreMiras/edilkamin.js/workflows/Tests/badge.svg)](https://github.com/AndreMiras/edilkamin.js/actions/workflows/tests.yml)
[![Documentation](https://github.com/AndreMiras/edilkamin.js/workflows/Documentation/badge.svg)](https://github.com/AndreMiras/edilkamin.js/actions/workflows/documentation.yml)
[![npm version](https://badge.fury.io/js/edilkamin.svg)](https://badge.fury.io/js/edilkamin)

This is a library for the [Reverse Engineered](docs/ReverseEngineering.md) "The Mind" Edilkamin API.
The Mind offers an app/API to remote control the Edilkamin pellet stoves.

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
