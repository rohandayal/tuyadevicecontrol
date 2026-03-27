/**
 * Light-weight config export / import.
 *
 * Purpose: prevent credentials from being plaintext in a chat message,
 * QR code, email, etc.  Not intended as strong security — the key is
 * bundled with the app.
 *
 * Format:  "HC1:<base64-encoded AES ciphertext>"
 */

import CryptoJS from 'crypto-js';
import type { TuyaCredentials } from '../storage/credentials';

// Passing parsed WordArrays for key + IV avoids crypto-js calling
// getRandomValues (which fails in some React Native environments).
const KEY = CryptoJS.enc.Utf8.parse('homeCtrl-v1-9k2x'); // 16 bytes
const IV  = CryptoJS.enc.Utf8.parse('hcIV00000000v1-x'); // 16 bytes
const PREFIX = 'HC1:';
const AES_OPT = { iv: IV };

/**
 * Serialise and encrypt credentials into a shareable string.
 */
export function exportConfig(creds: TuyaCredentials): string {
  const json = JSON.stringify(creds);
  const encrypted = CryptoJS.AES.encrypt(json, KEY, AES_OPT).toString();
  return PREFIX + encrypted;
}

/**
 * Decrypt an exported config string and return the credentials.
 * Throws a human-readable Error if the string is malformed or decryption fails.
 */
export function importConfig(raw: string): TuyaCredentials {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error('Not a valid HomeControl config (missing HC1: header).');
  }
  const cipher = trimmed.slice(PREFIX.length);
  let json: string;
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, KEY, AES_OPT);
    json = bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new Error('Failed to decrypt config — the text may be corrupt.');
  }
  if (!json) {
    throw new Error('Failed to decrypt config — the text may be corrupt.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Config decrypted but contained invalid data.');
  }
  const c = parsed as Record<string, unknown>;
  if (
    typeof c.accessId !== 'string' ||
    typeof c.secret !== 'string' ||
    typeof c.region !== 'string' ||
    !Array.isArray(c.deviceIds)
  ) {
    throw new Error('Config is missing required fields (accessId, secret, region, deviceIds).');
  }
  return {
    accessId: c.accessId,
    secret: c.secret,
    region: c.region as TuyaCredentials['region'],
    deviceIds: c.deviceIds as string[],
    lightGroups: Array.isArray(c.lightGroups) ? (c.lightGroups as TuyaCredentials['lightGroups']) : [],
  };
}
