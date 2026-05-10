import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface Props {
  name: string;
  icon: string;
  isOn: boolean;
  busy: boolean;
  roomLabel?: string;
  onRoomPress?: () => void;
  offline?: boolean;
  showToggle?: boolean;
  onTogglePress?: () => void;
  toggleDisabled?: boolean;
  children?: React.ReactNode;
  cardOffStyle?: StyleProp<ViewStyle>;
  cardOnStyle?: StyleProp<ViewStyle>;
}

export function CardFrame({
  name,
  icon,
  isOn,
  busy,
  roomLabel,
  onRoomPress,
  offline = false,
  showToggle = true,
  onTogglePress,
  toggleDisabled = false,
  children,
  cardOffStyle,
  cardOnStyle,
}: Props) {
  return (
    <View
      style={[
        styles.card,
        isOn ? styles.cardOn : styles.cardOff,
        isOn ? cardOnStyle : cardOffStyle,
        offline && styles.cardOffline,
      ]}
    >
      <View style={styles.spinnerSlot}>
        {busy ? <ActivityIndicator color="#818cf8" size="small" /> : null}
      </View>

      <View style={styles.row}>
        <View style={[styles.iconWrap, isOn && styles.iconWrapOn]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <View style={styles.labels}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {offline ? (
            <Text style={styles.offlineBadge}>Offline</Text>
          ) : !!roomLabel && (
            <TouchableOpacity onPress={onRoomPress} disabled={!onRoomPress} hitSlop={8}>
              <Text style={[styles.room, !!onRoomPress && styles.roomTappable]} numberOfLines={1}>
                {roomLabel}
                {!!onRoomPress && <Text style={styles.roomEdit}> {' '}✎</Text>}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showToggle && (
          <TouchableOpacity
            style={[styles.toggle, isOn && styles.toggleOn]}
            onPress={onTogglePress}
            disabled={toggleDisabled}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.thumb, isOn && styles.thumbOn]} />
          </TouchableOpacity>
        )}
      </View>

      {children}
    </View>
  );
}

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
  spinnerSlot: {
    width: 20,
    height: 20,
    position: 'absolute',
    top: 14,
    right: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
  roomTappable: {
    color: '#818cf8',
  },
  roomEdit: {
    color: '#4b5563',
    fontSize: 11,
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
});
