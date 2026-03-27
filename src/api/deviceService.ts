import type { Device } from '../types/device';
import { tuyaApi } from './tuyaClient';

// ── Tuya API response shapes ──────────────────────────────────────────────────

interface TuyaStatus {
  code: string;
  value: boolean | number | string;
}

interface TuyaDevice {
  id: string;
  name: string;
  category: string;
  online?: boolean;
  room_name?: string;
  home_name?: string;
  status: TuyaStatus[];
}

// ── Category classification ───────────────────────────────────────────────────
// See: https://developer.tuya.com/en/docs/iot/standarddescription

/** Tuya device categories that are lights (or have a light component). */
const LIGHT_CATS = new Set([
  'dj',  // 彩灯  strip / bulb
  'dd',  // 台灯  desk lamp
  'dc',  // 灯串  string light
  'xdd', // 射灯  spotlight / downlight
  'fwd', // 泛光灯 flood light
  'tgq', // 调光开关 dimmer switch
  'cpd', // 吸顶灯 ceiling light
  'fsd', // 风扇灯 fan+light combo
]);

/** Tuya device categories that are fans (or have a fan component). */
const FAN_CATS = new Set([
  'fs',  // 风扇
  'fsd', // 风扇灯 fan+light combo
]);

// ── Module-level map: deviceId → category (for control path selection) ────────
const categoryMap = new Map<string, string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatus(statuses: TuyaStatus[], ...codes: string[]): TuyaStatus | undefined {
  for (const code of codes) {
    const s = statuses.find(e => e.code === code);
    if (s !== undefined) return s;
  }
  return undefined;
}

/** Convert a raw Tuya brightness value to 0–100 percent. */
function brightnessToPercent(raw: number): number {
  // Devices use either 10–1000 or 25–255 range.
  if (raw > 255) return Math.round(((raw - 10) / 990) * 100);
  return Math.round(((raw - 25) / 230) * 100);
}

/** Convert 0–100 percent to the Tuya brightness range for this device. */
function percentToBrightness(percent: number, isWideRange: boolean): number {
  if (isWideRange) return Math.round(10 + (percent / 100) * 990);
  return Math.round(25 + (percent / 100) * 230);
}

/**
 * Map a raw Tuya fan speed value to a discrete level 1–5.
 * Tuya SmartLife fans typically use string enums: "1"/"2"/"3"/"4"/"5"
 * or named presets like "low"/"medium"/"high".
 */
function fanSpeedToLevel(value: boolean | number | string): number {
  const v = String(value).toLowerCase().trim();
  const asNum = parseInt(v, 10);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= 5) return asNum;
  // Named presets → nearest of 5 levels
  const named: Record<string, number> = { low: 1, medium: 3, high: 5, turbo: 5, 'super high': 5 };
  return named[v] ?? 1;
}

// ── Device conversion ─────────────────────────────────────────────────────────

function tuyaToDevice(raw: TuyaDevice): Device | null {
  const cat = raw.category;
  const isLight = LIGHT_CATS.has(cat);
  const isFan = FAN_CATS.has(cat);
  if (!isLight && !isFan) return null;

  categoryMap.set(raw.id, cat);

  // On/off — lights use switch_led, fans use Power, others use switch
  const switchStatus = isLight
    ? getStatus(raw.status, 'switch_led', 'switch_1', 'switch')
    : isFan
      ? getStatus(raw.status, 'Power', 'switch')
      : getStatus(raw.status, 'switch', 'switch_1');
  const isOn = switchStatus ? Boolean(switchStatus.value) : false;

  // Type
  let type: Device['type'] = isLight ? 'LIGHT' : 'FAN';

  // Brightness (lights only)
  let brightness = -1;
  if (isLight) {
    const brightSt = getStatus(raw.status, 'bright_value_v2', 'bright_value');
    if (brightSt && typeof brightSt.value === 'number') {
      type = 'DIMMABLE_LIGHT';
      brightness = brightnessToPercent(brightSt.value);
    }
  }

  // Fan speed (level 1–5) and built-in light
  let fanSpeed = -1;
  let fanLight = '';
  if (isFan) {
    const speedSt = getStatus(raw.status, 'WindSpeed', 'fan_speed');
    if (speedSt) fanSpeed = fanSpeedToLevel(speedSt.value);
    const lightSt = getStatus(raw.status, 'Light');
    fanLight = lightSt ? String(lightSt.value) : '';
}

  return {
    id: raw.id,
    name: raw.name,
    room: raw.room_name ?? '',
    structure: raw.home_name ?? '',
    type,
    online: raw.online ?? true,
    isOn,
    brightness,
    fanSpeed,
    fanLight,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches all devices from the Tuya cloud project.
 *
 * REQUIREMENT: In the Tuya Developer Console, go to your project →
 * "Devices" → "Link Tuya App Account" and scan the QR code with your
 * SmartLife (or Wipro Next / Tuya) app.  Only then will devices appear here.
 *
 * Also ensure these API Products are enabled on your project:
 *   • IoT Core  (for /v1.1/iot-03/devices)
 *   • Device Status Notification (optional but useful)
 */
export async function fetchDevices(): Promise<Device[]> {
  const ids = tuyaApi.getDeviceIds();
  if (ids.length === 0) return [];
  // Fetch each device individually — /v1.0/devices/{id} is covered by IoT Core
  // and doesn't require devices to be linked to the Cloud project.
  const results = await Promise.allSettled(
    ids.map(id => tuyaApi.get<TuyaDevice>(`/v1.0/devices/${id}`)),
  );
  return results.flatMap(r => {
    if (r.status === 'rejected') return [];
    const device = tuyaToDevice(r.value);
    return device ? [device] : [];
  });
}

/**
 * Toggle a device on or off.
 * Automatically selects the correct switch command code based on device category.
 */
export async function controlOnOff(deviceId: string, isOn: boolean): Promise<void> {
  const cat = categoryMap.get(deviceId) ?? '';
  const isFanDevice = FAN_CATS.has(cat);
  const code = isFanDevice ? 'Power' : LIGHT_CATS.has(cat) ? 'switch_led' : 'switch';
  await tuyaApi.post(`/v1.0/devices/${deviceId}/commands`, {
    commands: [{ code, value: isOn }],
  });
}

/**
 * Set brightness for a dimmable light (0–100 percent).
 * Handles both 10–1000 and 25–255 Tuya brightness ranges automatically.
 */
export async function controlBrightness(deviceId: string, percent: number): Promise<void> {
  // Prefer the v2 code (10–1000 range); the device will ignore codes it doesn't have.
  const wideValue = percentToBrightness(percent, true);
  const narrowValue = percentToBrightness(percent, false);
  await tuyaApi.post(`/v1.0/devices/${deviceId}/commands`, {
    commands: [
      { code: 'bright_value_v2', value: wideValue },
      { code: 'bright_value', value: narrowValue },
    ],
  });
}

export async function controlFanSpeed(deviceId: string, level: number): Promise<void> {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  await tuyaApi.post(`/v1.0/devices/${deviceId}/commands`, {
    commands: [
      { code: 'Power', value: true },
      { code: 'WindSpeed', value: String(clamped) },
    ],
  });
}

export async function controlFanLight(
  deviceId: string,
  level: 'Off' | 'Level1' | 'Level2' | 'Level3',
): Promise<void> {
  await tuyaApi.post(`/v1.0/devices/${deviceId}/commands`, {
    commands: [{ code: 'Light', value: level }],
  });
}
