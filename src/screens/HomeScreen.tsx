import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceCard } from '../components/DeviceCard';
import { LightGroupCard } from '../components/LightGroupCard';
import { PowerIcon, SettingsIcon } from '../components/icons';
import {
  controlBrightness,
  controlFanLight,
  controlFanSpeed,
  controlOnOff,
  fetchDevices,
} from '../api/deviceService';
import {
  fetchAllGroupStates,
  setGroupOnOff,
  setGroupWhite,
  setGroupColour,
  setGroupBrightness,
} from '../api/lightGroupService';
import type { Device } from '../types/device';
import type { LightGroup, LightGroupState } from '../types/lightGroup';
import { DEFAULT_LIGHT_STATE } from '../types/lightGroup';
import { loadCredentials } from '../storage/credentials';
import { exportConfig } from '../utils/configExport';

interface Props {
  onDisconnect: () => void;
}

export function HomeScreen({ onDisconnect }: Props) {
  const insets = useSafeAreaInsets();
  const [devices, setDevices] = useState<Device[]>([]);
  const [lightGroups, setLightGroups] = useState<LightGroup[]>([]);
  const [groupStates, setGroupStates] = useState<Map<string, LightGroupState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [allOffHeld, setAllOffHeld] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const creds = await loadCredentials();
      if (!creds) {
        setErrorModal('No saved configuration found.');
        return;
      }
      const payload = exportConfig(creds);
      await Share.share({
        message: payload,
        title: 'HomeControl Config',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorModal(msg ?? 'Export failed.');
    } finally {
      setExporting(false);
    }
  }, []);

  const fetchDevicesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, { groups, states }] = await Promise.all([
        fetchDevices(),
        fetchAllGroupStates(),
      ]);
      setDevices(result);
      setLightGroups(groups);
      setGroupStates(new Map(states.map(s => [s.groupId, s])));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg ?? 'Failed to load devices');
      setErrorModal(msg ?? 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevicesData();
  }, [fetchDevicesData]);

  // Optimistic updates: reflect state change immediately in UI
  const handleToggle = useCallback(async (id: string, isOn: boolean) => {
    setDevices(prev => prev.map(d => (d.id === id ? { ...d, isOn } : d)));
    await controlOnOff(id, isOn);
  }, []);

  const handleBrightness = useCallback(async (id: string, brightness: number) => {
    setDevices(prev => prev.map(d => (d.id === id ? { ...d, brightness } : d)));
    await controlBrightness(id, brightness);
  }, []);

  const handleFanSpeed = useCallback(async (id: string, fanSpeed: number) => {
    setDevices(prev => prev.map(d => (d.id === id ? { ...d, isOn: true, fanSpeed } : d)));
    await controlFanSpeed(id, fanSpeed);
  }, []);

  const handleFanLight = useCallback(async (id: string, level: string) => {
    setDevices(prev => prev.map(d => (d.id === id ? { ...d, fanLight: level } : d)));
    await controlFanLight(id, level as 'Off' | 'Level1' | 'Level2' | 'Level3');
  }, []);

  // ── Light group handlers ──────────────────────────────────────────────────

  const handleGroupToggle = useCallback(async (group: LightGroup, isOn: boolean) => {
    setGroupStates(prev => {
      const next = new Map(prev);
      const cur = next.get(group.id);
      if (cur) next.set(group.id, { ...cur, isOn });
      return next;
    });
    await setGroupOnOff(group, isOn);
  }, []);

  const handleGroupWhite = useCallback(async (
    group: LightGroup,
    temp: number,
    brightness: number,
  ) => {
    setGroupStates(prev => {
      const next = new Map(prev);
      const cur = next.get(group.id);
      if (cur) next.set(group.id, { ...cur, isOn: true, mode: 'white', colorTemp: temp, brightness });
      return next;
    });
    await setGroupWhite(group, temp, brightness);
  }, []);

  const handleGroupColour = useCallback(async (
    group: LightGroup,
    h: number,
    s: number,
    brightness: number,
  ) => {
    setGroupStates(prev => {
      const next = new Map(prev);
      const cur = next.get(group.id);
      if (cur) next.set(group.id, { ...cur, isOn: true, mode: 'colour', hue: h, sat: s, brightness });
      return next;
    });
    await setGroupColour(group, h, s, brightness);
  }, []);

  const handleGroupBrightness = useCallback(async (group: LightGroup, brightness: number) => {
    setGroupStates(prev => {
      const next = new Map(prev);
      const cur = next.get(group.id);
      if (cur) next.set(group.id, { ...cur, brightness });
      return next;
    });
    await setGroupBrightness(group, brightness);
  }, []);

  const handleAllOff = useCallback(async () => {
    // Optimistic update
    setDevices(prev => prev.map(d => ({ ...d, isOn: false })));
    setGroupStates(prev => {
      const next = new Map(prev);
      lightGroups.forEach(g => {
        const cur = next.get(g.id);
        if (cur) next.set(g.id, { ...cur, isOn: false });
      });
      return next;
    });
    // Send commands in parallel
    await Promise.allSettled([
      ...devices.map(d => controlOnOff(d.id, false)),
      ...lightGroups.map(g => setGroupOnOff(g, false)),
    ]);
  }, [devices, lightGroups]);

  // Group devices by room for a structured layout
  const rooms = useMemo(() => {
    const map = new Map<string, Device[]>();
    devices.forEach(d => {
      const label = d.room || d.structure || 'Fans';
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(d);
    });
    return Array.from(map.entries()).map(([name, devs]) => ({ name, devs }));
  }, [devices]);

  type ListItem =
    | { kind: 'room'; name: string; devs: Device[] }
    | { kind: 'lightGroup'; group: LightGroup; state: LightGroupState };

  const listItems = useMemo((): ListItem[] => {
    const roomItems: ListItem[] = rooms.map(r => ({ kind: 'room', name: r.name, devs: r.devs }));
    const groupItems: ListItem[] = lightGroups.map(g => ({
      kind: 'lightGroup' as const,
      group: g,
      state: groupStates.get(g.id) ?? { groupId: g.id, ...DEFAULT_LIGHT_STATE },
    }));
    return [...roomItems, ...groupItems];
  }, [rooms, lightGroups, groupStates]);

  const hasContent = devices.length > 0 || lightGroups.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>My Home</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchDevicesData}
          disabled={loading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.refreshIcon, loading && styles.refreshIconSpin]}>
            {loading ? '…' : '↻'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={exporting}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.exportIcon, exporting && styles.exportIconBusy]}>{'⇧'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.allOffBtn, allOffHeld && styles.allOffBtnHeld]}
          onLongPress={handleAllOff}
          delayLongPress={700}
          onPressIn={() => setAllOffHeld(true)}
          onPressOut={() => setAllOffHeld(false)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <PowerIcon color={allOffHeld ? '#fca5a5' : '#4b5563'} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.disconnectBtn}
          onPress={onDisconnect}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <SettingsIcon color="#4b5563" size={22} />
        </TouchableOpacity>
      </View>

      {/* ── Error modal ── */}
      <Modal
        visible={errorModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Connection Error</Text>
            <Text style={styles.modalBody}>{errorModal}</Text>
            <View style={styles.modalDivider} />
            <Text style={styles.modalHint}>
              If the error persists, your Tuya IoT Core trial period may have
              expired. Renew your subscription at{' '}
              <Text style={styles.modalLink}>platform.tuya.com</Text>
              {' '}→ your project → Subscription.
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setErrorModal(null)}
            >
              <Text style={styles.modalCloseTxt}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Body ── */}
      {loading && !hasContent ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6366f1" size="large" />
          <Text style={styles.hint}>Loading devices…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDevicesData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !hasContent ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.hint}>No devices found.</Text>
          <Text style={styles.hintSmall}>
            Make sure your devices are added to{'\n'}the Google Home app.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={item =>
            item.kind === 'room' ? `room-${item.name}` : `group-${item.group.id}`
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchDevicesData}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
          renderItem={({ item }) => {
            if (item.kind === 'room') {
              return (
                <View>
                  <Text style={styles.roomLabel}>{item.name}</Text>
                  {item.devs.map(device => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      onToggle={handleToggle}
                      onBrightnessChange={handleBrightness}
                      onFanSpeedChange={handleFanSpeed}
                      onFanLightChange={handleFanLight}
                    />
                  ))}
                </View>
              );
            }
            return (
              <LightGroupCard
                group={item.group}
                state={item.state}
                onToggle={handleGroupToggle}
                onWhite={handleGroupWhite}
                onColour={handleGroupColour}
                onBrightness={handleGroupBrightness}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1d35',
  },
  title: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    color: '#6366f1',
    fontSize: 22,
    fontWeight: '600',
  },
  refreshIconSpin: {
    color: '#4b5563',
  },
  disconnectBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  allOffBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginLeft: 4,
    marginTop: 2,
  },
  allOffBtnHeld: {
    backgroundColor: '#7f1d1d',
  },
  exportBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  exportIcon: {
    color: '#4b5563',
    fontSize: 20,
    fontWeight: '600',
  },
  exportIconBusy: {
    color: '#2a2a4a',
  },
  // Error modal
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000cc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#1d1d35',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#312e81',
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    color: '#f1f5f9',
    fontSize: 13,
    lineHeight: 20,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#2a2a4a',
  },
  modalHint: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 19,
  },
  modalLink: {
    color: '#818cf8',
  },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#312e81',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  modalCloseTxt: {
    color: '#c7d2fe',
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48 },
  hint: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
  },
  hintSmall: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  retryText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  roomLabel: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    paddingLeft: 4,
  },
});
