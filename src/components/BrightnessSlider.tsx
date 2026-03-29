import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

// Pure utility — no closure, safe to call from a once-created PanResponder
function clampToStep(v: number, lo: number, hi: number, st: number): number {
  const clamped = Math.max(lo, Math.min(hi, v));
  const stepped = Math.round((clamped - lo) / st) * st + lo;
  return Math.max(lo, Math.min(hi, stepped));
}

export interface BrightnessSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  busy?: boolean;
  onComplete: (value: number) => Promise<void>;
}

export function BrightnessSlider({
  value,
  min = 1,
  max = 100,
  step = 1,
  busy = false,
  onComplete,
}: BrightnessSliderProps) {
  // All current values in one ref so the once-created PanResponder never reads stale closures
  const live = useRef({
    min, max, step, busy, onComplete,
    trackWidth: 0,
    localValue: clampToStep(value, min, max, step),
    normalizedValue: clampToStep(value, min, max, step),
  });

  const normalizedValue = clampToStep(value, min, max, step);
  live.current.min = min;
  live.current.max = max;
  live.current.step = step;
  live.current.busy = busy;
  live.current.onComplete = onComplete;
  live.current.normalizedValue = normalizedValue;

  const [localValue, setLocalValue] = useState(normalizedValue);
  live.current.localValue = localValue;

  const dragStartValueRef = useRef(normalizedValue);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) {
      const nv = live.current.normalizedValue;
      live.current.localValue = nv;
      setLocalValue(nv);
    }
  }, [normalizedValue]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.busy,
      onMoveShouldSetPanResponder: (_, gs) => !live.current.busy && Math.abs(gs.dx) > 2,
      onPanResponderGrant: event => {
        const { min: lo, max: hi, step: st, trackWidth: tw } = live.current;
        draggingRef.current = true;
        const ratio = tw > 0 ? Math.max(0, Math.min(1, event.nativeEvent.locationX / tw)) : 0;
        const nextValue = clampToStep(lo + ratio * (hi - lo), lo, hi, st);
        dragStartValueRef.current = nextValue;
        live.current.localValue = nextValue;
        setLocalValue(nextValue);
      },
      onPanResponderMove: (_, gs) => {
        const { min: lo, max: hi, step: st, trackWidth: tw } = live.current;
        if (tw <= 0) { return; }
        const nextValue = clampToStep(
          dragStartValueRef.current + (gs.dx / tw) * (hi - lo), lo, hi, st,
        );
        live.current.localValue = nextValue;
        setLocalValue(nextValue);
      },
      onPanResponderRelease: async (_, gs) => {
        draggingRef.current = false;
        const { min: lo, max: hi, step: st, trackWidth: tw, localValue: lv, normalizedValue: nv, onComplete: cb } = live.current;
        const nextValue = tw > 0
          ? clampToStep(dragStartValueRef.current + (gs.dx / tw) * (hi - lo), lo, hi, st)
          : clampToStep(lv, lo, hi, st);
        live.current.localValue = nextValue;
        setLocalValue(nextValue);
        if (nextValue !== nv) { await cb(nextValue); }
      },
      onPanResponderTerminate: async () => {
        draggingRef.current = false;
        const { min: lo, max: hi, step: st, localValue: lv, normalizedValue: nv, onComplete: cb } = live.current;
        const nextValue = clampToStep(lv, lo, hi, st);
        live.current.localValue = nextValue;
        setLocalValue(nextValue);
        if (nextValue !== nv) { await cb(nextValue); }
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const handleAccessibilityAction = async (
    event: { nativeEvent: { actionName: string } },
  ) => {
    const { busy: b, min: lo, max: hi, step: st, localValue: lv, normalizedValue: nv, onComplete: cb } = live.current;
    if (b) { return; }
    const delta = event.nativeEvent.actionName === 'increment' ? st
      : event.nativeEvent.actionName === 'decrement' ? -st : 0;
    if (delta === 0) { return; }
    const nextValue = clampToStep(lv + delta, lo, hi, st);
    live.current.localValue = nextValue;
    setLocalValue(nextValue);
    if (nextValue !== nv) { await cb(nextValue); }
  };

  const progress = max === min ? 0 : (localValue - min) / (max - min);
  const fillPct = `${Math.max(0, Math.min(100, progress * 100))}%`;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Brightness"
      accessibilityHint="Swipe up or down with a screen reader, or drag horizontally to adjust brightness"
      accessibilityState={{ disabled: busy }}
      accessibilityValue={{ min, max, now: localValue, text: `${localValue}%` }}
      accessibilityActions={[
        { name: 'increment', label: 'Increase brightness' },
        { name: 'decrement', label: 'Decrease brightness' },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
      style={[styles.track, busy && styles.disabled]}
      onLayout={event => {
        live.current.trackWidth = event.nativeEvent.layout.width;
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.fill, { width: fillPct as any }]} />
      <View style={styles.overlay} pointerEvents="none">
        <Text style={styles.icon}>{'\u2600\uFE0E'}</Text>
        <Text style={styles.value}>{localValue}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0f0f1e',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.65,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#818cf8',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  icon: {
    fontSize: 20,
    lineHeight: 20,
    includeFontPadding: false,
    color: '#ffffff',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
});
