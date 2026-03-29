import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BrightnessSlider } from './BrightnessSlider';
import type { LightGroup, LightGroupState } from '../types/lightGroup';

// ── Color utilities ─────────────────────────────────────────────────────────

function hsvToHex(h: number, s01: number, v01 = 1): string {
  const c = v01 * s01;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v01 - c;
  let r = 0, g = 0, b = 0;
  if (hh < 1)      { r = c; g = x; b = 0; }
  else if (hh < 2) { r = x; g = c; b = 0; }
  else if (hh < 3) { r = 0; g = c; b = x; }
  else if (hh < 4) { r = 0; g = x; b = c; }
  else if (hh < 5) { r = x; g = 0; b = c; }
  else             { r = c; g = 0; b = x; }
  const toH = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

// ── White temperature presets (cool → warm) ─────────────────────────────────

const WHITE_PRESETS = [
  { label: 'Cool',  temp: 1000, bg: '#d6e8ff', textColor: '#1e3a5f' },
  { label: 'Day',   temp: 700,  bg: '#f0f4ff', textColor: '#2a3a5f' },
  { label: 'Soft',  temp: 450,  bg: '#fff8ee', textColor: '#5f4020' },
  { label: 'Warm',  temp: 180,  bg: '#ffe8b0', textColor: '#5f3000' },
  { label: 'Amber', temp: 0,    bg: '#ffcf60', textColor: '#4a2000' },
];

// ── Color wheel swatches (computed once at module load) ──────────────────────

const WHEEL_SIZE = 252;
const CX = WHEEL_SIZE / 2;
const CY = WHEEL_SIZE / 2;

interface Swatch {
  left: number;
  top: number;
  size: number;
  color: string;
  h: number;
  s: number; // 0–1000
}

const WHEEL_SWATCHES: Swatch[] = (() => {
  const result: Swatch[] = [];

  const addRing = (r: number, count: number, s01: number, size: number) => {
    for (let i = 0; i < count; i++) {
      const h = Math.round((i * 360) / count);
      const rad = ((h - 90) * Math.PI) / 180; // start at top
      result.push({
        left: CX + r * Math.cos(rad) - size / 2,
        top: CY + r * Math.sin(rad) - size / 2,
        size,
        color: hsvToHex(h, s01),
        h,
        s: Math.round(s01 * 1000),
      });
    }
  };

  addRing(105, 24, 1.0,  18); // outer:  24 hues, full saturation
  addRing(73,  12, 0.55, 20); // middle: 12 hues, medium saturation
  addRing(41,   6, 0.25, 20); // inner:   6 hues, pastel

  // Center: white
  const sz = 22;
  result.push({ left: CX - sz / 2, top: CY - sz / 2, size: sz, color: '#ffffff', h: 0, s: 0 });

  return result;
})();

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

  return (
    <View style={[styles.card, isOffline ? styles.cardOffline : (state.isOn ? styles.cardOn : styles.cardOff)]}>
      {busy && <ActivityIndicator style={styles.spinner} color="#818cf8" size="small" />}

      {/* ── Header row ── */}
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, state.isOn && styles.iconWrapOn]}>
          <Text style={styles.icon}>💡</Text>
        </View>
        <View style={styles.labels}>
          <Text style={styles.name}>{group.name}</Text>
          {isOffline
            ? <Text style={styles.offlineBadge}>Offline</Text>
            : <Text style={styles.sub}>{group.deviceIds.length} light{group.deviceIds.length !== 1 ? 's' : ''}</Text>
          }
        </View>
        <TouchableOpacity
          style={[styles.toggle, state.isOn && styles.toggleOn]}
          onPress={() => run(() => onToggle(group, !state.isOn))}
          disabled={busy || isOffline}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.toggleThumb, state.isOn && styles.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      {/* ── White temperature presets ── */}
      <View style={[styles.presetRow, isOffline && styles.disabledSection]}>
        {WHITE_PRESETS.map(p => {
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

      {/* ── Colour section ── */}
      <TouchableOpacity
        style={styles.colourHeader}
        onPress={() => !isOffline && setColourOpen(v => !v)}
        disabled={isOffline}
        activeOpacity={0.7}
      >
        {activeColourHex && (
          <View style={[styles.colourDot, { backgroundColor: activeColourHex }]} />
        )}
        <Text style={styles.colourHeaderText}>Colour</Text>
        <Text style={styles.colourChevron}>{colourOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {colourOpen && (
        <View style={styles.wheel}>
          {WHEEL_SWATCHES.map((sw, i) => {
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
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#13132a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1d1d3b',
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  cardOn: {
    borderColor: '#4338ca',
  },
  cardOff: {
    borderColor: '#5c1818',
  },
  cardOffline: {
    borderColor: '#374151',
    opacity: 0.6,
  },
  disabledSection: {
    opacity: 0.4,
  },
  spinner: {
    position: 'absolute',
    top: 14,
    right: 14,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1d1d35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: '#312e81',
  },
  icon: { fontSize: 22 },
  labels: { flex: 1 },
  name: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  sub: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 1,
  },
  offlineBadge: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Toggle (custom switch)
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4b5563',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },

  // White presets
  presetRow: {
    flexDirection: 'row',
    gap: 6,
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
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
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
