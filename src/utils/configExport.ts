/**
 * Light-weight config export / import.
 *
 * Purpose: prevent credentials from being plaintext in a chat message,
 * QR code, email, etc.  Not intended as strong security — the key is
 * bundled with the app.
 *
 * Formats:
 *   - HC1 (legacy): "HC1:<base64-encoded AES ciphertext>"
 *   - HC2 (current): "HC2:<base64-encoded AES ciphertext>"
 *
 * Payload (v2, new format):  { tuya?: TuyaCredentials, cync?: CyncCredentials }
 * Payload (v1, old format):  TuyaCredentials directly (supported on import for compat)
 *
 * Cync passwords are never stored; the loginCode token + device list are sufficient
 * to restore connectivity on import.
 */

import CryptoJS from 'crypto-js';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import type { TuyaCredentials } from '../storage/credentials';
import type { CyncCredentials } from '../types/cyncDevice';

// Passing parsed WordArrays for key + IV avoids crypto-js calling
// getRandomValues (which fails in some React Native environments).
const KEY = CryptoJS.enc.Utf8.parse('homeCtrl-v1-9k2x'); // 16 bytes
const IV  = CryptoJS.enc.Utf8.parse('hcIV00000000v1-x'); // 16 bytes
const PREFIX_HC1 = 'HC1:';
const PREFIX_HC2 = 'HC2:';
const AES_OPT = { iv: IV };

interface HC2LightGroup {
  i: string;
  n: string;
  d: string[];
}

interface HC2Tuya {
  a: string;
  s: string;
  r: TuyaCredentials['region'];
  d: string[];
  g?: HC2LightGroup[];
  h?: string;
  m?: Record<string, string>;
  o?: Record<string, number>;
}

type HC2CyncDevice = [
  id: string,
  name: string,
  switchId: number,
  meshId: number,
  homeId: string,
  homeName?: string,
  supportsBrightness?: boolean,
  supportsColorTemp?: boolean,
  supportsRgb?: boolean,
];

interface HC2Cync {
  u: number;
  l: number[];
  v: HC2CyncDevice[];
}

interface HC2Payload {
  t?: HC2Tuya;
  c?: HC2Cync;
}

export interface ExportedConfig {
  tuya?: TuyaCredentials;
  cync?: CyncCredentials;
}

function encryptString(plain: string): string {
  return CryptoJS.AES.encrypt(plain, KEY, AES_OPT).toString();
}

function decryptString(cipher: string): string {
  let plain: string;
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, KEY, AES_OPT);
    plain = bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new Error('Failed to decrypt config — the text may be corrupt.');
  }
  if (!plain) {
    throw new Error('Failed to decrypt config — the text may be corrupt.');
  }
  return plain;
}

function toHC2Tuya(t: TuyaCredentials): HC2Tuya {
  return {
    a: t.accessId,
    s: t.secret,
    r: t.region,
    d: t.deviceIds,
    g: (t.lightGroups ?? []).map(g => ({ i: g.id, n: g.name, d: g.deviceIds })),
    h: t.homeName || 'My Home',
    m: t.deviceRooms ?? {},
    o: t.deviceOrder ?? {},
  };
}

function fromHC2Tuya(t: HC2Tuya): TuyaCredentials {
  if (
    typeof t.a !== 'string' ||
    typeof t.s !== 'string' ||
    typeof t.r !== 'string' ||
    !Array.isArray(t.d)
  ) {
    throw new Error('HC2 Tuya payload is missing required fields.');
  }
  return {
    accessId: t.a,
    secret: t.s,
    region: t.r as TuyaCredentials['region'],
    deviceIds: t.d,
    lightGroups: Array.isArray(t.g)
      ? t.g.map(g => ({ id: g.i, name: g.n, deviceIds: g.d ?? [] }))
      : [],
    homeName: (t.h || 'My Home').trim() || 'My Home',
    deviceRooms: t.m ?? {},
    deviceOrder: t.o ?? {},
  };
}

function toHC2Cync(c: CyncCredentials): HC2Cync {
  return {
    u: c.userId,
    l: c.loginCode,
    v: c.devices.map(d => [
      d.id,
      d.name,
      d.switchId,
      d.meshId,
      d.homeId,
      d.homeName,
      d.supportsBrightness,
      d.supportsColorTemp,
      d.supportsRgb,
    ]),
  };
}

function fromHC2Cync(c: HC2Cync): CyncCredentials {
  if (typeof c.u !== 'number' || !Array.isArray(c.l) || !Array.isArray(c.v)) {
    throw new Error('HC2 Cync payload is missing required fields.');
  }
  return {
    userId: c.u,
    loginCode: c.l,
    devices: c.v.map(v => ({
      id: v[0],
      name: v[1],
      switchId: v[2],
      meshId: v[3],
      homeId: v[4],
      homeName: v[5],
      supportsBrightness: v[6] ?? false,
      supportsColorTemp: v[7] ?? false,
      supportsRgb: v[8] ?? false,
    })),
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Config decrypted but contained invalid data.');
  }
}

function parseLegacyTuyaRecord(c: Record<string, unknown>): TuyaCredentials {
  if (
    typeof c.secret !== 'string' ||
    typeof c.region !== 'string' ||
    !Array.isArray(c.deviceIds)
  ) {
    throw new Error('Config is missing required fields (accessId, secret, region, deviceIds).');
  }
  return {
    accessId: c.accessId as string,
    secret: c.secret,
    region: c.region as TuyaCredentials['region'],
    deviceIds: c.deviceIds as string[],
    lightGroups: Array.isArray(c.lightGroups)
      ? (c.lightGroups as TuyaCredentials['lightGroups'])
      : [],
    homeName: (typeof c.homeName === 'string' ? c.homeName : 'My Home') || 'My Home',
    deviceRooms: (c.deviceRooms as TuyaCredentials['deviceRooms']) ?? {},
    deviceOrder: (c.deviceOrder as TuyaCredentials['deviceOrder']) ?? {},
  };
}

function parseLegacyPayload(parsed: unknown): ExportedConfig {
  const c = parsed as Record<string, unknown>;

  // v1 compat: payload IS a TuyaCredentials object (has accessId at root)
  if (typeof c.accessId === 'string') {
    return { tuya: parseLegacyTuyaRecord(c) };
  }

  // v2: { tuya?, cync? }
  const result: ExportedConfig = {};

  if (c.tuya && typeof c.tuya === 'object') {
    const t = c.tuya as Record<string, unknown>;
    if (
      typeof t.accessId === 'string' &&
      typeof t.secret === 'string' &&
      typeof t.region === 'string' &&
      Array.isArray(t.deviceIds)
    ) {
      result.tuya = parseLegacyTuyaRecord(t as Record<string, unknown>);
    }
  }

  if (c.cync && typeof c.cync === 'object') {
    const cy = c.cync as Record<string, unknown>;
    if (
      typeof cy.userId === 'number' &&
      Array.isArray(cy.loginCode) &&
      Array.isArray(cy.devices)
    ) {
      result.cync = {
        userId: cy.userId,
        loginCode: cy.loginCode as number[],
        devices: cy.devices as CyncCredentials['devices'],
      };
    }
  }

  if (!result.tuya && !result.cync) {
    throw new Error('Config contained no recognisable credentials.');
  }
  return result;
}

/**
 * Serialise and encrypt credentials into a shareable string.
 * Pass null for either argument to omit it from the export.
 */
export function exportConfig(
  tuya: TuyaCredentials | null,
  cync: CyncCredentials | null,
): string {
  const payload: HC2Payload = {};
  if (tuya) payload.t = toHC2Tuya(tuya);
  if (cync) payload.c = toHC2Cync(cync);

  const compactJson = JSON.stringify(payload);
  const compressed = compressToEncodedURIComponent(compactJson);
  const encrypted = encryptString(compressed);
  return PREFIX_HC2 + encrypted;
}

/**
 * Decrypt an exported config string and return whichever credentials are present.
 * Throws a human-readable Error if the string is malformed or decryption fails.
 * Supports both v1 (Tuya-only) and v2 (tuya + cync) payloads.
 */
export function importConfig(raw: string): ExportedConfig {
  const trimmed = raw.trim();

  if (trimmed.startsWith(PREFIX_HC2)) {
    const cipher = trimmed.slice(PREFIX_HC2.length);
    const compressed = decryptString(cipher);
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) {
      throw new Error('Failed to decode HC2 payload — the text may be corrupt.');
    }
    const parsed = parseJson(json) as HC2Payload;
    const result: ExportedConfig = {};
    if (parsed.t) result.tuya = fromHC2Tuya(parsed.t);
    if (parsed.c) result.cync = fromHC2Cync(parsed.c);
    if (!result.tuya && !result.cync) {
      throw new Error('Config contained no recognisable credentials.');
    }
    return result;
  }

  if (trimmed.startsWith(PREFIX_HC1)) {
    const cipher = trimmed.slice(PREFIX_HC1.length);
    const json = decryptString(cipher);
    return parseLegacyPayload(parseJson(json));
  }

  throw new Error('Not a valid HomeControl config (missing HC1:/HC2: header).');
}
