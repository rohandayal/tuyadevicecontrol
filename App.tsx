import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tuyaApi } from './src/api/tuyaClient';
import { clearCredentials, loadCredentials, loadCyncCredentials } from './src/storage/credentials';
import type { TuyaCredentials } from './src/storage/credentials';
import { HomeScreen } from './src/screens/HomeScreen';
import { SetupScreen } from './src/screens/SetupScreen';

/**
 * App routing states:
 *   null  → loading stored credentials (show splash)
 *   false → no credentials saved     → SetupScreen (initial setup)
 *   true  → credentials loaded        → HomeScreen
 *
 * showingSettings=true overlays SetupScreen on top of HomeScreen (edit mode).
 */
function App() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [showingSettings, setShowingSettings] = useState(false);
  const [storedCreds, setStoredCreds] = useState<TuyaCredentials | null>(null);
  const [hasCync, setHasCync] = useState(false);

  const bootstrap = useCallback(async () => {
    const [creds, cyncCreds] = await Promise.all([loadCredentials(), loadCyncCredentials()]);
    setHasCync(cyncCreds !== null);
    if (creds) {
      tuyaApi.validateCredentials(creds).catch(() => {
        // Credentials exist but may be stale; let HomeScreen surface the error.
      });
      setStoredCreds(creds);
      setReady(true);
    } else if (cyncCreds !== null) {
      // Cync-only setup — no Tuya credentials needed to reach HomeScreen
      setReady(true);
    } else {
      setReady(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const handleOpenSettings = async () => {
    const [creds, cyncCreds] = await Promise.all([loadCredentials(), loadCyncCredentials()]);
    setStoredCreds(creds);
    setHasCync(cyncCreds !== null);
    setShowingSettings(true);
  };

  const handleCancelSettings = () => {
    setShowingSettings(false);
  };

  const handleSetupComplete = async () => {
    const [creds, cyncCreds] = await Promise.all([loadCredentials(), loadCyncCredentials()]);
    setStoredCreds(creds);
    setHasCync(cyncCreds !== null);
    setShowingSettings(false);
    setReady(true);
  };

  const handleDisconnect = async () => {
    await clearCredentials();
    setStoredCreds(null);
    setShowingSettings(false);
    setReady(false);
  };

  if (ready === null) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {ready && !showingSettings ? (
        <HomeScreen onOpenSettings={handleOpenSettings} />
      ) : (
        <SetupScreen
          initialCredentials={showingSettings ? (storedCreds ?? undefined) : undefined}
          onSetupComplete={handleSetupComplete}
          onCancel={showingSettings ? handleCancelSettings : undefined}
          onDisconnect={showingSettings ? handleDisconnect : undefined}
          hasCync={hasCync}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;

