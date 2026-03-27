export interface LightGroup {
  id: string;
  name: string;
  deviceIds: string[];
}

export interface LightGroupState {
  groupId: string;
  online: boolean;
  isOn: boolean;
  brightness: number; // 1–100
  mode: 'white' | 'colour';
  colorTemp: number;  // 0–1000 (0 = warmest, 1000 = coolest)
  hue: number;        // 0–360
  sat: number;        // 0–1000
}

export const DEFAULT_LIGHT_STATE: Omit<LightGroupState, 'groupId'> = {
  online: true,
  isOn: false,
  brightness: 100,
  mode: 'white',
  colorTemp: 500,
  hue: 0,
  sat: 0,
};
