import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LightGroup } from '../types/lightGroup';

export type { LightGroup };
export type TuyaRegion = 'us' | 'eu' | 'cn' | 'in';

export interface TuyaCredentials {
  accessId: string;
  secret: string;
  region: TuyaRegion;
  deviceIds: string[];
  lightGroups: LightGroup[];
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
    // Migrate older saves that didn't have deviceIds / lightGroups
    return { ...parsed, deviceIds: parsed.deviceIds ?? [], lightGroups: parsed.lightGroups ?? [] };
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
