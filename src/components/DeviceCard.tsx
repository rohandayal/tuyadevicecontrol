import React, { useState } from 'react';
import { FanCard } from './FanCard';
import { LightCard } from './LightCard';
import type { Device } from '../types/device';
import type { CyncDevice } from '../types/cyncDevice';
import {
  handleCyncBrightness,
  handleCyncColorTemp,
  handleCyncColour,
  handleCyncToggle,
} from '../api/CyncControl';
import { CYNC_WHITE_PRESETS } from './lightPresets';
import { LIGHT_WHEEL_SWATCHES } from './lightWheelSwatches';
import { hsvToHex } from '../utils/color';
import {
  handleTuyaBrightness,
  handleTuyaFanLight,
  handleTuyaFanSpeed,
  handleTuyaToggle,
} from '../api/TuyaControl';

interface BaseProps {
  effectiveRoom?: string;
  onRoomPress?: () => void;
}

interface TuyaDeviceCardProps extends BaseProps {
  provider: 'tuya';
  device: Device;
  onToggle: (id: string, isOn: boolean) => Promise<void>;
  onBrightnessChange: (id: string, value: number) => Promise<void>;
  onFanSpeedChange: (id: string, value: number) => Promise<void>;
  onFanLightChange: (id: string, level: string) => Promise<void>;
}

interface CyncCardProps extends BaseProps {
  provider: 'cync';
  device: CyncDevice;
  onStateChange: (id: string, patch: Partial<CyncDevice>) => void;
}

type Props = TuyaDeviceCardProps | CyncCardProps;

export function DeviceCard(props: Props) {
  const { effectiveRoom, onRoomPress } = props;
  const [busy, setBusy] = useState(false);
  const [colourOpen, setColourOpen] = useState(false);

  const run = async (action: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  if (props.provider === 'tuya') {
    const {
      device,
      onToggle,
      onBrightnessChange,
      onFanSpeedChange,
      onFanLightChange,
    } = props;
    const isFan = device.type === 'FAN';
    const isOffline = !device.online;

    if (isFan) {
      return (
        <FanCard
          name={device.name}
          isOn={device.isOn}
          busy={busy}
          roomLabel={effectiveRoom ?? device.room}
          onRoomPress={onRoomPress}
          offline={isOffline}
          fanSpeed={device.fanSpeed}
          fanLight={device.fanLight}
          onSpeed={level =>
            run(() => handleTuyaFanSpeed(device, level, onToggle, onFanSpeedChange))
          }
          onFanLight={level =>
            run(() => handleTuyaFanLight(device, level, onFanLightChange))
          }
        />
      );
    }

    const supportsBrightness = device.type === 'DIMMABLE_LIGHT';
    return (
      <LightCard
        name={device.name}
        isOn={device.isOn}
        busy={busy}
        roomLabel={effectiveRoom ?? device.room}
        onRoomPress={onRoomPress}
        offline={isOffline}
        onToggle={() => run(() => handleTuyaToggle(device, onToggle))}
        supportsBrightness={supportsBrightness}
        brightness={device.brightness ?? 50}
        brightnessMin={10}
        brightnessMax={100}
        onBrightness={value => run(() => handleTuyaBrightness(device, value, onBrightnessChange))}
      />
    );
  }

  const { device, onStateChange } = props;
  const activeColourHex =
    device.mode === 'colour' ? hsvToHex(device.hue, device.sat / 1000) : null;

  return (
    <LightCard
      name={device.name}
      isOn={device.isOn}
      busy={busy}
      roomLabel={effectiveRoom}
      onRoomPress={onRoomPress}
      onToggle={() => run(() => handleCyncToggle(device, onStateChange))}
      supportsBrightness={device.supportsBrightness}
      brightness={device.brightness >= 0 ? device.brightness : 50}
      brightnessMin={1}
      brightnessMax={100}
      onBrightness={value => run(() => handleCyncBrightness(device, value, onStateChange))}
      supportsColorTemp={device.supportsColorTemp}
      supportsRgb={device.supportsRgb}
      whitePresets={CYNC_WHITE_PRESETS.map(p => ({ ...p }))}
      colorTemp={device.colorTemp}
      mode={device.mode}
      hue={device.hue}
      sat={device.sat}
      activeColourHex={activeColourHex}
      colourOpen={colourOpen}
      onToggleColourOpen={() => setColourOpen(v => !v)}
      onColorTemp={value => run(() => handleCyncColorTemp(device, value, onStateChange))}
      onColour={(h, s) => run(() => handleCyncColour(device, h, s, onStateChange))}
      wheelSwatches={LIGHT_WHEEL_SWATCHES}
    />
  );
}

