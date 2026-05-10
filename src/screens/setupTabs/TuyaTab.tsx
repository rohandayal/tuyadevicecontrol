import React from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { LightGroup } from '../../types/lightGroup';

interface TuyaTabProps {
  infoOpen: boolean;
  onToggleInfo: () => void;
  accessId: string;
  onChangeAccessId: (value: string) => void;
  secret: string;
  onChangeSecret: (value: string) => void;
  secretVisible: boolean;
  onToggleSecretVisible: () => void;
  deviceIdInput: string;
  onChangeDeviceIdInput: (value: string) => void;
  deviceIds: string[];
  onAddDeviceId: () => void;
  onRemoveDeviceId: (id: string) => void;
  groupName: string;
  onChangeGroupName: (value: string) => void;
  groupDevInput: string;
  onChangeGroupDevInput: (value: string) => void;
  groupDevIds: string[];
  onAddGroupDevId: () => void;
  onRemoveGroupDevId: (id: string) => void;
  onAddGroup: () => void;
  lightGroups: LightGroup[];
  onRemoveGroup: (id: string) => void;
}

export function TuyaTab({
  infoOpen,
  onToggleInfo,
  accessId,
  onChangeAccessId,
  secret,
  onChangeSecret,
  secretVisible,
  onToggleSecretVisible,
  deviceIdInput,
  onChangeDeviceIdInput,
  deviceIds,
  onAddDeviceId,
  onRemoveDeviceId,
  groupName,
  onChangeGroupName,
  groupDevInput,
  onChangeGroupDevInput,
  groupDevIds,
  onAddGroupDevId,
  onRemoveGroupDevId,
  onAddGroup,
  lightGroups,
  onRemoveGroup,
}: TuyaTabProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pageCard}>
        <Text style={styles.sectionTitle}>Tuya / SmartLife Setup</Text>
        <Text style={styles.sectionHint}>Configure credentials, devices, and light groups.</Text>

        <TouchableOpacity
          style={styles.infoBox}
          onPress={onToggleInfo}
          activeOpacity={0.85}
        >
          <View style={styles.infoTitleRow}>
            <Text style={styles.infoTitle}>One-time setup</Text>
            <Text style={styles.infoChevron}>{infoOpen ? '▲' : '▼'}</Text>
          </View>
          {infoOpen && (
            <>
              <Text style={styles.infoText}>
                1. Register at <Text style={styles.infoLink}>platform.tuya.com</Text>
                {'\n'}
                2. Create a Cloud project and enable <Text style={styles.infoHighlight}>IoT Core</Text>
                {'\n'}
                3. In your project open <Text style={styles.infoHighlight}>Devices</Text> and link your app account
                {'\n'}
                4. Copy <Text style={styles.infoHighlight}>Access ID</Text> and <Text style={styles.infoHighlight}>Access Secret</Text>
              </Text>
              <Text style={styles.infoNote}>
                Wipro Next devices: add them in SmartLife first (Tuya-compatible).
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Access ID (Client ID)</Text>
        <TextInput
          style={styles.input}
          value={accessId}
          onChangeText={onChangeAccessId}
          placeholder="e.g. p2a7rs9k3..."
          placeholderTextColor="#4b5563"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Access Secret (Client Secret)</Text>
        <View style={styles.secretRow}>
          <TextInput
            style={[styles.input, styles.secretInput]}
            value={secret}
            onChangeText={onChangeSecret}
            placeholder="e.g. 3e8d2f1a..."
            placeholderTextColor="#4b5563"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!secretVisible}
          />
          <TouchableOpacity
            style={styles.revealBtn}
            onPress={onToggleSecretVisible}
            hitSlop={8}
          >
            <Text style={styles.revealIcon}>{secretVisible ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Device IDs</Text>
        <Text style={styles.deviceHint}>
          Tuya console → Cloud → Devices → select a device
        </Text>
        <View style={styles.deviceInputRow}>
          <TextInput
            style={[styles.input, styles.deviceInput]}
            value={deviceIdInput}
            onChangeText={onChangeDeviceIdInput}
            placeholder="e.g. bfabc123..."
            placeholderTextColor="#4b5563"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={onAddDeviceId}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !deviceIdInput.trim() && styles.addBtnDisabled]}
            onPress={onAddDeviceId}
            disabled={!deviceIdInput.trim()}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {deviceIds.map(id => (
          <View key={id} style={styles.deviceChip}>
            <Text style={styles.deviceChipText} numberOfLines={1}>{id}</Text>
            <TouchableOpacity onPress={() => onRemoveDeviceId(id)} hitSlop={8}>
              <Text style={styles.deviceChipRemove}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.label, styles.labelSpacedTop]}>Light Groups</Text>
        <Text style={styles.deviceHint}>Group multiple lights for shared control</Text>

        <TextInput
          style={styles.input}
          value={groupName}
          onChangeText={onChangeGroupName}
          placeholder="Group name (e.g. Living Room)"
          placeholderTextColor="#4b5563"
          autoCapitalize="words"
          autoCorrect={false}
        />

        <View style={styles.deviceInputRow}>
          <TextInput
            style={[styles.input, styles.deviceInput]}
            value={groupDevInput}
            onChangeText={onChangeGroupDevInput}
            placeholder="Device ID for this group..."
            placeholderTextColor="#4b5563"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={onAddGroupDevId}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !groupDevInput.trim() && styles.addBtnDisabled]}
            onPress={onAddGroupDevId}
            disabled={!groupDevInput.trim()}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {groupDevIds.map(id => (
          <View key={id} style={styles.deviceChip}>
            <Text style={styles.deviceChipText} numberOfLines={1}>{id}</Text>
            <TouchableOpacity onPress={() => onRemoveGroupDevId(id)} hitSlop={8}>
              <Text style={styles.deviceChipRemove}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.addGroupBtn,
            (!groupName.trim() || groupDevIds.length === 0) && styles.addBtnDisabled,
          ]}
          onPress={onAddGroup}
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
                  <Text style={styles.groupChipSub}>
                    {' '}· {g.deviceIds.length} device{g.deviceIds.length !== 1 ? 's' : ''}
                  </Text>
                </Text>
                <TouchableOpacity onPress={() => onRemoveGroup(g.id)} hitSlop={8}>
                  <Text style={styles.deviceChipRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const monoFamily = Platform.OS === 'android' ? 'monospace' : 'Menlo';

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  pageCard: {
    width: '100%',
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    padding: 14,
    gap: 6,
  },
  sectionTitle: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHint: {
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#131a2b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3a5f',
    padding: 16,
    gap: 8,
    marginBottom: 4,
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
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  labelSpacedTop: {
    marginTop: 20,
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
    fontFamily: monoFamily,
  },
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
    fontFamily: monoFamily,
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
});