/**
 * Tuya OpenAPI v1.0 client with HMAC-SHA256 request signing.
 *
 * Tuya's current signing spec (URL-aware, required since ~2022):
 *
 *   StringToSign = HTTPMethod + "\n"
 *                + SHA256(requestBody || "") + "\n"
 *                + "" + "\n"          ← signed headers (none for our calls)
 *                + urlPathWithQuery
 *
 *   For token endpoint (no access token):
 *     strForSign = clientId + t + nonce + StringToSign
 *
 *   For all other endpoints (authenticated):
 *     strForSign = clientId + accessToken + t + nonce + StringToSign
 *
 *   sign = HMAC-SHA256(strForSign, secret).hex().toUpperCase()
 *
 * Docs: https://developer.tuya.com/en/docs/cloud/authentication
 */
import CryptoJS from 'crypto-js';
import type { TuyaCredentials, TuyaRegion } from '../storage/credentials';

export type { TuyaCredentials, TuyaRegion };

export const REGION_LABELS: Record<TuyaRegion, string> = {
  in: 'India',
  us: 'Western America',
  eu: 'Western Europe',
  cn: 'China',
};

const BASE_URLS: Record<TuyaRegion, string> = {
  in: 'https://openapi.tuyain.com',
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  cn: 'https://openapi.tuyacn.com',
};

// SHA-256 of the empty string — used for GET / bodyless requests
const EMPTY_BODY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** UUID v4 generator — no external dependency needed. */
function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Sorts query parameters alphabetically by key.
 * Tuya's server sorts params before computing the expected signature,
 * so the URL in stringToSign must be in the same sorted order.
 */
function sortedQueryUrl(path: string): string {
  const qIdx = path.indexOf('?');
  if (qIdx === -1) return path;
  const base = path.slice(0, qIdx);
  const sorted = path
    .slice(qIdx + 1)
    .split('&')
    .sort()
    .join('&');
  return `${base}?${sorted}`;
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  uid: string;
}

let _creds: TuyaCredentials | null = null;
let _token: TokenData | null = null;

export function setCredentials(creds: TuyaCredentials): void {
  _creds = creds;
  _token = null;
}

// ── Signing helpers ───────────────────────────────────────────────────────────

function sha256Hex(data: string): string {
  return CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(data)).toString(CryptoJS.enc.Hex);
}

/**
 * Builds the full signature string for a Tuya API request.
 *
 * @param accessId   - Project Access ID (client_id)
 * @param secret     - Project Access Secret
 * @param t          - Unix timestamp in milliseconds (string)
 * @param accessToken - Pass null for the token-fetch endpoint
 * @param method     - HTTP method
 * @param path       - URL path + query string, e.g. "/v1.0/token?grant_type=1"
 * @param body       - Request body object (POST requests)
 */
function buildSign(
  accessId: string,
  secret: string,
  t: string,
  nonce: string,
  accessToken: string | null,
  method: 'GET' | 'POST',
  path: string,
  body?: object,
): string {
  const contentHash = body ? sha256Hex(JSON.stringify(body)) : EMPTY_BODY_SHA256;
  // Query params must be sorted alphabetically for the signature URL
  const signPath = sortedQueryUrl(path);
  const stringToSign = [method, contentHash, '', signPath].join('\n');
  // identifier is empty for Access Key projects (grant_type=1).
  // For Android app-auth projects set it to SHA1_hex + packageName.
  const identifier = '';
  const strForSign = accessId + (accessToken ?? '') + t + nonce + identifier + stringToSign;

  const sign = CryptoJS.HmacSHA256(
    CryptoJS.enc.Utf8.parse(strForSign),
    CryptoJS.enc.Utf8.parse(secret),
  )
    .toString(CryptoJS.enc.Hex)
    .toUpperCase();

  return sign;
}

// ── Token management ──────────────────────────────────────────────────────────

async function fetchNewToken(creds: TuyaCredentials): Promise<TokenData> {
  const path = '/v1.0/token?grant_type=1';
  const t = Date.now().toString();
  const nonce = randomUUID();
  const sign = buildSign(creds.accessId, creds.secret, t, nonce, null, 'GET', path);

  const res = await fetch(`${BASE_URLS[creds.region]}${path}`, {
    method: 'GET',
    headers: {
      client_id: creds.accessId,
      sign_method: 'HMAC-SHA256',
      nonce,
      t,
      sign,
    },
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(
      json.msg
        ? `Tuya auth error: ${json.msg} (code ${json.code})`
        : 'Failed to obtain Tuya access token — check your Access ID, Secret, and Region.',
    );
  }

  return {
    // Trim to guard against invisible whitespace silently corrupting signatures
    accessToken: String(json.result.access_token).trim(),
    refreshToken: String(json.result.refresh_token).trim(),
    expiresAt: Date.now() + json.result.expire_time * 1000 - 60_000,
    uid: String(json.result.uid).trim(),
  };
}

async function getToken(): Promise<TokenData> {
  if (_token && Date.now() < _token.expiresAt) return _token;
  if (!_creds) throw new Error('Tuya credentials not configured.');
  _token = await fetchNewToken(_creds);
  return _token;
}

// ── Core request helper ───────────────────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: object,
  isRetry = false,
): Promise<T> {
  const creds = _creds;
  if (!creds) throw new Error('Tuya credentials not configured.');

  const token = await getToken();
  const t = Date.now().toString();
  const nonce = randomUUID();
  const sign = buildSign(creds.accessId, creds.secret, t, nonce, token.accessToken, method, path, body);

  const headers: Record<string, string> = {
    client_id: creds.accessId,
    access_token: token.accessToken,
    sign_method: 'HMAC-SHA256',
    nonce,
    t,
    sign,
  };
  // Only send Content-Type on requests that actually have a body
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URLS[creds.region]}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  // 1010 = token invalid/expired — refresh once and retry
  if (!json.success && json.code === 1010 && !isRetry) {
    _token = null;
    return request<T>(method, path, body, true);
  }

  if (!json.success) {
    throw new Error(
      json.msg
        ? `Tuya API error: ${json.msg} (code ${json.code})`
        : `Tuya API request failed (code ${json.code})`,
    );
  }

  return json.result as T;
}

export const tuyaApi = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: object) => request<T>('POST', path, body),
  getUid: async () => (await getToken()).uid,
  getDeviceIds: () => _creds?.deviceIds ?? [],
  getLightGroups: () => _creds?.lightGroups ?? [],

  /** Validate credentials by fetching a token. Returns the account UID. */
  validateCredentials: async (creds: TuyaCredentials): Promise<string> => {
    setCredentials(creds);
    const token = await fetchNewToken(creds);
    _token = token;
    return token.uid;
  },
};
