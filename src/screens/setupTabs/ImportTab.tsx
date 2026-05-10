import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ImportTabProps {
  importText: string;
  onChangeImportText: (value: string) => void;
  importError: string | null;
  importSuccess: boolean;
  onImport: () => void;
}

export function ImportTab({
  importText,
  onChangeImportText,
  importError,
  importSuccess,
  onImport,
}: ImportTabProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pageCard}>
        <Text style={styles.sectionTitle}>Import Configuration</Text>
        <Text style={styles.sectionHint}>
          Pasting HC1/HC2 config here will overwrite all Tuya/SmartLife and Cync values in this setup screen.
        </Text>
        <TextInput
          style={[styles.input, styles.importInput]}
          value={importText}
          onChangeText={onChangeImportText}
          placeholder="Paste HC1:… or HC2:… config here"
          placeholderTextColor="#4b5563"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        {importError ? (
          <Text style={styles.importError}>{importError}</Text>
        ) : importSuccess ? (
          <Text style={styles.importOk}>✓ Configuration loaded. Review Tuya and Cync tabs, then save.</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.importBtn, !importText.trim() && styles.btnDisabled]}
          onPress={onImport}
          disabled={!importText.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.importBtnText}>Load Config</Text>
        </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sectionHint: {
    color: '#4b5563',
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#1d1d35',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 12,
  },
  importInput: {
    minHeight: 92,
    textAlignVertical: 'top',
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
  btnDisabled: {
    opacity: 0.4,
  },
});