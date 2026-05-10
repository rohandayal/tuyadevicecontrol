import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import {
  cyncConnect,
  cyncDisconnect,
  cyncRequestDeviceStates,
  cyncSetDevices,
  cyncSetStateListener,
  cyncTurnOff,
  storedToCyncDevices,
} from '../api/cyncClient';
import type { Device } from '../types/device';
import type { LightGroup, LightGroupState } from '../types/lightGroup';
import { DEFAULT_LIGHT_STATE } from '../types/lightGroup';
import type { CyncDevice } from '../types/cyncDevice';
import {
  loadCredentials,
  saveCredentials,
  loadDeviceRooms,
  saveDeviceRooms,
  loadDeviceOrder,
  saveDeviceOrder,
  loadCyncCredentials,
  loadCyncRuntimeState,
  saveCyncRuntimeState,
} from '../storage/credentials';
import { exportConfig } from '../utils/configExport';

interface Props {
  onOpenSettings: () => void;
}

const COMMON_ROOM_NAMES = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Dining Room',
  'Bathroom',
  'Hallway',
  'Study',
  'Office',
  'Kids Room',
  'Guest Room',
  'Balcony',
  'Garage',
  'Patio',
  'Utility Room',
  'Entrance',
] as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function mergeCyncRuntime(base: CyncDevice[], runtimeById: Record<string, {
  isOn: boolean;
  brightness: number;
  colorTemp: number;
  mode: 'white' | 'colour';
  hue: number;
  sat: number;
}>): CyncDevice[] {
  return base.map(d => {
    const saved = runtimeById[d.id];
    if (!saved) return d;
    return {
      ...d,
      isOn: !!saved.isOn,
      brightness: d.supportsBrightness ? clamp(Math.round(saved.brightness), 0, 100) : -1,
      colorTemp: d.supportsColorTemp ? clamp(Math.round(saved.colorTemp), 0, 255) : -1,
      mode: saved.mode === 'colour' ? 'colour' : 'white',
      hue: clamp(Math.round(saved.hue), 0, 360),
      sat: clamp(Math.round(saved.sat), 0, 1000),
    };
  });
}

export function HomeScreen({ onOpenSettings }: Props) {
  const insets = useSafeAreaInsets();
  const [homeName, setHomeName] = useState('My Home');
  const [homeNameModalVisible, setHomeNameModalVisible] = useState(false);
  const [homeNameInput, setHomeNameInput] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [lightGroups, setLightGroups] = useState<LightGroup[]>([]);
  const [groupStates, setGroupStates] = useState<Map<string, LightGroupState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [allOffHeld, setAllOffHeld] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Cync ─────────────────────────────────────────────────────────────────
  const [cyncDevices, setCyncDevices] = useState<CyncDevice[]>([]);
  const [cyncTokenExpired, setCyncTokenExpired] = useState(false);

  const refreshCyncDevices = useCallback(async () => {
    const [creds, runtime] = await Promise.all([
      loadCyncCredentials(),
      loadCyncRuntimeState(),
    ]);
    if (!creds) {
      setCyncDevices([]);
      return;
    }
    const hydrated = mergeCyncRuntime(storedToCyncDevices(creds.devices), runtime);
    setCyncDevices(hydrated);
    cyncSetDevices(creds.devices);
  }, []);

  // Load Cync credentials and connect TCP on mount; disconnect on unmount
  useEffect(() => {
    cyncSetStateListener((id, patch) => {
      setCyncDevices(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));
    });
    let mounted = true;
    Promise.all([loadCyncCredentials(), loadCyncRuntimeState()]).then(([creds, runtime]) => {
      if (!mounted || !creds) return;
      const hydrated = mergeCyncRuntime(storedToCyncDevices(creds.devices), runtime);
      setCyncDevices(hydrated);
      cyncSetDevices(creds.devices);
      cyncConnect(creds.loginCode, () => {
        if (mounted) {
          setCyncTokenExpired(true);
        }
      });
    });
    return () => {
      mounted = false;
      cyncSetStateListener(null);
      cyncDisconnect();
    };
  }, []);

  useEffect(() => {
    if (cyncDevices.length === 0) return;
    saveCyncRuntimeState(cyncDevices).catch(() => {
      // Non-fatal; runtime state cache is best-effort only.
    });
  }, [cyncDevices]);

  // ── Room assignment ───────────────────────────────────────────────────────
  const [deviceRooms, setDeviceRooms] = useState<Record<string, string>>({});
  const [deviceOrder, setDeviceOrderMap] = useState<Record<string, number>>({});
  const [roomModal, setRoomModal] = useState<{ deviceKey: string; deviceName: string } | null>(null);
  const [roomInput, setRoomInput] = useState('');
  const [showMoreRoomSuggestions, setShowMoreRoomSuggestions] = useState(false);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);

  const getTuyaRoomKey = useCallback((id: string) => `tuya:${id}`, []);
  const getCyncRoomKey = useCallback((id: string) => `cync:${id}`, []);
  const getTuyaOrderKey = useCallback((id: string) => `tuya:${id}`, []);
  const getCyncOrderKey = useCallback((id: string) => `cync:${id}`, []);

  const getTuyaRoom = useCallback((device: Device) => {
    return (
      deviceRooms[getTuyaRoomKey(device.id)]
      ?? deviceRooms[device.id]
      ?? device.room
      ?? device.structure
      ?? 'Other'
    );
  }, [deviceRooms, getTuyaRoomKey]);

  const getCyncRoom = useCallback((device: CyncDevice) => {
    return (
      deviceRooms[getCyncRoomKey(device.id)]
      ?? (device.homeName?.trim() || undefined)
      ?? 'Assign Home'
    );
  }, [deviceRooms, getCyncRoomKey]);

  useEffect(() => {
    Promise.all([loadCredentials(), loadDeviceRooms(), loadDeviceOrder()]).then(([creds, storedRooms, storedOrder]) => {
      if (creds) {
        setDeviceRooms({ ...storedRooms, ...(creds.deviceRooms ?? {}) });
        setDeviceOrderMap({ ...storedOrder, ...(creds.deviceOrder ?? {}) });
        setHomeName(creds.homeName?.trim() || 'My Home');
      } else {
        setDeviceRooms(storedRooms);
        setDeviceOrderMap(storedOrder);
      }
    });
  }, []);

  const handleSaveHomeName = useCallback(async () => {
    const trimmed = homeNameInput.trim();
    if (!trimmed) return;
    setHomeName(trimmed);
    setHomeNameModalVisible(false);
    const creds = await loadCredentials();
    if (creds) {
      await saveCredentials({ ...creds, homeName: trimmed });
    }
  }, [homeNameInput]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const [creds, cyncCreds] = await Promise.all([loadCredentials(), loadCyncCredentials()]);
      if (!creds && !cyncCreds) {
        setErrorModal('No saved configuration found.');
        return;
      }
      const payload = exportConfig(creds, cyncCreds);
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

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      fetchDevicesData(),
      refreshCyncDevices(),
    ]);
    cyncRequestDeviceStates();
  }, [fetchDevicesData, refreshCyncDevices]);

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
    setCyncDevices(prev => prev.map(d => ({ ...d, isOn: false })));
    // Send commands in parallel
    await Promise.allSettled([
      ...devices.map(d => controlOnOff(d.id, false)),
      ...lightGroups.map(g => setGroupOnOff(g, false)),
      ...cyncDevices.map(d => { cyncTurnOff(d.switchId, d.meshId); }),
    ]);
  }, [devices, lightGroups, cyncDevices]);

  const getOrderRank = useCallback((key: string): number => {
    const value = deviceOrder[key];
    return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER;
  }, [deviceOrder]);

  // Group devices by room for a structured layout
  const rooms = useMemo(() => {
    const map = new Map<string, { tuya: Device[]; cync: CyncDevice[] }>();
    devices.forEach(d => {
      const label = getTuyaRoom(d);
      if (!map.has(label)) map.set(label, { tuya: [], cync: [] });
      map.get(label)!.tuya.push(d);
    });
    cyncDevices.forEach(d => {
      const label = getCyncRoom(d);
      if (!map.has(label)) map.set(label, { tuya: [], cync: [] });
      map.get(label)!.cync.push(d);
    });
    const groupedRooms = Array.from(map.entries())
      .map(([name, roomGroup]) => ({ name, ...roomGroup }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return groupedRooms.map(room => ({
      ...room,
      tuya: [...room.tuya].sort((a, b) => {
        const rankDiff = getOrderRank(getTuyaOrderKey(a.id)) - getOrderRank(getTuyaOrderKey(b.id));
        if (rankDiff !== 0) return rankDiff;
        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) return nameDiff;
        return a.id.localeCompare(b.id);
      }),
      cync: [...room.cync].sort((a, b) => {
        const rankDiff = getOrderRank(getCyncOrderKey(a.id)) - getOrderRank(getCyncOrderKey(b.id));
        if (rankDiff !== 0) return rankDiff;
        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) return nameDiff;
        return a.id.localeCompare(b.id);
      }),
    }));
  }, [devices, cyncDevices, getTuyaRoom, getCyncRoom, getTuyaOrderKey, getCyncOrderKey, getOrderRank]);

  const orderedDeviceList = useMemo(() => {
    const list: Array<{ key: string; name: string; room: string; provider: 'tuya' | 'cync' }> = [];
    rooms.forEach(room => {
      room.tuya.forEach(device => {
        list.push({ key: getTuyaOrderKey(device.id), name: device.name, room: room.name, provider: 'tuya' });
      });
      room.cync.forEach(device => {
        list.push({ key: getCyncOrderKey(device.id), name: device.name, room: room.name, provider: 'cync' });
      });
    });
    return list;
  }, [rooms, getTuyaOrderKey, getCyncOrderKey]);

  const allRoomNames = useMemo(() => {
    const names = new Set<string>();
    devices.forEach(d => names.add(getTuyaRoom(d)));
    cyncDevices.forEach(d => names.add(getCyncRoom(d)));
    return Array.from(names).sort();
  }, [devices, cyncDevices, getTuyaRoom, getCyncRoom]);

  const handleAssignRoom = useCallback(async (deviceKey: string, roomName: string) => {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    const newRooms = { ...deviceRooms, [deviceKey]: trimmed };
    setDeviceRooms(newRooms);
    setRoomModal(null);
    setRoomInput('');
    setShowMoreRoomSuggestions(false);
    await saveDeviceRooms(newRooms);
    const creds = await loadCredentials();
    if (creds) {
      await saveCredentials({ ...creds, deviceRooms: newRooms });
    }
  }, [deviceRooms]);

  const handleMoveDevice = useCallback(async (targetKey: string, direction: -1 | 1) => {
    const keys = orderedDeviceList.map(d => d.key);
    const index = keys.indexOf(targetKey);
    if (index < 0) return;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= keys.length) return;

    const swapped = [...keys];
    const temp = swapped[index];
    swapped[index] = swapped[swapIndex];
    swapped[swapIndex] = temp;

    const nextOrder: Record<string, number> = {};
    swapped.forEach((key, i) => {
      nextOrder[key] = i;
    });

    setDeviceOrderMap(nextOrder);
    await saveDeviceOrder(nextOrder);
    const creds = await loadCredentials();
    if (creds) {
      await saveCredentials({ ...creds, deviceOrder: nextOrder });
    }
  }, [orderedDeviceList]);

  type ListItem =
    | { kind: 'room'; name: string; tuya: Device[]; cync: CyncDevice[] }
    | { kind: 'lightGroup'; group: LightGroup; state: LightGroupState };

  const listItems = useMemo((): ListItem[] => {
    const roomItems: ListItem[] = rooms.map(r => ({
      kind: 'room',
      name: r.name,
      tuya: r.tuya,
      cync: r.cync,
    }));
    const groupItems: ListItem[] = lightGroups.map(g => ({
      kind: 'lightGroup' as const,
      group: g,
      state: groupStates.get(g.id) ?? { groupId: g.id, ...DEFAULT_LIGHT_STATE },
    }));
    return [...roomItems, ...groupItems];
  }, [rooms, lightGroups, groupStates]);

  const hasContent = devices.length > 0 || lightGroups.length > 0 || cyncDevices.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.titleBtn}
          onPress={() => {
            setHomeNameInput(homeName);
            setHomeNameModalVisible(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.title} numberOfLines={1}>{homeName}</Text>
          <Text style={styles.titleEditHint}>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
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
          style={styles.reorderBtn}
          onPress={() => setReorderModalVisible(true)}
          disabled={orderedDeviceList.length < 2}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.reorderIcon, orderedDeviceList.length < 2 && styles.exportIconBusy]}>↕</Text>
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
          onPress={onOpenSettings}
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

      {/* ── Home title modal ── */}
      <Modal
        visible={homeNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setHomeNameModalVisible(false); setHomeNameInput(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={[styles.modalTitle, styles.homeNameModalTitle]}>Edit Home Name</Text>
            <Text style={styles.modalHint}>This title appears in the header and is included in exports.</Text>
            <TextInput
              style={styles.roomInput}
              value={homeNameInput}
              onChangeText={setHomeNameInput}
              placeholder="e.g. My Home"
              placeholderTextColor="#4b5563"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSaveHomeName}
            />
            <View style={styles.roomModalActions}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => { setHomeNameModalVisible(false); setHomeNameInput(''); }}
              >
                <Text style={styles.modalCloseTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCloseBtn, styles.modalSaveBtn, !homeNameInput.trim() && styles.modalSaveBtnDisabled]}
                onPress={handleSaveHomeName}
                disabled={!homeNameInput.trim()}
              >
                <Text style={[styles.modalCloseTxt, styles.modalSaveTxt]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Room assignment modal ── */}
      <Modal
        visible={roomModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setRoomModal(null); setRoomInput(''); setShowMoreRoomSuggestions(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Assign {roomModal?.deviceName ?? 'Device'} to Room
            </Text>
            <Text style={styles.modalSubtitle}>Choose an existing room or type a new one.</Text>
            <Text style={styles.modalHint}>Common rooms:</Text>
            <View style={styles.roomChipRow}>
              {(showMoreRoomSuggestions ? COMMON_ROOM_NAMES : COMMON_ROOM_NAMES.slice(0, 6)).map(name => (
                <TouchableOpacity
                  key={name}
                  style={styles.roomChip}
                  onPress={() => roomModal && handleAssignRoom(roomModal.deviceKey, name)}
                >
                  <Text style={styles.roomChipText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.roomSuggestionToggle}
              onPress={() => setShowMoreRoomSuggestions(v => !v)}
            >
              <Text style={styles.roomSuggestionToggleText}>
                {showMoreRoomSuggestions ? 'Show fewer' : 'Show more'}
              </Text>
            </TouchableOpacity>
            {allRoomNames.length > 0 && (
              <>
                <Text style={styles.modalHint}>Existing rooms:</Text>
                <View style={styles.roomChipRow}>
                {allRoomNames.slice(0, 15).map(name => (
                  <TouchableOpacity
                    key={name}
                    style={styles.roomChip}
                    onPress={() => roomModal && handleAssignRoom(roomModal.deviceKey, name)}
                  >
                    <Text style={styles.roomChipText}>{name}</Text>
                  </TouchableOpacity>
                ))}
                </View>
              </>
            )}
            <View style={styles.modalDivider} />
            <Text style={styles.modalHint}>Or type a new room name:</Text>
            <TextInput
              style={styles.roomInput}
              value={roomInput}
              onChangeText={setRoomInput}
              placeholder="e.g. Living Room"
              placeholderTextColor="#4b5563"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => roomModal && handleAssignRoom(roomModal.deviceKey, roomInput)}
            />
            <View style={styles.roomModalActions}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => { setRoomModal(null); setRoomInput(''); setShowMoreRoomSuggestions(false); }}
              >
                <Text style={styles.modalCloseTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCloseBtn, styles.modalSaveBtn, !roomInput.trim() && styles.modalSaveBtnDisabled]}
                onPress={() => roomModal && handleAssignRoom(roomModal.deviceKey, roomInput)}
                disabled={!roomInput.trim()}
              >
                <Text style={[styles.modalCloseTxt, styles.modalSaveTxt]}>Assign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reorder devices modal ── */}
      <Modal
        visible={reorderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReorderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={[styles.modalTitle, styles.homeNameModalTitle]}>Reorder Devices</Text>
            <Text style={styles.modalHint}>Move devices up or down to override server ordering.</Text>
            <ScrollView style={styles.reorderList} contentContainerStyle={styles.reorderListContent}>
              {orderedDeviceList.map((item, index) => (
                <View key={item.key} style={styles.reorderRow}>
                  <View style={styles.reorderMeta}>
                    <Text style={styles.reorderName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.reorderSub}>{item.room} · {item.provider === 'tuya' ? 'Tuya' : 'Cync'}</Text>
                  </View>
                  <View style={styles.reorderActions}>
                    <TouchableOpacity
                      style={[styles.reorderArrowBtn, index === 0 && styles.modalSaveBtnDisabled]}
                      onPress={() => {
                        handleMoveDevice(item.key, -1).catch(() => {
                          // no-op
                        });
                      }}
                      disabled={index === 0}
                    >
                      <Text style={styles.reorderArrowTxt}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reorderArrowBtn, index === orderedDeviceList.length - 1 && styles.modalSaveBtnDisabled]}
                      onPress={() => {
                        handleMoveDevice(item.key, 1).catch(() => {
                          // no-op
                        });
                      }}
                      disabled={index === orderedDeviceList.length - 1}
                    >
                      <Text style={styles.reorderArrowTxt}>↓</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.roomModalActions}>
              <TouchableOpacity
                style={[styles.modalCloseBtn, styles.modalSaveBtn]}
                onPress={() => setReorderModalVisible(false)}
              >
                <Text style={[styles.modalCloseTxt, styles.modalSaveTxt]}>Done</Text>
              </TouchableOpacity>
            </View>
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
        <View style={styles.listWrap}>
          {cyncTokenExpired && (
            <TouchableOpacity
              style={styles.cyncExpiredBanner}
              onPress={onOpenSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.cyncExpiredText}>
                ⚠ Cync session expired — tap to reconnect in Settings
              </Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={listItems}
            keyExtractor={item =>
              item.kind === 'room'
                ? `room-${item.name}`
                : `group-${item.group.id}`
            }
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 24 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={handleRefresh}
                tintColor="#6366f1"
                colors={['#6366f1']}
              />
            }
            renderItem={({ item }) => {
              if (item.kind === 'room') {
                return (
                  <View>
                    <Text style={styles.roomLabel}>{item.name}</Text>
                    {item.tuya.map(device => (
                      <DeviceCard
                        key={device.id}
                        provider="tuya"
                        device={device}
                        effectiveRoom={getTuyaRoom(device)}
                        onRoomPress={() => {
                          setRoomModal({ deviceKey: getTuyaRoomKey(device.id), deviceName: device.name });
                          setRoomInput('');
                          setShowMoreRoomSuggestions(false);
                        }}
                        onToggle={handleToggle}
                        onBrightnessChange={handleBrightness}
                        onFanSpeedChange={handleFanSpeed}
                        onFanLightChange={handleFanLight}
                      />
                    ))}
                    {item.cync.map(device => (
                      <DeviceCard
                        key={device.id}
                        provider="cync"
                        device={device}
                        effectiveRoom={getCyncRoom(device)}
                        onRoomPress={() => {
                          setRoomModal({ deviceKey: getCyncRoomKey(device.id), deviceName: device.name });
                          setRoomInput('');
                          setShowMoreRoomSuggestions(false);
                        }}
                        onStateChange={(id, patch) =>
                          setCyncDevices(prev =>
                            prev.map(d => (d.id === id ? { ...d, ...patch } : d)),
                          )
                        }
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
        </View>
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
  titleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#f1f5f9',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  titleEditHint: {
    color: '#4b5563',
    fontSize: 14,
    marginLeft: 8,
    marginTop: 2,
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
  reorderBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  reorderIcon: {
    color: '#4b5563',
    fontSize: 18,
    fontWeight: '700',
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
  homeNameModalTitle: {
    color: '#c7d2fe',
  },
  modalBody: {
    color: '#f1f5f9',
    fontSize: 13,
    lineHeight: 20,
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
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
  listWrap: {
    flex: 1,
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
  cyncExpiredBanner: {
    backgroundColor: '#431407',
    borderWidth: 1,
    borderColor: '#92400e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  cyncExpiredText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
  },
  // Room assignment modal extras
  roomChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  roomChip: {
    backgroundColor: '#312e81',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  roomChipText: {
    color: '#c7d2fe',
    fontSize: 13,
    fontWeight: '600',
  },
  roomSuggestionToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  roomSuggestionToggleText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
  },
  roomInput: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 14,
    marginTop: 4,
  },
  roomModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  modalSaveBtn: {
    backgroundColor: '#312e81',
    borderColor: '#6366f1',
  },
  modalSaveBtnDisabled: {
    opacity: 0.4,
  },
  modalSaveTxt: {
    color: '#c7d2fe',
  },
  reorderList: {
    maxHeight: 320,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 10,
    backgroundColor: '#0d1117',
  },
  reorderListContent: {
    padding: 8,
    gap: 8,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  reorderMeta: {
    flex: 1,
  },
  reorderName: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  reorderSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  reorderActions: {
    flexDirection: 'row',
    gap: 6,
  },
  reorderArrowBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 8,
    backgroundColor: '#312e81',
  },
  reorderArrowTxt: {
    color: '#c7d2fe',
    fontSize: 14,
    fontWeight: '700',
  },
});
