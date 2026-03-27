import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tuyaApi } from './src/api/tuyaClient';
import { clearCredentials, loadCredentials } from './src/storage/credentials';
import { HomeScreen } from './src/screens/HomeScreen';
import { SetupScreen } from './src/screens/SetupScreen';

/**
 * App routing states:
 *   null  → loading stored credentials (show splash)
 *   false → no credentials saved     → SetupScreen
 *   true  → credentials loaded        → HomeScreen
 */
function App() {
  const [ready, setReady] = useState<boolean | null>(null);

  const bootstrap = async () => {
    const creds = await loadCredentials();
    if (creds) {
      tuyaApi.validateCredentials(creds).catch(() => {
        // Credentials exist but may be stale; let HomeScreen surface the error
        // rather than kicking the user back to Setup unnecessarily.
      });
      setReady(true);
    } else {
      setReady(false);
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = async () => {
    await clearCredentials();
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
      {ready ? (
        <HomeScreen onDisconnect={handleDisconnect} />
      ) : (
        <SetupScreen onSetupComplete={() => setReady(true)} />
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

