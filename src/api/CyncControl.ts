import { cyncComboControl, cyncTurnOff, cyncTurnOn } from './cyncClient';
import type { CyncDevice } from '../types/cyncDevice';
import { hsvToRgb } from '../utils/color';

export function handleCyncToggle(device: CyncDevice, onStateChange: (id: string, patch: Partial<CyncDevice>) => void): void {
  const nextOn = !device.isOn;
  onStateChange(device.id, { isOn: nextOn });
  if (nextOn) {
    cyncTurnOn(device.switchId, device.meshId);
  } else {
    cyncTurnOff(device.switchId, device.meshId);
  }
}

export function handleCyncBrightness(
  device: CyncDevice,
  value: number,
  onStateChange: (id: string, patch: Partial<CyncDevice>) => void,
): void {
  onStateChange(device.id, { brightness: value, isOn: true });
  const inColourMode = device.supportsRgb && device.mode === 'colour';
  if (inColourMode) {
    const rgb = hsvToRgb(device.hue, device.sat / 1000);
    cyncComboControl(true, value, 254, device.switchId, device.meshId, rgb);
    return;
  }
  const ct = device.colorTemp >= 0 ? device.colorTemp : 255;
  cyncComboControl(true, value, ct, device.switchId, device.meshId);
}

export function handleCyncColorTemp(
  device: CyncDevice,
  value: number,
  onStateChange: (id: string, patch: Partial<CyncDevice>) => void,
): void {
  onStateChange(device.id, { colorTemp: value, isOn: true, mode: 'white' });
  const brightness = device.brightness >= 0 ? device.brightness : 100;
  cyncComboControl(true, brightness, value, device.switchId, device.meshId);
}

export function handleCyncColour(
  device: CyncDevice,
  h: number,
  s: number,
  onStateChange: (id: string, patch: Partial<CyncDevice>) => void,
): void {
  const rgb = hsvToRgb(h, s / 1000);
  const brightness = device.brightness >= 0 ? device.brightness : 100;
  onStateChange(device.id, {
    isOn: true,
    mode: 'colour',
    hue: h,
    sat: s,
    colorTemp: 255,
  });
  cyncComboControl(true, brightness, 254, device.switchId, device.meshId, rgb);
}
