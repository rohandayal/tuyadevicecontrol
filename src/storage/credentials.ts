import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LightGroup } from '../types/lightGroup';
import type { CyncCredentials, CyncDevice } from '../types/cyncDevice';

export type { LightGroup };
export type { CyncCredentials };
export type TuyaRegion = 'us' | 'eu' | 'cn' | 'in';

export interface TuyaCredentials {
  accessId: string;
  secret: string;
  region: TuyaRegion;
  deviceIds: string[];
  lightGroups: LightGroup[];
  /** User-editable home title shown on HomeScreen. */
  homeName: string;
  /** Maps deviceId → custom room name assigned by the user. */
  deviceRooms: Record<string, string>;
  /** Maps device key (e.g. tuya:abc / cync:123) -> manual display order index. */
  deviceOrder: Record<string, number>;
}

const KEY = 'tuya_credentials';

export async function saveCredentials(creds: TuyaCredentials): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(creds));
}

export async function loadCredentials(): Promise<TuyaCredentials | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TuyaCredentials;
    // Migrate older saves that didn't have deviceIds / lightGroups / homeName / deviceRooms / deviceOrder
    return {
      ...parsed,
      deviceIds: parsed.deviceIds ?? [],
      lightGroups: parsed.lightGroups ?? [],
      homeName: parsed.homeName?.trim() || 'My Home',
      deviceRooms: parsed.deviceRooms ?? {},
      deviceOrder: parsed.deviceOrder ?? {},
    };
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// ── Cync credentials ──────────────────────────────────────────────────────────

const CYNC_KEY = 'cync_credentials';
const CYNC_RUNTIME_KEY = 'cync_runtime_state';
const DEVICE_ROOMS_KEY = 'device_rooms';
const DEVICE_ORDER_KEY = 'device_order';

export interface CyncRuntimeStateItem {
  isOn: boolean;
  brightness: number;
  colorTemp: number;
  mode: 'white' | 'colour';
  hue: number;
  sat: number;
}

export type CyncRuntimeState = Record<string, CyncRuntimeStateItem>;

export async function saveCyncCredentials(creds: CyncCredentials): Promise<void> {
  await AsyncStorage.setItem(CYNC_KEY, JSON.stringify(creds));
}

export async function loadCyncCredentials(): Promise<CyncCredentials | null> {
  const raw = await AsyncStorage.getItem(CYNC_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CyncCredentials;
  } catch {
    return null;
  }
}

export async function clearCyncCredentials(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(CYNC_KEY),
    AsyncStorage.removeItem(CYNC_RUNTIME_KEY),
  ]);
}

export async function saveDeviceRooms(deviceRooms: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(DEVICE_ROOMS_KEY, JSON.stringify(deviceRooms));
}

export async function loadDeviceRooms(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(DEVICE_ROOMS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function saveDeviceOrder(deviceOrder: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(DEVICE_ORDER_KEY, JSON.stringify(deviceOrder));
}

export async function loadDeviceOrder(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(DEVICE_ORDER_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function saveCyncRuntimeState(devices: CyncDevice[]): Promise<void> {
  const state: CyncRuntimeState = {};
  devices.forEach(d => {
    state[d.id] = {
      isOn: d.isOn,
      brightness: d.brightness,
      colorTemp: d.colorTemp,
      mode: d.mode,
      hue: d.hue,
      sat: d.sat,
    };
  });
  await AsyncStorage.setItem(CYNC_RUNTIME_KEY, JSON.stringify(state));
}

export async function loadCyncRuntimeState(): Promise<CyncRuntimeState> {
  const raw = await AsyncStorage.getItem(CYNC_RUNTIME_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CyncRuntimeState;
    return parsed ?? {};
  } catch {
    return {};
  }
}
