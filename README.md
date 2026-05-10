# Home Control

Home Control is a React Native app for controlling smart devices from Tuya/SmartLife and GE Cync in one place.

The app focuses on fast daily control with local persistence, simple setup, and portable encrypted config sharing.

## Why this project exists

This started as a simple project to control Tuya/SmartLife IoT devices (like bulbs and fans) in one place.

I built it because:

- I wanted all my devices to be controlled from a single app.
- I did not like the setup flow and interface complexity in the SmartLife app.
- Google Home / Alexa did not expose all controls I needed, and the controls felt too distributed.

The overall approach is intentionally practical and DIY: device details are copied from provider consoles instead of relying on full in-app cloud provisioning where possible.

## Confirmed working with

- Wipro Wi-Fi LED Smart Bulbs (color/temperature/brightness control)
- Orient AeroSlim Fan (fan speed and LED control)
- GE Cync Wi-FI LED RGB Smart Bulbs

## What the app can do

- Connect to **Tuya/SmartLife** devices using Tuya Cloud credentials.
- Connect to **GE Cync** devices, including 2FA login flow.
- Support **Tuya-only**, **Cync-only**, or **mixed** setups.
- Control supported device types (lights, fans, fan lights, and Cync lights/switches).
- Create and control **Tuya Light Groups** (toggle, brightness, white/colour states).
- Assign devices to rooms/homes with an **Assign Room** modal.
- Edit and persist a custom **Home Name** shown in the header.
- Reorder devices manually to override provider/server ordering.
- Long-press a global **All Off** action.
- Export configuration from Home screen and import on another device.

## Setup flow

Setup is split into three tabs:

- **Tuya / SmartLife**: Access ID, Secret, device IDs, and light groups.
- **Cync**: email/password login, optional 2FA verification, device fetch.
- **Import**: paste a shared config string to overwrite setup values.

The Save/Connect footer is shared across tabs, so setup can be completed from any tab.

## Config import/export

- **Default export format:** `HC2:`
- **Compatibility on import:** `HC2:` and legacy `HC1:`

HC2 uses compact keys + compression + AES encryption to shorten share strings versus HC1 while keeping backward compatibility for existing shared configs.

Imported config can include both ecosystems (Tuya + Cync). Import replaces current setup values in the setup screen, then you save to finalize.

## Persistence details

All app state is stored locally with AsyncStorage.

- Tuya credentials and setup fields
- Cync credentials and fetched device metadata
- Cync runtime cache (best-effort state hydration)
- Device room assignments
- Manual device order overrides
- Home name

This keeps room/order customizations durable across app restarts.

## Tech stack

- React Native 0.84 + React 19
- TypeScript 5.8
- AsyncStorage for local persistence
- `crypto-js` for request signing/encryption
- `lz-string` for HC2 payload compression
- `react-native-tcp-socket` for Cync LAN communication path

## Run locally

1. Install dependencies:
  `npm install`
2. Start Metro:
  `npm run start`
3. Run Android:
  `npm run android`
4. Run iOS:
  `npm run ios`

## Notes

- Android is the primary tested platform.
- Tuya region is currently set to `in` in setup logic.
- This app is intended for personal/home use and assumes trusted device sharing channels for exported config strings.
