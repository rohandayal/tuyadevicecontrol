import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CardFrame } from './CardFrame';

interface Props {
  name: string;
  isOn: boolean;
  busy: boolean;
  roomLabel?: string;
  onRoomPress?: () => void;
  offline?: boolean;
  fanSpeed: number;
  fanLight: string;
  onSpeed: (level: number) => void;
  onFanLight: (level: string) => void;
}

export function FanCard({
  name,
  isOn,
  busy,
  roomLabel,
  onRoomPress,
  offline = false,
  fanSpeed,
  fanLight,
  onSpeed,
  onFanLight,
}: Props) {
  return (
    <CardFrame
      name={name}
      icon="🌀"
      isOn={isOn}
      busy={busy}
      roomLabel={roomLabel}
      onRoomPress={onRoomPress}
      offline={offline}
      showToggle={false}
    >
      <View style={[styles.speedRow, offline && styles.disabledSection]}>
        {[0, 1, 2, 3, 4, 5].map(level => {
          const active = level === 0 ? !isOn : isOn && fanSpeed === level;
          return (
            <TouchableOpacity
              key={level}
              style={[styles.speedBtn, active && styles.speedBtnActive]}
              onPress={() => onSpeed(level)}
              disabled={busy || offline}
              activeOpacity={0.75}
            >
              <Text style={[styles.speedBtnText, active && styles.speedBtnTextActive]}>
                {level === 0 ? 'Off' : String(level)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.speedRow, offline && styles.disabledSection]}>
        {(['Off', 'Level1', 'Level2', 'Level3'] as const).map((level, i) => {
          const active = fanLight === level;
          return (
            <TouchableOpacity
              key={level}
              style={[styles.speedBtn, active && styles.speedBtnActive]}
              onPress={() => onFanLight(level)}
              disabled={busy || offline}
              activeOpacity={0.75}
            >
              <Text style={[styles.speedBtnText, active && styles.speedBtnTextActive]}>
                {i === 0 ? 'Off' : `L${i}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  disabledSection: {
    opacity: 0.4,
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
