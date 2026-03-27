export type DeviceType = 'LIGHT' | 'DIMMABLE_LIGHT' | 'FAN';

export interface Device {
  id: string;
  name: string;
  /** Room name within the structure (may be empty string if unavailable). */
  room: string;
  /** Google Home structure (home) name. */
  structure: string;
  type: DeviceType;
  online: boolean;
  isOn: boolean;
  /** 0–100 percent. -1 when the device has no brightness control. */
  brightness: number;
  /** Speed level 1–5. -1 when the device is not a fan. */
  fanSpeed: number;
  /** Built-in light level for fan+light devices: "Off"|"Level1"|"Level2"|"Level3". Empty string when not applicable. */
  fanLight: string;
}
