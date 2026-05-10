import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface CyncTabProps {
  cyncConnected: boolean;
  cyncDeviceCount: number;
  cyncEmail: string;
  onChangeCyncEmail: (value: string) => void;
  cyncPassword: string;
  onChangeCyncPassword: (value: string) => void;
  cyncPasswordVisible: boolean;
  onToggleCyncPasswordVisible: () => void;
  cyncLoading: boolean;
  cyncError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function CyncTab({
  cyncConnected,
  cyncDeviceCount,
  cyncEmail,
  onChangeCyncEmail,
  cyncPassword,
  onChangeCyncPassword,
  cyncPasswordVisible,
  onToggleCyncPasswordVisible,
  cyncLoading,
  cyncError,
  onConnect,
  onDisconnect,
}: CyncTabProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pageCard}>
        <Text style={styles.sectionTitle}>GE Cync Setup</Text>
        <Text style={styles.sectionHint}>Connect your Cync account and sync devices.</Text>
        {cyncConnected ? (
          <View style={styles.connectedBox}>
            <Text style={styles.connectedText}>
              ✓ Connected — {cyncDeviceCount} device{cyncDeviceCount !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={onDisconnect}
              activeOpacity={0.85}
            >
              <Text style={styles.disconnectBtnText}>Disconnect Cync</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Cync Email</Text>
            <TextInput
              style={styles.input}
              value={cyncEmail}
              onChangeText={onChangeCyncEmail}
              placeholder="your@email.com"
              placeholderTextColor="#4b5563"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Text style={styles.label}>Cync Password</Text>
            <View style={styles.secretRow}>
              <TextInput
                style={[styles.input, styles.secretInput]}
                value={cyncPassword}
                onChangeText={onChangeCyncPassword}
                placeholder="password"
                placeholderTextColor="#4b5563"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!cyncPasswordVisible}
              />
              <TouchableOpacity
                style={styles.revealBtn}
                onPress={onToggleCyncPasswordVisible}
                hitSlop={8}
              >
                <Text style={styles.revealIcon}>{cyncPasswordVisible ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            {cyncError ? <Text style={styles.errorText}>{cyncError}</Text> : null}
            <TouchableOpacity
              style={[
                styles.connectBtn,
                (!cyncEmail.trim() || !cyncPassword.trim() || cyncLoading) && styles.btnDisabled,
              ]}
              onPress={onConnect}
              disabled={!cyncEmail.trim() || !cyncPassword.trim() || cyncLoading}
              activeOpacity={0.85}
            >
              {cyncLoading ? (
                <ActivityIndicator color="#34d399" />
              ) : (
                <Text style={styles.connectBtnText}>Connect Cync</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

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
    gap: 8,
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
  connectedBox: {
    backgroundColor: '#121a2f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2c3d62',
    padding: 14,
    gap: 10,
  },
  connectedText: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#394b72',
  },
  disconnectBtnText: {
    color: '#93a8d6',
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
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
  connectBtn: {
    backgroundColor: '#141f37',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#3b5ea8',
  },
  connectBtnText: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});