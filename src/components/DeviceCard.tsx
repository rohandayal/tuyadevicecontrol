import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Device } from '../types/device';

interface Props {
  device: Device;
  onToggle: (id: string, isOn: boolean) => Promise<void>;
  onBrightnessChange: (id: string, value: number) => Promise<void>;
  onFanSpeedChange: (id: string, value: number) => Promise<void>;
  onFanLightChange: (id: string, level: string) => Promise<void>;
}

export function DeviceCard({
  device,
  onToggle,
  onBrightnessChange,
  onFanSpeedChange,
  onFanLightChange,
}: Props) {
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const isFan = device.type === 'FAN';
  const isDimmable = device.type === 'DIMMABLE_LIGHT';
  const isOffline = !device.online;

  return (
    <View style={[styles.card, device.isOn ? styles.cardOn : styles.cardOff, isOffline && styles.cardOffline]}>
      {/* Spinner overlay while a command is in flight */}
      {busy && <ActivityIndicator style={styles.spinner} color="#818cf8" size="small" />}

      {/* ── Header row ── */}
      <View style={styles.row}>
        <View style={[styles.iconWrap, device.isOn && styles.iconWrapOn]}>
          <Text style={styles.icon}>{isFan ? '🌀' : '💡'}</Text>
        </View>

        <View style={styles.labels}>
          <Text style={styles.name} numberOfLines={1}>{device.name}</Text>
          {isOffline
            ? <Text style={styles.offlineBadge}>Offline</Text>
            : !!device.room && <Text style={styles.room} numberOfLines={1}>{device.room}</Text>
          }
        </View>

        {/* On / Off toggle — hidden for fans (speed buttons handle on/off) */}
        {!isFan && (
          <TouchableOpacity
            style={[styles.toggle, device.isOn && styles.toggleOn]}
            onPress={() => run(() => onToggle(device.id, !device.isOn))}
            disabled={busy || isOffline}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.thumb, device.isOn && styles.thumbOn]} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Fan speed buttons: 0 = off, 1–5 = speed level ── */}
      {isFan && (
        <View style={[styles.speedRow, isOffline && styles.disabledSection]}>
          {[0, 1, 2, 3, 4, 5].map(level => {
            const active = level === 0 ? !device.isOn : device.isOn && device.fanSpeed === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.speedBtn, active && styles.speedBtnActive]}
                onPress={() =>
                  run(() =>
                    level === 0
                      ? onToggle(device.id, false)
                      : onFanSpeedChange(device.id, level),
                  )
                }
                disabled={busy || isOffline}
                activeOpacity={0.75}
              >
                <Text style={[styles.speedBtnText, active && styles.speedBtnTextActive]}>
                  {level === 0 ? 'Off' : String(level)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Brightness control (dimmable lights only, when on) ── */}
      {isDimmable && device.isOn && (
        <View style={[styles.controlRow, isOffline && styles.disabledSection]}>
          <Text style={styles.controlLabel}>Brightness</Text>
          <StepControl
            value={device.brightness}
            unit="%"
            step={10}
            min={10}
            max={100}
            busy={busy || isOffline}
            onDecrease={() =>
              run(() => onBrightnessChange(device.id, Math.max(10, device.brightness - 10)))
            }
            onIncrease={() =>
              run(() => onBrightnessChange(device.id, Math.min(100, device.brightness + 10)))
            }
          />
        </View>
      )}

      {/* ── Fan light control ── */}
      {isFan && (
        <View style={[styles.speedRow, isOffline && styles.disabledSection]}>
          {(['Off', 'Level1', 'Level2', 'Level3'] as const).map((level, i) => {
            const active = device.fanLight === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.speedBtn, active && styles.speedBtnActive]}
                onPress={() => run(() => onFanLightChange(device.id, level))}
                disabled={busy || isOffline}
                activeOpacity={0.75}
              >
                <Text style={[styles.speedBtnText, active && styles.speedBtnTextActive]}>
                  {i === 0 ? 'Off' : `L${i}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Shared step-control component ──────────────────────────────────────────────

interface StepProps {
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  busy: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}

function StepControl({ value, unit, min, max, busy, onDecrease, onIncrease }: StepProps) {
  return (
    <View style={stepStyles.row}>
      <TouchableOpacity
        style={[stepStyles.btn, value <= min && stepStyles.btnDisabled]}
        onPress={onDecrease}
        disabled={busy || value <= min}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={stepStyles.btnText}>−</Text>
      </TouchableOpacity>

      <Text style={stepStyles.value}>{value}{unit}</Text>

      <TouchableOpacity
        style={[stepStyles.btn, value >= max && stepStyles.btnDisabled]}
        onPress={onIncrease}
        disabled={busy || value >= max}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={stepStyles.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1d1d35',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cardOn: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1e3c',
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
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2a2a4a',
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
    fontSize: 15,
    fontWeight: '600',
  },
  room: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  offlineBadge: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#374151',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: '#6366f1' },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#9ca3af',
  },
  thumbOn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  controlLabel: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 13,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  speedBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#2a2a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBtnActive: {
    backgroundColor: '#312e81',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  speedBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  speedBtnTextActive: {
    color: '#c7d2fe',
  },
});

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#2a2a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: {
    color: '#f1f5f9',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '300',
  },
  value: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'center',
  },
});
