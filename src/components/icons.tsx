/**
 * Lightweight View-based icons — no SVG package required.
 * Background behind PowerIcon must be #000000 (AMOLED black).
 */
import React from 'react';
import { Text, View } from 'react-native';

interface IconProps {
  color: string;
  size?: number;
}

/**
 * Standard power/off button symbol:
 * a circle with a gap at the top and a vertical line through the gap.
 * Uses a black mask rect to create the gap — requires black background.
 */
export function PowerIcon({ color, size = 22 }: IconProps) {
  const sw = Math.max(2, Math.round(size * 0.1));
  const d = size - sw;
  const gap = Math.round(size * 0.32);

  return (
    <View style={{ width: size, height: size }}>
      {/* Full circle border */}
      <View
        style={{
          position: 'absolute',
          width: d,
          height: d,
          borderRadius: d / 2,
          borderWidth: sw,
          borderColor: color,
          top: sw / 2,
          left: sw / 2,
        }}
      />
      {/* Black mask to carve gap at top-center of circle */}
      <View
        style={{
          position: 'absolute',
          width: gap,
          height: sw + 3,
          backgroundColor: '#000000',
          top: 0,
          left: size / 2 - gap / 2,
        }}
      />
      {/* Vertical stroke through gap */}
      <View
        style={{
          position: 'absolute',
          width: sw,
          height: Math.round(size * 0.46),
          backgroundColor: color,
          borderRadius: sw / 2,
          top: 0,
          left: size / 2 - sw / 2,
        }}
      />
    </View>
  );
}

/**
 * Settings / gear icon.
 * Appends U+FE0E (text variation selector) to suppress emoji rendering
 * so the glyph respects the `color` style.
 */
export function SettingsIcon({ color, size = 22 }: IconProps) {
  return (
    <Text style={{ color, fontSize: size - 2, lineHeight: size }}>
      {'\u2699\uFE0E'}
    </Text>
  );
}
