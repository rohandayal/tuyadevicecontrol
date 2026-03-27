import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tuyaApi } from '../api/tuyaClient';
import { saveCredentials } from '../storage/credentials';
import type { TuyaCredentials } from '../storage/credentials';
import type { LightGroup } from '../types/lightGroup';
import { importConfig } from '../utils/configExport';

interface Props {
  onSetupComplete: () => void;
}

export function SetupScreen({ onSetupComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [accessId, setAccessId] = useState('');
  const [secret, setSecret] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);

  // Light groups
  const [lightGroups, setLightGroups] = useState<LightGroup[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDevInput, setGroupDevInput] = useState('');
  const [groupDevIds, setGroupDevIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);

  // ── Config import ────────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleImport = () => {
    setImportError(null);
    setImportSuccess(false);
    try {
      const creds = importConfig(importText);
      setAccessId(creds.accessId);
      setSecret(creds.secret);
      setDeviceIds(creds.deviceIds);
      setLightGroups(creds.lightGroups);
      setImportText('');
      setImportSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(msg ?? 'Import failed.');
    }
  };

  const canSave = accessId.trim().length > 0 && secret.trim().length > 0;

  const addDeviceId = () => {
    const id = deviceIdInput.trim();
    if (id && !deviceIds.includes(id)) {
      setDeviceIds(prev => [...prev, id]);
    }
    setDeviceIdInput('');
  };

  const removeDeviceId = (id: string) => {
    setDeviceIds(prev => prev.filter(d => d !== id));
  };

  const addGroupDevId = () => {
    const id = groupDevInput.trim();
    if (id && !groupDevIds.includes(id)) {
      setGroupDevIds(prev => [...prev, id]);
    }
    setGroupDevInput('');
  };

  const addGroup = () => {
    const name = groupName.trim();
    if (!name || groupDevIds.length === 0) return;
    const id = `lg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setLightGroups(prev => [...prev, { id, name, deviceIds: groupDevIds }]);
    setGroupName('');
    setGroupDevInput('');
    setGroupDevIds([]);
  };

  const removeGroup = (id: string) => {
    setLightGroups(prev => prev.filter(g => g.id !== id));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    const creds: TuyaCredentials = {
      accessId: accessId.trim(),
      secret: secret.trim(),
      region: 'in',
      deviceIds,
      lightGroups,
    };
    try {
      await tuyaApi.validateCredentials(creds);
      await saveCredentials(creds);
      onSetupComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg ?? 'Could not connect. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Header */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoIcon}>🏠</Text>
        </View>
        <Text style={styles.title}>Bedroom Control</Text>
        <Text style={styles.subtitle}>Connect to Tuya / SmartLife</Text>

        {/* How-to box — collapsible */}
        <TouchableOpacity
          style={styles.infoBox}
          onPress={() => setInfoOpen(v => !v)}
          activeOpacity={0.85}
        >
          <View style={styles.infoTitleRow}>
            <Text style={styles.infoTitle}>One-time setup</Text>
            <Text style={styles.infoChevron}>{infoOpen ? '▲' : '▼'}</Text>
          </View>
          {infoOpen && (
            <>
              <Text style={styles.infoText}>
                1. Register at{' '}
                <Text style={styles.infoLink}>platform.tuya.com</Text>
                {'\n'}
                2. Create a Cloud project → enable{' '}
                <Text style={styles.infoHighlight}>IoT Core</Text> API product{'\n'}
                3. In your project → <Text style={styles.infoHighlight}>Devices</Text> →{' '}
                <Text style={styles.infoHighlight}>Link Tuya App Account</Text>
                {' '}→ scan QR with SmartLife{'\n'}
                4. Copy your <Text style={styles.infoHighlight}>Access ID</Text> and{' '}
                <Text style={styles.infoHighlight}>Access Secret</Text> from the project overview
              </Text>
              <Text style={styles.infoNote}>
                Wipro Next devices: add them to the SmartLife app first
                (they are Tuya-compatible). If they don't appear, try the official
                Wipro Next app's "Link with SmartLife" option if available.
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Form */}
        <View style={styles.form}>

          {/* ── Import config ── */}
          <TouchableOpacity
            style={styles.importBox}
            onPress={() => setImportOpen(v => !v)}
            activeOpacity={0.85}
          >
            <View style={styles.infoTitleRow}>
              <Text style={styles.importTitle}>Import Configuration</Text>
              <Text style={styles.infoChevron}>{importOpen ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>
          {importOpen && (
            <View style={styles.importBodyBox}>
              <Text style={styles.importHint}>
                Paste a config string exported from another device to fill all fields automatically.
              </Text>
              <TextInput
                style={[styles.input, styles.importInput]}
                value={importText}
                onChangeText={t => { setImportText(t); setImportError(null); setImportSuccess(false); }}
                placeholder="Paste HC1:… config here"
                placeholderTextColor="#4b5563"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              {importError ? (
                <Text style={styles.importError}>{importError}</Text>
              ) : importSuccess ? (
                <Text style={styles.importOk}>✓ Configuration loaded — review and connect below.</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.importBtn, !importText.trim() && styles.addBtnDisabled]}
                onPress={handleImport}
                disabled={!importText.trim()}
                activeOpacity={0.85}
              >
                <Text style={styles.importBtnText}>Load Config</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.label}>Access ID (Client ID)</Text>
          <TextInput
            style={styles.input}
            value={accessId}
            onChangeText={setAccessId}
            placeholder="e.g. p2a7rs9k3…"
            placeholderTextColor="#4b5563"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Access Secret (Client Secret)</Text>
          <View style={styles.secretRow}>
            <TextInput
              style={[styles.input, styles.secretInput]}
              value={secret}
              onChangeText={setSecret}
              placeholder="e.g. 3e8d2f1a…"
              placeholderTextColor="#4b5563"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!secretVisible}
            />
            <TouchableOpacity
              style={styles.revealBtn}
              onPress={() => setSecretVisible(v => !v)}
              hitSlop={8}
            >
              <Text style={styles.revealIcon}>{secretVisible ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Device IDs</Text>
          <Text style={styles.deviceHint}>
            Find device IDs in Tuya console → Cloud → Devices → click a device
          </Text>
          <View style={styles.deviceInputRow}>
            <TextInput
              style={[styles.input, styles.deviceInput]}
              value={deviceIdInput}
              onChangeText={setDeviceIdInput}
              placeholder="e.g. bfabc123..."
              placeholderTextColor="#4b5563"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={addDeviceId}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addBtn, !deviceIdInput.trim() && styles.addBtnDisabled]}
              onPress={addDeviceId}
              disabled={!deviceIdInput.trim()}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {deviceIds.map(id => (
            <View key={id} style={styles.deviceChip}>
              <Text style={styles.deviceChipText} numberOfLines={1}>{id}</Text>
              <TouchableOpacity onPress={() => removeDeviceId(id)} hitSlop={8}>
                <Text style={styles.deviceChipRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* ── Light Groups ── */}
          <Text style={[styles.label, { marginTop: 20 }]}>Light Groups</Text>
          <Text style={styles.deviceHint}>
            Group multiple colour lights to control together
          </Text>

          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name (e.g. Living Room)"
            placeholderTextColor="#4b5563"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <View style={styles.deviceInputRow}>
            <TextInput
              style={[styles.input, styles.deviceInput]}
              value={groupDevInput}
              onChangeText={setGroupDevInput}
              placeholder="Device ID for this group..."
              placeholderTextColor="#4b5563"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={addGroupDevId}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addBtn, !groupDevInput.trim() && styles.addBtnDisabled]}
              onPress={addGroupDevId}
              disabled={!groupDevInput.trim()}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {groupDevIds.map(id => (
            <View key={id} style={styles.deviceChip}>
              <Text style={styles.deviceChipText} numberOfLines={1}>{id}</Text>
              <TouchableOpacity onPress={() => setGroupDevIds(prev => prev.filter(d => d !== id))} hitSlop={8}>
                <Text style={styles.deviceChipRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.addGroupBtn,
              (!groupName.trim() || groupDevIds.length === 0) && styles.addBtnDisabled,
            ]}
            onPress={addGroup}
            disabled={!groupName.trim() || groupDevIds.length === 0}
          >
            <Text style={styles.addGroupBtnText}>+ Save Group</Text>
          </TouchableOpacity>

          {lightGroups.length > 0 && (
            <View style={styles.groupList}>
              {lightGroups.map(g => (
                <View key={g.id} style={styles.groupChip}>
                  <Text style={styles.groupChipText}>
                    💡 {g.name}
                    <Text style={styles.groupChipSub}> · {g.deviceIds.length} device{g.deviceIds.length !== 1 ? 's' : ''}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => removeGroup(g.id)} hitSlop={8}>
                    <Text style={styles.deviceChipRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!canSave || loading) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!canSave || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Connect</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000000' },
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoIcon: { fontSize: 36 },
  title: {
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#6366f1',
    fontSize: 14,
    marginBottom: 4,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#1d1d35',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#312e81',
    padding: 16,
    gap: 8,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTitle: {
    flex: 1,
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoChevron: {
    color: '#4b5563',
    fontSize: 11,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 21,
  },
  infoLink: {
    color: '#818cf8',
  },
  infoHighlight: {
    color: '#c7d2fe',
    fontWeight: '600',
  },
  infoNote: {
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    paddingTop: 8,
    marginTop: 4,
  },
  form: {
    width: '100%',
    gap: 6,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 14,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  deviceHint: {
    color: '#4b5563',
    fontSize: 11,
    marginBottom: 4,
  },
  deviceInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  deviceInput: {
    flex: 1,
  },
  addBtn: {
    backgroundColor: '#312e81',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  // Import box
  importBox: {
    width: '100%',
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  importBodyBox: {
    width: '100%',
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  importTitle: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  importHint: {
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 18,
  },
  importInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 11,
  },
  importError: {
    color: '#f87171',
    fontSize: 12,
  },
  importOk: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
  },
  importBtn: {
    backgroundColor: '#1d1d35',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
    alignItems: 'center',
  },
  importBtnText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 13,
  },
  // Secret reveal
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secretInput: {
    flex: 1,
  },
  revealBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 12,
  },
  revealIcon: {
    fontSize: 18,
  },
  addBtnText: {
    color: '#c7d2fe',
    fontWeight: '700',
    fontSize: 13,
  },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  deviceChipText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  deviceChipRemove: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '700',
  },
  addGroupBtn: {
    marginTop: 4,
    backgroundColor: '#1d1d35',
    borderRadius: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#6366f1',
    alignItems: 'center',
  },
  addGroupBtnText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 13,
  },
  groupList: {
    gap: 6,
    marginTop: 4,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#312e81',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  groupChipText: {
    flex: 1,
    color: '#c7d2fe',
    fontSize: 13,
    fontWeight: '600',
  },
  groupChipSub: {
    color: '#4b5563',
    fontWeight: '400',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  btn: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
    minWidth: 180,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#312e81', opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
