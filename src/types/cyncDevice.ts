export interface CyncDevice {
  /** Cync numeric device ID as string (from bulbsArray.deviceID). */
  id: string;
  name: string;
  /** Switch ID of the WiFi-controlling device (used to address TCP packets). */
  switchId: number;
  /** Mesh index within the home (0-based), used in binary packet payloads. */
  meshId: number;
  /** Home ID this device belongs to. */
  homeId: string;
  /** Human-readable Cync home name. */
  homeName: string;
  isOn: boolean;
  /** 0–100 percent. -1 when not dimmable. */
  brightness: number;
  /** 0–100 percent (0 = warm/orange, 100 = cool/blue). -1 when not supported. */
  colorTemp: number;
  /** Runtime UI mode for light controls. */
  mode: 'white' | 'colour';
  /** Runtime hue (0-360) when in colour mode. */
  hue: number;
  /** Runtime saturation (0-1000) when in colour mode. */
  sat: number;
  supportsBrightness: boolean;
  supportsColorTemp: boolean;
  supportsRgb: boolean;
}

/**
 * Stored Cync credentials — only the authorize token + pre-discovered device
 * list. The email and password are NEVER stored.
 */
export interface CyncCredentials {
  userId: number;
  /** TCP login token derived from the 'authorize' field in the auth response. */
  loginCode: number[];
  /** Flat list of all discovered devices, serialised from bulbsArray. */
  devices: StoredCyncDevice[];
}

/** Minimal representation of a Cync device saved to AsyncStorage. */
export interface StoredCyncDevice {
  id: string;
  name: string;
  switchId: number;
  meshId: number;
  homeId: string;
  homeName?: string;
  supportsBrightness: boolean;
  supportsColorTemp: boolean;
  supportsRgb?: boolean;
}
