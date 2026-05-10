import type { Device } from '../types/device';

export async function handleTuyaToggle(
  device: Device,
  onToggle: (id: string, isOn: boolean) => Promise<void>,
): Promise<void> {
  await onToggle(device.id, !device.isOn);
}

export async function handleTuyaBrightness(
  device: Device,
  value: number,
  onBrightnessChange: (id: string, value: number) => Promise<void>,
): Promise<void> {
  await onBrightnessChange(device.id, value);
}

export async function handleTuyaFanSpeed(
  device: Device,
  level: number,
  onToggle: (id: string, isOn: boolean) => Promise<void>,
  onFanSpeedChange: (id: string, value: number) => Promise<void>,
): Promise<void> {
  if (level === 0) {
    await onToggle(device.id, false);
    return;
  }
  await onFanSpeedChange(device.id, level);
}

export async function handleTuyaFanLight(
  device: Device,
  level: string,
  onFanLightChange: (id: string, level: string) => Promise<void>,
): Promise<void> {
  await onFanLightChange(device.id, level);
}
