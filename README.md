# Tuya Device Control

A simple project to control Tuya/Smartlife IoT devices such as light bulbs and fans. Devices can be grouped to control simultaneously. I created the app as:
- I wanted all my devices to be controlled in a single place
- I did not like the complicated setup and interface of the Smartlife app
- Google Home / Alexa did not give me access to all device controls and their interfaces were too distributed (one page for each device)

This is mostly a DIY approach where device details are copied and pasted from the Tuya Platform website instead of full device management. It's a nice starting point for someone wishing to build an app to control devices. I made the project using Claude Sonnet 4.6 in a 6 hour coding session without writing a single line of code (though I knew what I was doing). I added small features over the next week and am using it literally everyday!

Confirmed to be working with the following devices:

- Wipro Wi-Fi LED Smart Bulbs (all wattages - can control color or temperature and brightness)
- Orient AeroSlim Fan (can control speed and LED - can also control fan modes and schedules though this has not been implemented as I never use it)

## Technical Details

- **Framework:** React Native 0.84 (React 19)
- **Language:** TypeScript 5.8
- **Platforms:** Android (confirmed to be working) & iOS (not tested)
- **API:** Tuya OpenAPI v1.0 — requests signed with HMAC-SHA256 per Tuya's URL-aware signing spec
- **Storage:** `@react-native-async-storage/async-storage` — credentials and device config are persisted locally on-device
- **Config transfer:** `crypto-js` AES-128 encryption used to encode exported config strings (`HC1:…` format) for safe sharing
- **Supported Tuya regions:** India (should work with other regions as well but I did not want to keep a dropdown for something that may never be used - change the region in SetupScreen.tsx if needed)
- **Key dependencies:**
  - `react-native-safe-area-context` — safe area insets for notch/home-bar support
  - `crypto-js` — HMAC-SHA256 request signing and AES config export/import

## How to use

### One-time Setup

1. Register at [platform.tuya.com](https://platform.tuya.com)
2. Create a Cloud project and enable the **IoT Core** API product
3. In your project, go to **Devices** → **Link Tuya App Account** and scan the QR code with the SmartLife app
4. Copy your **Access ID** and **Access Secret** from the project overview page
5. Find your **Device IDs** in the Tuya console under Cloud → Devices → click a device
6. Open the app and enter your Access ID, Access Secret, and add each Device ID
7. Optionally, create **Light Groups** to control multiple colour lights together as one unit
8. Tap **Connect** to save and start controlling your devices

> **Wipro Next devices:** Add them to the SmartLife app first (they are Tuya-compatible). If they don't appear, use the Wipro Next app's "Link with SmartLife" option if available.

### Import / Export

Once the app is set up on one phone, you can transfer the full configuration to another phone without re-entering any details.

**Exporting (on the configured phone):**

1. Open the app to the Home screen
2. Tap the **Export** button
3. The app generates an encrypted `HC1:…` config string and opens the system share sheet
4. Send it to yourself via any method (message, email, notes, etc.)

**Importing (on the new phone):**

1. Open the app — you will land on the Setup screen
2. Tap **Import Configuration** to expand the import panel
3. Paste the `HC1:…` string you exported
4. Tap **Load Config** — all fields (Access ID, Secret, Device IDs, Light Groups) will be filled automatically
5. Tap **Connect** to verify and save
