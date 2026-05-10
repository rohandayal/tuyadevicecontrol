import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BrightnessSlider } from './BrightnessSlider';
import { CardFrame } from './CardFrame';
import { GROUP_WHITE_PRESETS } from './lightPresets';
import { LIGHT_WHEEL_SWATCHES } from './lightWheelSwatches';
import { hsvToHex } from '../utils/color';
import type { LightGroup, LightGroupState } from '../types/lightGroup';


// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  group: LightGroup;
  state: LightGroupState;
  onToggle: (group: LightGroup, isOn: boolean) => Promise<void>;
  onWhite: (group: LightGroup, temp: number, brightness: number) => Promise<void>;
  onColour: (group: LightGroup, h: number, s: number, brightness: number) => Promise<void>;
  onBrightness: (group: LightGroup, brightness: number) => Promise<void>;
}

export function LightGroupCard({
  group,
  state,
  onToggle,
  onWhite,
  onColour,
  onBrightness,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [colourOpen, setColourOpen] = useState(false);
  const [localBrightness, setLocalBrightness] = useState(state.brightness);
  const isOffline = !state.online;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  };

  const activeColourHex =
    state.mode === 'colour' ? hsvToHex(state.hue, state.sat / 1000) : null;
  const activeWhitePresetDotColor =
    state.mode === 'white'
      ? (GROUP_WHITE_PRESETS.find(p => p.temp === state.colorTemp)?.dotColor ?? null)
      : null;
  const effectiveDotColor = activeColourHex ?? activeWhitePresetDotColor;

  return (
    <CardFrame
      name={group.name}
      icon="💡"
      isOn={state.isOn}
      busy={busy}
      roomLabel={isOffline ? undefined : `${group.deviceIds.length} light${group.deviceIds.length !== 1 ? 's' : ''}`}
      offline={isOffline}
      onTogglePress={() => run(() => onToggle(group, !state.isOn))}
      toggleDisabled={busy || isOffline}
      cardOnStyle={styles.cardOn}
      cardOffStyle={styles.cardOff}
    >

      {/* ── White temperature presets ── */}
      <View style={[styles.presetRow, isOffline && styles.disabledSection]}>
        {GROUP_WHITE_PRESETS.map(p => {
          const active = state.isOn && state.mode === 'white' && state.colorTemp === p.temp;
          return (
            <TouchableOpacity
              key={p.temp}
              style={[
                styles.presetBtn,
                { backgroundColor: p.bg },
                (!state.isOn || isOffline) && styles.presetDimmed,
                active && styles.presetActive,
              ]}
              disabled={busy || isOffline}
              activeOpacity={0.8}
              onPress={() => run(() => onWhite(group, p.temp, localBrightness))}
            >
              <Text style={[styles.presetLabel, { color: p.textColor }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Brightness slider ── */}
      <View style={[styles.controlRow, isOffline && styles.disabledSection]}>
        <BrightnessSlider
          value={localBrightness}
          min={1}
          max={100}
          step={1}
          busy={busy || isOffline}
          onComplete={async v => {
            setLocalBrightness(v);
            await run(() => onBrightness(group, v));
          }}
        />
      </View>

      {/* ── Colour section ── */}
      <TouchableOpacity
        style={styles.colourHeader}
        onPress={() => !isOffline && setColourOpen(v => !v)}
        disabled={isOffline}
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
          {LIGHT_WHEEL_SWATCHES.map((sw, i) => {
            const isSelected =
              state.mode === 'colour' && state.hue === sw.h && state.sat === sw.s;
            return (
              <TouchableOpacity
                key={i}
                disabled={busy || isOffline}
                activeOpacity={0.75}
                onPress={() => run(() => onColour(group, sw.h, sw.s, localBrightness))}
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
    </CardFrame>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardOn: {
    borderColor: '#4338ca',
    backgroundColor: '#13132a',
  },
  cardOff: {
    borderColor: '#5c1818',
    backgroundColor: '#13132a',
  },
  disabledSection: {
    opacity: 0.4,
  },

  // White presets
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
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetDimmed: {
    opacity: 0.2,
  },
  presetActive: {
    borderColor: '#6366f1',
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  controlRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },

  // Colour section
  colourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
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

  // Color wheel
  wheel: {
    width: 252,
    height: 252,
    alignSelf: 'center',
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
