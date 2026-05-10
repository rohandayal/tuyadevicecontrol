import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import {
  authenticate,
  authTwoFactor,
  fetchCyncDevices,
} from '../api/cyncClient';
import {
  clearCredentials,
  saveCredentials,
  saveCyncCredentials,
  clearCyncCredentials,
  loadCyncCredentials,
} from '../storage/credentials';
import type { TuyaCredentials } from '../storage/credentials';
import type { LightGroup } from '../types/lightGroup';
import { importConfig } from '../utils/configExport';
import { saveCyncCredentials as restoreCyncCredentials } from '../storage/credentials';
import { TuyaTab } from './setupTabs/TuyaTab';
import { CyncTab } from './setupTabs/CyncTab';
import { ImportTab } from './setupTabs/ImportTab';

interface Props {
  onSetupComplete: () => void;
  initialCredentials?: TuyaCredentials;
  onCancel?: () => void;
  onDisconnect?: () => void;
  hasCync?: boolean;
}

type SetupTab = 'tuya' | 'cync' | 'import';

const SETUP_TABS: Array<{ key: SetupTab; label: string }> = [
  { key: 'tuya', label: 'Tuya / SmartLife' },
  { key: 'cync', label: 'Cync' },
  { key: 'import', label: 'Import' },
];

export function SetupScreen({ onSetupComplete, initialCredentials, onCancel, onDisconnect, hasCync }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SetupTab>('tuya');

  const [accessId, setAccessId] = useState(initialCredentials?.accessId ?? '');
  const [secret, setSecret] = useState(initialCredentials?.secret ?? '');
  const [homeName, setHomeName] = useState(initialCredentials?.homeName ?? 'My Home');
  const [deviceOrder, setDeviceOrder] = useState<Record<string, number>>(initialCredentials?.deviceOrder ?? {});
  const [infoOpen, setInfoOpen] = useState(false);
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [deviceIds, setDeviceIds] = useState<string[]>(initialCredentials?.deviceIds ?? []);

  const [cyncEmail, setCyncEmail] = useState('');
  const [cyncPassword, setCyncPassword] = useState('');
  const [cyncPasswordVisible, setCyncPasswordVisible] = useState(false);
  const [cyncLoading, setCyncLoading] = useState(false);
  const [cyncError, setCyncError] = useState<string | null>(null);
  const [cyncConnected, setCyncConnected] = useState(hasCync ?? false);
  const [cyncDeviceCount, setCyncDeviceCount] = useState(0);

  const [twoFaVisible, setTwoFaVisible] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const pendingEmailRef = useRef('');
  const pendingPasswordRef = useRef('');

  const [lightGroups, setLightGroups] = useState<LightGroup[]>(initialCredentials?.lightGroups ?? []);
  const [groupName, setGroupName] = useState('');
  const [groupDevInput, setGroupDevInput] = useState('');
  const [groupDevIds, setGroupDevIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);

  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const activeSubtitle =
    activeTab === 'tuya'
      ? 'Tuya / SmartLife'
      : activeTab === 'cync'
        ? 'GE Cync'
        : 'Import Configuration';

  const handleImport = async () => {
    setImportError(null);
    setImportSuccess(false);
    try {
      const imported = importConfig(importText);

      // Import replaces all setup state for both ecosystems.
      const importedTuya = imported.tuya;
      setAccessId(importedTuya?.accessId ?? '');
      setSecret(importedTuya?.secret ?? '');
      setHomeName(importedTuya?.homeName ?? 'My Home');
      setDeviceOrder(importedTuya?.deviceOrder ?? {});
      setDeviceIds(importedTuya?.deviceIds ?? []);
      setLightGroups(importedTuya?.lightGroups ?? []);
      setDeviceIdInput('');
      setGroupName('');
      setGroupDevInput('');
      setGroupDevIds([]);
      setError(null);

      if (imported.cync) {
        await restoreCyncCredentials(imported.cync);
        setCyncConnected(true);
        setCyncDeviceCount(imported.cync.devices.length);
        setCyncError(null);
      } else {
        await clearCyncCredentials();
        setCyncConnected(false);
        setCyncDeviceCount(0);
        setCyncEmail('');
        setCyncPassword('');
        setCyncError(null);
      }

      setImportText('');
      setImportSuccess(true);
      setActiveTab(importedTuya ? 'tuya' : 'cync');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(msg ?? 'Import failed.');
    }
  };

  const canSave = (accessId.trim().length > 0 && secret.trim().length > 0) || cyncConnected;

  const handleCyncConnect = async () => {
    const email = cyncEmail.trim();
    const password = cyncPassword.trim();
    if (!email || !password) return;
    setCyncLoading(true);
    setCyncError(null);
    try {
      const result = await authenticate(email, password);
      if (result.status === 'ok') {
        await finishCyncSetup(email, result.userId, result.loginCode, result.accessToken);
      } else if (result.status === 'two_factor_required') {
        pendingEmailRef.current = email;
        pendingPasswordRef.current = password;
        setTwoFaCode('');
        setTwoFaError(null);
        setTwoFaVisible(true);
      } else {
        setCyncError(result.message);
      }
    } catch (e) {
      setCyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setCyncLoading(false);
      setCyncPassword('');
    }
  };

  const handleCync2FaSubmit = async () => {
    const code = twoFaCode.trim();
    if (!code) return;
    setTwoFaLoading(true);
    setTwoFaError(null);
    try {
      const result = await authTwoFactor(pendingEmailRef.current, pendingPasswordRef.current, code);
      if (result.status === 'ok') {
        setTwoFaVisible(false);
        await finishCyncSetup(pendingEmailRef.current, result.userId, result.loginCode, result.accessToken);
      } else if (result.status === 'error') {
        setTwoFaError(result.message);
      }
    } catch (e) {
      setTwoFaError(e instanceof Error ? e.message : String(e));
    } finally {
      setTwoFaLoading(false);
      pendingPasswordRef.current = '';
    }
  };

  const finishCyncSetup = async (
    email: string,
    userId: number,
    loginCode: number[],
    accessToken: string,
  ) => {
    const stored = await fetchCyncDevices(userId, accessToken);
    await saveCyncCredentials({ userId, loginCode, devices: stored });
    setCyncConnected(true);
    setCyncDeviceCount(stored.length);
    setCyncEmail('');
    setCyncError(null);
    setActiveTab('cync');
  };

  const handleCyncDisconnect = async () => {
    await clearCyncCredentials();
    setCyncConnected(false);
    setCyncDeviceCount(0);
    setCyncEmail('');
    setCyncPassword('');
    setCyncError(null);
  };

  React.useEffect(() => {
    if (hasCync) {
      loadCyncCredentials().then(c => {
        if (c) setCyncDeviceCount(c.devices.length);
      });
    }
  }, [hasCync]);

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
    const hasTuya = accessId.trim().length > 0 && secret.trim().length > 0;
    if (!hasTuya) {
      await clearCredentials();
      onSetupComplete();
      return;
    }

    setLoading(true);
    setError(null);
    const creds: TuyaCredentials = {
      accessId: accessId.trim(),
      secret: secret.trim(),
      region: 'in',
      deviceIds,
      lightGroups,
      homeName,
      deviceRooms: initialCredentials?.deviceRooms ?? {},
      deviceOrder,
    };

    try {
      await tuyaApi.validateCredentials(creds);
      await saveCredentials(creds);
      onSetupComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg ?? 'Could not connect. Check your credentials and try again.');
      setActiveTab('tuya');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View pointerEvents="none" style={styles.topBackground} />
      <View pointerEvents="none" style={styles.topGlowPrimary} />
      <View pointerEvents="none" style={styles.topGlowSecondary} />

      <View style={[styles.headerWrap, { paddingTop: insets.top + 16 }]}>
        {onCancel && (
          <TouchableOpacity style={styles.backBtn} onPress={onCancel} hitSlop={8}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        )}

        <View style={styles.logoWrap}>
          <View pointerEvents="none" style={styles.logoHalo} />
          <Image
            source={require('../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>{onCancel ? 'Settings' : 'Bedroom Control'}</Text>
        <Text style={styles.subtitle}>{activeSubtitle}</Text>
      </View>

      <View style={styles.tabBarWrap}>
        <Text style={styles.tabBarTitle}>Setup Sections</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollerContent}
          style={styles.tabScroller}
        >
          <View style={styles.tabTrack}>
            {SETUP_TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    activeTab === tab.key && styles.tabItemTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {activeTab === tab.key ? <View style={styles.tabItemIndicator} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tabPanel}>
          {activeTab === 'tuya' && (
            <TuyaTab
              infoOpen={infoOpen}
              onToggleInfo={() => setInfoOpen(v => !v)}
              accessId={accessId}
              onChangeAccessId={setAccessId}
              secret={secret}
              onChangeSecret={setSecret}
              secretVisible={secretVisible}
              onToggleSecretVisible={() => setSecretVisible(v => !v)}
              deviceIdInput={deviceIdInput}
              onChangeDeviceIdInput={setDeviceIdInput}
              deviceIds={deviceIds}
              onAddDeviceId={addDeviceId}
              onRemoveDeviceId={removeDeviceId}
              groupName={groupName}
              onChangeGroupName={setGroupName}
              groupDevInput={groupDevInput}
              onChangeGroupDevInput={setGroupDevInput}
              groupDevIds={groupDevIds}
              onAddGroupDevId={addGroupDevId}
              onRemoveGroupDevId={(id: string) => setGroupDevIds(prev => prev.filter(d => d !== id))}
              onAddGroup={addGroup}
              lightGroups={lightGroups}
              onRemoveGroup={removeGroup}
            />
          )}

          {activeTab === 'cync' && (
            <CyncTab
              cyncConnected={cyncConnected}
              cyncDeviceCount={cyncDeviceCount}
              cyncEmail={cyncEmail}
              onChangeCyncEmail={setCyncEmail}
              cyncPassword={cyncPassword}
              onChangeCyncPassword={setCyncPassword}
              cyncPasswordVisible={cyncPasswordVisible}
              onToggleCyncPasswordVisible={() => setCyncPasswordVisible(v => !v)}
              cyncLoading={cyncLoading}
              cyncError={cyncError}
              onConnect={handleCyncConnect}
              onDisconnect={handleCyncDisconnect}
            />
          )}

          {activeTab === 'import' && (
            <ImportTab
              importText={importText}
              onChangeImportText={(value: string) => {
                setImportText(value);
                setImportError(null);
                setImportSuccess(false);
              }}
              importError={importError}
              importSuccess={importSuccess}
              onImport={handleImport}
            />
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {onDisconnect && (
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={onDisconnect}
            activeOpacity={0.85}
          >
            <Text style={styles.disconnectBtnText}>Disconnect & Reset</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.btn, (!canSave || loading) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!canSave || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {onCancel ? 'Save' : (cyncConnected && !accessId.trim() ? 'Continue' : 'Connect')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={twoFaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setTwoFaVisible(false); pendingPasswordRef.current = ''; }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Two-Factor Authentication</Text>
            <Text style={styles.modalBody}>
              A verification code was sent to your Cync account email. Enter it below.
            </Text>
            <TextInput
              style={[styles.input, styles.modalInput]}
              value={twoFaCode}
              onChangeText={setTwoFaCode}
              placeholder="6-digit code"
              placeholderTextColor="#4b5563"
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {twoFaError ? <Text style={[styles.errorText, styles.modalErrorText]}>{twoFaError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setTwoFaVisible(false); pendingPasswordRef.current = ''; }}
              >
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  (!twoFaCode.trim() || twoFaLoading) && styles.btnDisabled,
                ]}
                onPress={handleCync2FaSubmit}
                disabled={!twoFaCode.trim() || twoFaLoading}
              >
                {twoFaLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmTxt}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000000' },
  topBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 280,
    backgroundColor: '#060a14',
  },
  topGlowPrimary: {
    position: 'absolute',
    top: -110,
    left: -80,
    width: 360,
    height: 260,
    borderRadius: 180,
    backgroundColor: '#2b4f9a',
    opacity: 0.2,
  },
  topGlowSecondary: {
    position: 'absolute',
    top: -130,
    right: -90,
    width: 340,
    height: 240,
    borderRadius: 170,
    backgroundColor: '#2b8d8a',
    opacity: 0.14,
  },
  headerWrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  tabBarWrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1b2438',
    zIndex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
  },
  logoWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoHalo: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#5f80d8',
    opacity: 0.2,
  },
  logoImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
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
  tabBarTitle: {
    color: '#6f7ea5',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '700',
    marginBottom: 8,
  },
  tabScroller: {
    width: '100%',
  },
  tabScrollerContent: {
    paddingHorizontal: 24,
    minWidth: '100%',
    justifyContent: 'center',
  },
  tabTrack: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#22304b',
    borderRadius: 0,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#0f1627',
    borderRightWidth: 1,
    borderRightColor: '#22304b',
    minWidth: 116,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: '#111f3f',
  },
  tabItemText: {
    color: '#8b98b8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabItemTextActive: {
    color: '#dbe7ff',
  },
  tabItemIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: '#4f83ff',
  },
  tabPanel: {
    width: '100%',
    marginTop: 8,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  btn: {
    width: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#312e81', opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    backgroundColor: '#000000',
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  backBtnText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectBtn: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  disconnectBtnText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '600',
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#1d1d35',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#312e81',
    gap: 6,
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalBody: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalCancelTxt: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: '#065f46',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#059669',
    minWidth: 80,
    alignItems: 'center',
  },
  modalConfirmTxt: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
  },
  modalInput: {
    width: '100%',
    marginTop: 12,
  },
  modalErrorText: {
    marginTop: 6,
  },
});
