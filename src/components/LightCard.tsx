import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BrightnessSlider } from './BrightnessSlider';
import { CardFrame } from './CardFrame';

interface WhitePreset {
  label: string;
  temp: number;
  dotColor?: string;
}

export interface LightWheelSwatch {
  left: number;
  top: number;
  size: number;
  color: string;
  h: number;
  s: number;
}

interface Props {
  name: string;
  icon?: string;
  isOn: boolean;
  busy: boolean;
  roomLabel?: string;
  onRoomPress?: () => void;
  offline?: boolean;
  onToggle: () => void;

  supportsBrightness: boolean;
  brightness: number;
  brightnessMin?: number;
  brightnessMax?: number;
  onBrightness: (value: number) => Promise<void>;

  supportsColorTemp?: boolean;
  supportsRgb?: boolean;
  whitePresets?: WhitePreset[];
  colorTemp?: number;
  mode?: 'white' | 'colour';
  hue?: number;
  sat?: number;
  activeColourHex?: string | null;
  colourOpen?: boolean;
  onToggleColourOpen?: () => void;
  onColorTemp?: (value: number) => void;
  onColour?: (h: number, s: number) => void;
  wheelSwatches?: LightWheelSwatch[];
}

export function LightCard({
  name,
  icon = '💡',
  isOn,
  busy,
  roomLabel,
  onRoomPress,
  offline = false,
  onToggle,
  supportsBrightness,
  brightness,
  brightnessMin = 1,
  brightnessMax = 100,
  onBrightness,
  supportsColorTemp = false,
  supportsRgb = false,
  whitePresets = [],
  colorTemp = -1,
  mode = 'white',
  hue = 0,
  sat = 0,
  activeColourHex = null,
  colourOpen = false,
  onToggleColourOpen,
  onColorTemp,
  onColour,
  wheelSwatches = [],
}: Props) {
  const activeWhitePresetDotColor =
    mode === 'white' ? (whitePresets.find(p => p.temp === colorTemp)?.dotColor ?? null) : null;
  const effectiveDotColor = activeColourHex ?? activeWhitePresetDotColor;

  return (
    <CardFrame
      name={name}
      icon={icon}
      isOn={isOn}
      busy={busy}
      roomLabel={roomLabel}
      onRoomPress={onRoomPress}
      offline={offline}
      onTogglePress={onToggle}
      toggleDisabled={busy || offline}
    >
      {supportsBrightness && isOn && (
        <View style={[styles.controlRow, offline && styles.disabledSection]}>
          <BrightnessSlider
            value={brightness >= 0 ? brightness : 50}
            min={brightnessMin}
            max={brightnessMax}
            busy={busy || offline}
            onComplete={onBrightness}
          />
        </View>
      )}

      {supportsColorTemp && isOn && (
        <>
          <View style={[styles.presetRow, offline && styles.disabledSection]}>
            {whitePresets.map(preset => {
              const active = mode === 'white' && colorTemp === preset.temp;
              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.presetBtn, active && styles.presetBtnActive]}
                  onPress={() => onColorTemp?.(preset.temp)}
                  disabled={busy || offline || !onColorTemp}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.presetBtnText, active && styles.presetBtnTextActive]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {supportsRgb && (
            <>
              <TouchableOpacity
                style={styles.colourHeader}
                onPress={onToggleColourOpen}
                disabled={busy || offline || !onToggleColourOpen}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.colourDot,
                    !effectiveDotColor && styles.colourDotInactive,
                    effectiveDotColor ? { backgroundColor: effectiveDotColor } : null,
                  ]}
                />
                <Text style={styles.colourHeaderText}>Colour</Text>
                <Text style={styles.colourChevron}>{colourOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {colourOpen && (
                <View style={styles.wheel}>
                  {wheelSwatches.map((sw, i) => {
                    const isSelected = mode === 'colour' && hue === sw.h && sat === sw.s;
                    return (
                      <TouchableOpacity
                        key={i}
                        disabled={busy || offline || !onColour}
                        activeOpacity={0.75}
                        onPress={() => onColour?.(sw.h, sw.s)}
                        style={[
                          styles.swatch,
                          {
                            left: sw.left,
                            top: sw.top,
                            width: sw.size,
                            height: sw.size,
                            borderRadius: sw.size / 2,
                            backgroundColor: sw.color,
                          },
                          isSelected && styles.swatchSelected,
                        ]}
                      />
                    );
                  })}
                </View>
              )}
            </>
          )}
        </>
      )}
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  disabledSection: {
    opacity: 0.4,
  },
  controlRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  presetBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#2a2a4a',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetBtnActive: {
    backgroundColor: '#312e81',
    borderColor: '#6366f1',
  },
  presetBtnText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  presetBtnTextActive: {
    color: '#c7d2fe',
  },
  colourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    marginTop: 10,
  },
  colourDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#ffffff30',
  },
  colourDotInactive: {
    backgroundColor: 'transparent',
  },
  colourHeaderText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  colourChevron: {
    color: '#4b5563',
    fontSize: 11,
  },
  wheel: {
    width: 252,
    height: 252,
    alignSelf: 'center',
    marginTop: 4,
  },
  swatch: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#000000',
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#f1f5f9',
  },
});
