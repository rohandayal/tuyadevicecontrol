/* eslint-disable no-bitwise */
/**
 * Cync (GE) API + TCP control client.
 *
 * Protocol reference: https://github.com/nikshriv/cync_lights
 *
 * Auth flow:
 *   1. POST /v2/user_auth  → { user_id, access_token, authorize }
 *      If HTTP 400 → 2FA required:
 *        POST /v2/two_factor/email/verifycode  (request the code)
 *        POST /v2/user_auth/two_factor         → same fields
 *   2. Build loginCode bytes from user_id + authorize token
 *   3. Store only loginCode + user_id + device list — password is never saved.
 *
 * Control flow:
 *   1. Open TLS TCP connection to cm.gelighting.com:23779
 *   2. Send loginCode bytes as first packet
 *   3. Send binary control packets per device
 *   4. Send heartbeat (0xd3 packet) every 180 s
 */

import TcpSocket from 'react-native-tcp-socket';
import type { CyncDevice, StoredCyncDevice } from '../types/cyncDevice';

// ── API endpoints ─────────────────────────────────────────────────────────────

const API_AUTH = 'https://api.gelighting.com/v2/user_auth';
const API_REQUEST_CODE = 'https://api.gelighting.com/v2/two_factor/email/verifycode';
const API_2FACTOR_AUTH = 'https://api.gelighting.com/v2/user_auth/two_factor';
const API_DEVICES = 'https://api.gelighting.com/v2/user/{user}/subscribe/devices';
const API_DEVICE_INFO =
  'https://api.gelighting.com/v2/product/{product_id}/device/{device_id}/property';

const CORP_ID = '1007d2ad150c4000';

// ── Capability maps (deviceType integer → supported features) ─────────────────
// Source: nikshriv/cync_lights cync_hub.py

const CAP_BRIGHTNESS = new Set([
  1, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25,
  26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 47, 48, 49, 55, 56, 80, 81,
  82, 83, 85, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140,
  141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155,
  156, 158, 159, 160, 161, 162, 163, 164, 165, 166, 169, 170, 171,
]);

const CAP_COLORTEMP = new Set([
  5, 6, 7, 8, 10, 11, 14, 15, 19, 20, 21, 22, 23, 25, 26, 28, 29, 30, 31, 32,
  33, 34, 35, 47, 80, 82, 83, 85, 129, 130, 131, 132, 133, 135, 136, 137, 138,
  139, 140, 141, 142, 143, 144, 145, 146, 147, 153, 154, 155, 156, 158, 159,
  160, 161, 162, 163, 164, 165, 166, 169, 170, 171,
]);

const CAP_RGB = new Set([
  6, 7, 8, 21, 22, 23, 30, 31, 32, 33, 34, 35, 47, 131, 132, 133, 137, 138,
  139, 140, 141, 142, 143, 146, 147, 153, 154, 155, 156, 158, 159, 160, 161,
  162, 163, 164, 165, 166, 169, 170, 171,
]);

// ── Sequence counter ──────────────────────────────────────────────────────────

let _seq = 0;
function nextSeq(): number {
  _seq = _seq >= 65535 ? 1 : _seq + 1;
  return _seq;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/**
 * Build the binary TCP login packet from the authorize token string.
 * Format (from reverse engineering):
 *   0x13 0x00 0x00 0x00 <len+10> 0x03 <userId 4B big-endian>
 *   <tokenLen 2B big-endian> <token ASCII> 0x00 0x00 0xb4
 */
function buildLoginCode(userId: number, authorize: string): number[] {
  const tokenBytes = Array.from(authorize).map(c => c.charCodeAt(0));
  const totalLen = 10 + tokenBytes.length;
  const userIdBytes = [
    (userId >>> 24) & 0xff,
    (userId >>> 16) & 0xff,
    (userId >>> 8) & 0xff,
    userId & 0xff,
  ];
  const tokenLenBytes = [(tokenBytes.length >>> 8) & 0xff, tokenBytes.length & 0xff];
  const packet = [
    0x13, 0x00, 0x00, 0x00,
    totalLen,
    0x03,
    ...userIdBytes,
    ...tokenLenBytes,
    ...tokenBytes,
    0x00, 0x00, 0x1e,
  ];
  return packet;
}

// ── Public auth API ───────────────────────────────────────────────────────────

export type AuthResult =
  | { status: 'ok'; userId: number; accessToken: string; loginCode: number[] }
  | { status: 'two_factor_required' }
  | { status: 'error'; message: string };

/** Step 1: Authenticate with email + password.
 * If the server requires 2FA, the code request email is sent here automatically.
 * Returns two_factor_required only when the code was successfully dispatched.
 */
export async function authenticate(email: string, password: string): Promise<AuthResult> {
  try {
    const resp = await fetch(API_AUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corp_id: CORP_ID, email, password }),
    });
    if (resp.status === 200) {
      const data = await resp.json();
      const loginCode = buildLoginCode(data.user_id, data.authorize);
      return { status: 'ok', userId: data.user_id, accessToken: data.access_token, loginCode };
    }
    if (resp.status === 400) {
      // Per reference implementation: on 400, attempt to send the 2FA code.
      // Only treat as two_factor_required if that request succeeds (HTTP 200).
      const body400 = await resp.json().catch(() => ({}));
      const codeResp = await fetch(API_REQUEST_CODE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corp_id: CORP_ID, email, local_lang: 'en-us' }),
      });
      if (codeResp.status === 200) {
        return { status: 'two_factor_required' };
      }
      await codeResp.json().catch(() => ({}));
      return {
        status: 'error',
        message: `Login failed: ${JSON.stringify(body400)}`,
      };
    }
    const errBody = await resp.json().catch(() => ({}));
    return { status: 'error', message: `Auth failed (HTTP ${resp.status}): ${JSON.stringify(errBody)}` };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** Step 2 (when 2FA required): Submit the verification code. */
export async function authTwoFactor(
  email: string,
  password: string,
  code: string,
): Promise<AuthResult> {
  try {
    const resp = await fetch(API_2FACTOR_AUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corp_id: CORP_ID,
        email,
        password,
        two_factor: code,
        resource: 'abcdefghijklmnop',
      }),
    });
    if (resp.status === 200) {
      const data = await resp.json();
      const loginCode = buildLoginCode(data.user_id, data.authorize);
      return { status: 'ok', userId: data.user_id, accessToken: data.access_token, loginCode };
    }
    const errBody = await resp.json().catch(() => ({}));
    return { status: 'error', message: `2FA auth failed (HTTP ${resp.status}): ${JSON.stringify(errBody)}` };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

// ── Device discovery ──────────────────────────────────────────────────────────

interface CyncRawDevice {
  deviceID: number;
  displayName: string;
  deviceType: number;
  switchID?: number;
}

interface CyncHome {
  id: number;
  name: string;
  product_id: string;
}

interface CyncHomeInfo {
  bulbsArray?: CyncRawDevice[];
  groupsArray?: unknown[];
}

/**
 * Fetch all devices for the authenticated user using the short-lived
 * access_token obtained during login. Returns a list ready to be stored.
 */
export async function fetchCyncDevices(
  userId: number,
  accessToken: string,
): Promise<StoredCyncDevice[]> {
  const headers = { 'Access-Token': accessToken };

  const homesResp = await fetch(API_DEVICES.replace('{user}', String(userId)), { headers });
  if (!homesResp.ok) throw new Error(`Failed to fetch homes (HTTP ${homesResp.status})`);
  const homes: CyncHome[] = await homesResp.json();

  const devices: StoredCyncDevice[] = [];

  for (const home of homes) {
    const infoResp = await fetch(
      API_DEVICE_INFO.replace('{product_id}', home.product_id).replace(
        '{device_id}',
        String(home.id),
      ),
      { headers },
    );
    if (!infoResp.ok) continue;
    const info: CyncHomeInfo = await infoResp.json();

    if (!info.bulbsArray || info.bulbsArray.length === 0) continue;

    for (const dev of info.bulbsArray) {
      // meshId = position of device within the home's device array
      const meshId = (dev.deviceID % home.id) % 1000 + Math.floor((dev.deviceID % home.id) / 1000) * 256;
      devices.push({
        id: String(dev.deviceID),
        name: dev.displayName,
        switchId: dev.switchID ?? 0,
        meshId,
        homeId: String(home.id),
        homeName: home.name,
        supportsBrightness: CAP_BRIGHTNESS.has(dev.deviceType),
        supportsColorTemp: CAP_COLORTEMP.has(dev.deviceType),
        supportsRgb: CAP_RGB.has(dev.deviceType),
      });
    }
  }

  if (devices.length === 0) throw new Error('No controllable Cync devices found.');
  return devices;
}

/** Convert stored device list to runtime CyncDevice objects (state initialised off). */
export function storedToCyncDevices(stored: StoredCyncDevice[]): CyncDevice[] {
  return stored.map(d => ({
    ...d,
    homeName: d.homeName ?? '',
    isOn: false,
    brightness: d.supportsBrightness ? 0 : -1,
    colorTemp: d.supportsColorTemp ? 0 : -1,
    mode: 'white',
    hue: 0,
    sat: 0,
    supportsRgb: d.supportsRgb ?? d.supportsColorTemp,
  }));
}

// ── TCP client ────────────────────────────────────────────────────────────────

type Socket = ReturnType<typeof TcpSocket.createConnection>;

type CyncStateListener = (id: string, patch: Partial<CyncDevice>) => void;

const CYNC_ENDPOINTS = [
  { host: 'cm.gelighting.com', port: 23779 },
  { host: 'cm-sec.gelighting.com', port: 23779 },
];

let _socket: Socket | null = null;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _loginCode: number[] | null = null;
let _disconnecting = false;
let _connected = false;          // true only after TLS handshake
let _pendingWrites: Uint8Array[] = [];  // queued until connected
let _onLoginFailedCb: (() => void) | null = null;
let _loginFailureCount = 0;      // consecutive closes without receiving data
let _storedDevices: StoredCyncDevice[] = [];
let _probeFlushTimer: ReturnType<typeof setTimeout> | null = null;
let _endpointIndex = 0;
let _sawTlsProtocolAlert = false;
let _sawChainValidationFailure = false;
let _onStateListener: CyncStateListener | null = null;
let _switchIdToHomeId: Record<number, string> = {};
let _homeMeshToDevice: Record<string, Record<number, StoredCyncDevice>> = {};

/** Callback invoked on unrecoverable login failure (expired token). */
// (reserved for future re-auth flow)
// let _onLoginFailed: (() => void) | null = null;

function clearRetryTimer() {
  if (_retryTimer !== null) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }
}

function clearHeartbeat() {
  if (_heartbeatTimer !== null) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

function getEndpoint() {
  return CYNC_ENDPOINTS[_endpointIndex];
}

function rotateEndpoint() {
  _endpointIndex = (_endpointIndex + 1) % CYNC_ENDPOINTS.length;
}

function startHeartbeat() {
  clearHeartbeat();
  _heartbeatTimer = setInterval(() => {
    sendRaw(new Uint8Array([0xd3, 0x00, 0x00, 0x00, 0x00]));
  }, 20_000);
}

function sendRaw(buf: Uint8Array) {
  if (!_socket) {
    return;
  }
  if (!_connected || !_loginAcked) {
    _pendingWrites.push(buf);
    return;
  }
  try {
    _socket.write(buf);
  } catch {
  }
}

/** Open (or re-open) the TLS TCP connection to the Cync server. */
/** Provide the stored device list so probe packets are sent after login. Must be called before cyncConnect(). */
export function cyncSetDevices(devices: StoredCyncDevice[]): void {
  _storedDevices = [...devices];
  const bySwitch: Record<number, string> = {};
  const byHome: Record<string, Record<number, StoredCyncDevice>> = {};
  for (const dev of devices) {
    if (dev.switchId > 0) {
      bySwitch[dev.switchId] = dev.homeId;
    }
    if (!byHome[dev.homeId]) {
      byHome[dev.homeId] = {};
    }
    byHome[dev.homeId][dev.meshId] = dev;
  }
  _switchIdToHomeId = bySwitch;
  _homeMeshToDevice = byHome;
}

export function cyncSetStateListener(listener: CyncStateListener | null): void {
  _onStateListener = listener;
}

export function cyncRequestDeviceStates(): void {
  if (_storedDevices.length === 0) return;
  const controllers = new Set<number>();
  for (const dev of _storedDevices) {
    if (dev.switchId > 0) controllers.add(dev.switchId);
  }
  for (const switchId of controllers) {
    sendRaw(_buildStateRequestPacket(switchId));
  }
}

export function cyncConnect(loginCode: number[], onLoginFailed?: () => void) {
  _loginCode = loginCode;
  _disconnecting = false;
  _loginFailureCount = 0;
  _onLoginFailedCb = onLoginFailed ?? null;
  _openSocket();
}

function _openSocket() {
  if (_disconnecting) return;
  const endpoint = getEndpoint();
  _connected = false;
  _loginAcked = false;  // reset per-connection; flush pending only after ack
  if (_socket) {
    try { _socket.destroy(); } catch { /* ignore */ }
    _socket = null;
  }

  const tlsOptions: Record<string, unknown> = {
    host: endpoint.host,
    port: endpoint.port,
    connectTimeout: 10_000,
    // react-native-tcp-socket on Android checks rejectUnauthorized for TLS trust bypass.
    // tlsCheckValidity is used by the non-connectTLS code path.
    rejectUnauthorized: false,
    tlsCheckValidity: false,
  };

  const socket = TcpSocket.connectTLS(
    tlsOptions as never,
    () => {
      // TLS connected — send login packet; control commands flushed only after server ack
      _connected = true;
      if (_loginCode) {
        socket.write(new Uint8Array(_loginCode));
      }
      startHeartbeat();
    },
  );

  socket.on('error', (e: Error) => {
    const message = e?.message ?? String(e);
    if (message.includes('Chain validation failed')) {
      _sawChainValidationFailure = true;
    }
    _connected = false;
    clearHeartbeat();
    if (!_disconnecting) {
      _retryTimer = setTimeout(() => _openSocket(), 5_000);
    }
  });

  socket.on('close', () => {
    _connected = false;
    clearHeartbeat();
    if (!_disconnecting) {
      if (_sawChainValidationFailure) {
        _sawChainValidationFailure = false;
        rotateEndpoint();
        _retryTimer = setTimeout(() => _openSocket(), 1_000);
        return;
      }
      if (_sawTlsProtocolAlert) {
        _sawTlsProtocolAlert = false;
        rotateEndpoint();
        _retryTimer = setTimeout(() => _openSocket(), 1_000);
        return;
      }
      if (!_loginAcked) {
        _loginFailureCount++;
        if (_loginFailureCount >= 3) {
          _disconnecting = true;
          if (_onLoginFailedCb) _onLoginFailedCb();
          return;
        }
      }
      _retryTimer = setTimeout(() => _openSocket(), 5_000);
    }
  });

  socket.on('data', (_data: Uint8Array | string) => {
    // Minimal response handling: detect login failure (no devices returned
    // after login usually means the authorize token has expired)
    _handleData(_data);
  });

  _socket = socket;
}

// Track whether the server acknowledged our login
let _loginAcked = false;
let _loginAckTimer: ReturnType<typeof setTimeout> | null = null;

function _handleData(_data: Uint8Array | string) {
  const isStr = typeof _data === 'string';
  const bytes: Uint8Array = isStr
    ? Uint8Array.from(Array.from(_data as string).map(c => c.charCodeAt(0)))
    : (_data as Uint8Array);
  if (!_loginAcked) {
    // TLS alert: fatal protocol_version (15 03 01 00 02 02 46).
    // This indicates transport negotiation failure, not an expired auth token.
    if (bytes.length >= 7
      && bytes[0] === 0x15
      && bytes[1] === 0x03
      && bytes[4] === 0x02
      && bytes[5] === 0x02
      && bytes[6] === 0x46) {
      _sawTlsProtocolAlert = true;
      try { _socket?.destroy(); } catch { /* ignore */ }
      return;
    }
    _loginAcked = true;
    _loginFailureCount = 0;
    // Step 1 — probe all stored devices so the server marks them as active/routable
    // IMPORTANT: use switchId (32-bit) not deviceId (41-bit) — pycync encodes this as 4 bytes
    for (const dev of _storedDevices) {
      if (dev.switchId > 0) {
        const probe = _buildProbePacket(dev.switchId);
        _socket?.write(probe);
      }
    }
    // Step 2 — wait for probe response from server before flushing commands.
    // Fallback: flush after 1.5 s in case server sends no probe ack.
    _probeFlushTimer = setTimeout(() => {
      _flushPending();
    }, 1500);
    setTimeout(() => {
      cyncRequestDeviceStates();
    }, 350);
    if (_loginAckTimer) { clearTimeout(_loginAckTimer); _loginAckTimer = null; }
  } else {
    // Post-login data from server — handle server-initiated packets (probe acks, etc.)
    _handleServerPacket(_data);
  }
}

/** Flush all queued command packets (called after receiving probe ack or timeout). */
function _flushPending() {
  if (_probeFlushTimer) { clearTimeout(_probeFlushTimer); _probeFlushTimer = null; }
  if (!_socket || !_connected) return;
  const pending = _pendingWrites.splice(0);
  for (const p of pending) {
    _socket?.write(p);
  }
}

function _handleServerPacket(data: Uint8Array | string) {
  const bytes: Uint8Array = typeof data === 'string'
    ? Uint8Array.from(Array.from(data as string).map(c => c.charCodeAt(0)))
    : (data as Uint8Array);
  if (bytes.length < 5) return;
  const packetType = bytes[0];
  const payloadLen = ((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4]) >>> 0;
  if (bytes.length < 5 + payloadLen) return;
  const payload = bytes.slice(5, 5 + payloadLen);

  if (packetType === 0x73 && payload.length >= 6) {
    // ACK server-originated 0x73 packets so routing remains active.
    const sw = ((payload[0] << 24) | (payload[1] << 16) | (payload[2] << 8) | payload[3]) >>> 0;
    const rid = ((payload[4] << 8) | payload[5]) & 0xffff;
    const ack = new Uint8Array([
      0x73, 0x00, 0x00, 0x00, 0x07,
      (sw >>> 24) & 0xff, (sw >>> 16) & 0xff, (sw >>> 8) & 0xff, sw & 0xff,
      (rid >>> 8) & 0xff, rid & 0xff,
      0x00,
    ]);
    _socket?.write(ack);
  }

  // Probe response from server (type 0xa*): device is online, safe to send commands now
  if ((packetType & 0xf0) === 0xa0) {
    _flushPending();
    return;
  }
  if (packetType === 0x73 || packetType === 0x83 || packetType === 0x43) {
    _parseStatePacket(packetType, payload);
  }
}

function _parseStatePacket(packetType: number, payload: Uint8Array): void {
  if (payload.length < 4) return;
  const switchId = ((payload[0] << 24) | (payload[1] << 16) | (payload[2] << 8) | payload[3]) >>> 0;
  const homeId = _switchIdToHomeId[switchId];
  if (!homeId) return;

  if ((packetType === 0x73 || packetType === 0x83) && payload.length >= 33 && payload[13] === 219) {
    const mesh = payload[21];
    const isOn = payload[27] > 0;
    const brightness = isOn ? payload[28] : 0;
    _applyStateUpdate(homeId, mesh, isOn, brightness);
    return;
  }

  if (packetType === 0x73 && payload.length > 51 && payload[13] === 82) {
    let body = payload.slice(22);
    while (body.length > 24) {
      const mesh = body[0];
      const isOn = body[8] > 0;
      const brightness = isOn ? body[12] : 0;
      const colorTemp = body[16];
      const rgb = { r: body[20], g: body[21], b: body[22] };
      _applyStateUpdate(homeId, mesh, isOn, brightness, colorTemp, rgb);
      body = body.slice(24);
    }
    return;
  }

  if (packetType === 0x43 && payload.length >= 26 && payload[4] === 1 && payload[5] === 1 && payload[6] === 6) {
    let body = payload.slice(7);
    while (body.length >= 19) {
      const mesh = body[3];
      const isOn = body[4] > 0;
      const brightness = isOn ? body[5] : 0;
      const colorTemp = body[6];
      const rgb = { r: body[7], g: body[8], b: body[9] };
      _applyStateUpdate(homeId, mesh, isOn, brightness, colorTemp, rgb);
      body = body.slice(19);
    }
  }
}

function _applyStateUpdate(
  homeId: string,
  meshId: number,
  isOn: boolean,
  brightness: number,
  colorTemp?: number,
  rgb?: { r: number; g: number; b: number },
): void {
  const dev = _homeMeshToDevice[homeId]?.[meshId];
  if (!dev || !_onStateListener) return;

  const safeBrightness = Math.max(0, Math.min(100, Math.round(brightness)));
  const safeColorTemp = colorTemp === undefined
    ? undefined
    : Math.max(0, Math.min(255, Math.round(colorTemp)));
  const rgbSafe = rgb
    ? {
      r: Math.max(0, Math.min(255, Math.round(rgb.r))),
      g: Math.max(0, Math.min(255, Math.round(rgb.g))),
      b: Math.max(0, Math.min(255, Math.round(rgb.b))),
    }
    : undefined;

  const inColourMode = !!(dev.supportsRgb && safeColorTemp === 254 && rgbSafe);
  const hs = inColourMode && rgbSafe ? _rgbToHueSat(rgbSafe.r, rgbSafe.g, rgbSafe.b) : { hue: 0, sat: 0 };

  _onStateListener(dev.id, {
    isOn,
    brightness: dev.supportsBrightness ? safeBrightness : (isOn ? 100 : -1),
    colorTemp: dev.supportsColorTemp
      ? (safeColorTemp ?? (inColourMode ? 254 : 255))
      : -1,
    mode: inColourMode ? 'colour' : 'white',
    hue: hs.hue,
    sat: hs.sat,
  });
}

function _rgbToHueSat(r: number, g: number, b: number): { hue: number; sat: number } {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === rf) {
      hue = 60 * (((gf - bf) / delta) % 6);
    } else if (max === gf) {
      hue = 60 * (((bf - rf) / delta) + 2);
    } else {
      hue = 60 * (((rf - gf) / delta) + 4);
    }
  }
  if (hue < 0) hue += 360;
  const sat = max === 0 ? 0 : delta / max;
  return { hue: Math.round(hue), sat: Math.round(sat * 1000) };
}

/** Disconnect and stop reconnecting. */
export function cyncDisconnect() {
  _disconnecting = true;
  _connected = false;
  _pendingWrites = [];
  _onLoginFailedCb = null;
  _loginFailureCount = 0;
  _loginCode = null;
  _loginAcked = false;
  clearHeartbeat();
  clearRetryTimer();
  if (_loginAckTimer) { clearTimeout(_loginAckTimer); _loginAckTimer = null; }
  if (_probeFlushTimer) { clearTimeout(_probeFlushTimer); _probeFlushTimer = null; }
  try { _socket?.destroy(); } catch { /* ignore */ }
  _socket = null;
}

// ── Binary command builders ───────────────────────────────────────────────────
// Follows pycync's inner_packet_builder.py format exactly.

/**
 * Build a pycync-style PROBE packet (type 0xa3).
 * Exact pycync format: a3 00 00 00 07 [switchId 4BE] [seq 2BE] 00
 * (7-byte payload, NO trailing 0x02 — server closes connection if format is wrong)
 */
function _buildProbePacket(switchId: number): Uint8Array {
  const seq = nextSeq();
  return new Uint8Array([
    0xa3, 0x00, 0x00, 0x00, 0x07,  // type + payload length = 7
    (switchId >>> 24) & 0xff, (switchId >>> 16) & 0xff, (switchId >>> 8) & 0xff, switchId & 0xff,
    (seq >>> 8) & 0xff, seq & 0xff,
    0x00,
  ]);
}

function _buildStateRequestPacket(switchId: number): Uint8Array {
  const seq = nextSeq();
  return new Uint8Array([
    0x73, 0x00, 0x00, 0x00, 0x18,
    (switchId >>> 24) & 0xff, (switchId >>> 16) & 0xff, (switchId >>> 8) & 0xff, switchId & 0xff,
    (seq >>> 8) & 0xff, seq & 0xff,
    0x00,
    0x7e, 0x00, 0x00, 0x00, 0x00, 0xf8,
    0x52, 0x06, 0x00,
    0x00, 0x00, 0xff, 0xff, 0x00, 0x00,
    0x56, 0x7e,
  ]);
}

/**
 * Build PIPE/POWER turn-on packet.
 * Exact pycync format (from cync_hub.py turn_on):
 *   73 00 00 00 1f [sw 4BE] [seq 2BE] 00
 *   7e 00 00 00 00 f8 d0 0d 00
 *   00 00 00 00 00 [mesh 2LE] d0 00 00 01 00 00 [cs] 7e
 */
export function cyncTurnOn(switchId: number, meshId: number) {
  const seq = nextSeq();
  const ml = meshId & 0xff, mh = (meshId >>> 8) & 0xff;
  const cs = (430 + ml + mh) % 256;
  sendRaw(new Uint8Array([
    0x73, 0x00, 0x00, 0x00, 0x1f,
    (switchId >>> 24) & 0xff, (switchId >>> 16) & 0xff, (switchId >>> 8) & 0xff, switchId & 0xff,
    (seq >>> 8) & 0xff, seq & 0xff, 0x00,
    0x7e, 0x00, 0x00, 0x00, 0x00, 0xf8,
    0xd0, 0x0d, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    ml, mh,
    0xd0, 0x00, 0x00, 0x01, 0x00, 0x00,
    cs, 0x7e,
  ]));
}

/**
 * Build PIPE/POWER turn-off packet.
 * Exact pycync format (from cync_hub.py turn_off):
 *   73 00 00 00 1f [sw 4BE] [seq 2BE] 00
 *   7e 00 00 00 00 f8 d0 0d 00
 *   00 00 00 00 00 [mesh 2LE] d0 00 00 00 00 00 [cs] 7e
 */
export function cyncTurnOff(switchId: number, meshId: number) {
  const seq = nextSeq();
  const ml = meshId & 0xff, mh = (meshId >>> 8) & 0xff;
  const cs = (429 + ml + mh) % 256;
  sendRaw(new Uint8Array([
    0x73, 0x00, 0x00, 0x00, 0x1f,
    (switchId >>> 24) & 0xff, (switchId >>> 16) & 0xff, (switchId >>> 8) & 0xff, switchId & 0xff,
    (seq >>> 8) & 0xff, seq & 0xff, 0x00,
    0x7e, 0x00, 0x00, 0x00, 0x00, 0xf8,
    0xd0, 0x0d, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    ml, mh,
    0xd0, 0x00, 0x00, 0x00, 0x00, 0x00,
    cs, 0x7e,
  ]));
}

/**
 * Combo control: set on/off + brightness (0–100) + colorTone (0–100 or 255 for white).
 * Exact pycync format (from cync_hub.py combo_control):
 *   73 00 00 00 22 [sw 4BE] [seq 2BE] 00
 *   7e 00 00 00 00 f8 f0 10 00
 *   00 00 00 00 00 [mesh 2LE] f0 00 00 [state] [brightness] [colorTone] ff ff ff [cs] 7e
 * Checksum = (496 + mesh[0] + mesh[1] + state + brightness + colorTone + r + g + b) % 256
 */
export function cyncComboControl(
  state: boolean,
  brightness: number,
  colorTone: number,
  switchId: number,
  meshId: number,
  rgb?: { r: number; g: number; b: number },
) {
  const seq = nextSeq();
  const ml = meshId & 0xff, mh = (meshId >>> 8) & 0xff;
  const s = state ? 1 : 0;
  const b = Math.max(0, Math.min(100, Math.round(brightness)));
  const ct = (colorTone === 255 || colorTone === 254)
    ? colorTone
    : Math.max(0, Math.min(100, Math.round(colorTone)));
  const r = Math.max(0, Math.min(255, Math.round(rgb?.r ?? 0xff)));
  const g = Math.max(0, Math.min(255, Math.round(rgb?.g ?? 0xff)));
  const bv = Math.max(0, Math.min(255, Math.round(rgb?.b ?? 0xff)));
  const cs = (496 + ml + mh + s + b + ct + r + g + bv) % 256;
  sendRaw(new Uint8Array([
    0x73, 0x00, 0x00, 0x00, 0x22,
    (switchId >>> 24) & 0xff, (switchId >>> 16) & 0xff, (switchId >>> 8) & 0xff, switchId & 0xff,
    (seq >>> 8) & 0xff, seq & 0xff, 0x00,
    0x7e, 0x00, 0x00, 0x00, 0x00, 0xf8,
    0xf0, 0x10, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    ml, mh,
    0xf0, 0x00, 0x00, s, b, ct, r, g, bv,
    cs, 0x7e,
  ]));
}
