export interface WhitePreset {
  label: string;
  temp: number;
  dotColor?: string;
}

export interface GroupWhitePreset extends WhitePreset {
  bg: string;
  textColor: string;
}

export const CYNC_WHITE_PRESETS: WhitePreset[] = [
  { label: 'Cool', temp: 100, dotColor: '#d6e8ff' },
  { label: 'Day', temp: 70, dotColor: '#f0f4ff' },
  { label: 'Soft', temp: 45, dotColor: '#fff8ee' },
  { label: 'Warm', temp: 18, dotColor: '#ffe8b0' },
  { label: 'Amber', temp: 0, dotColor: '#ffcf60' },
];

export const GROUP_WHITE_PRESETS: GroupWhitePreset[] = [
  { label: 'Cool', temp: 1000, bg: '#d6e8ff', textColor: '#1e3a5f', dotColor: '#d6e8ff' },
  { label: 'Day', temp: 700, bg: '#f0f4ff', textColor: '#2a3a5f', dotColor: '#f0f4ff' },
  { label: 'Soft', temp: 450, bg: '#fff8ee', textColor: '#5f4020', dotColor: '#fff8ee' },
  { label: 'Warm', temp: 180, bg: '#ffe8b0', textColor: '#5f3000', dotColor: '#ffe8b0' },
  { label: 'Amber', temp: 0, bg: '#ffcf60', textColor: '#4a2000', dotColor: '#ffcf60' },
];
