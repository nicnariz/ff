import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthStore } from '../src/auth-store';
import { useFamilyStore } from '../src/family-store';
import { resolveNavigationTarget } from '../src/navigation';
import { listFamilies } from '../src/services/families';
import { setSessionExpiredHandler } from '../src/services/http';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function RouteGuard(): JSX.Element {
  const segments = useSegments();
  const auth = useAuthStore();
  const family = useFamilyStore();
  const [familiesLoaded, setFamiliesLoaded] = useState(false);
  useEffect(() => { void auth.restore(); setSessionExpiredHandler(() => auth.signOut()); return () => setSessionExpiredHandler(); }, []);
  useEffect(() => {
    if (!auth.loaded || !auth.authenticated) { setFamiliesLoaded(false); return; }
    void listFamilies().then(async families => { await family.restore(families); setFamiliesLoaded(true); }).catch(() => setFamiliesLoaded(true));
  }, [auth.authenticated, auth.loaded]);
  const target = resolveNavigationTarget({ sessionLoaded: auth.loaded, authenticated: auth.authenticated, familiesLoaded, familyCount: family.families.length, activeFamilyId: family.activeFamilyId });
  useEffect(() => {
    if (target === 'LOADING') return;
    const group = segments[0];
    if (target === 'LOGIN' && group !== '(auth)') router.replace('/(auth)');
    else if (target === 'FAMILY_SETUP' && group !== '(family-setup)') router.replace('/(family-setup)');
    else if (target === 'FAMILY_SELECTION' && group !== '(family-setup)') router.replace('/(family-setup)/select');
    else if (target === 'APP' && group !== '(app)') router.replace('/(app)');
  }, [segments, target]);
  if (target === 'LOADING') return <View style={styles.loading}><ActivityIndicator size="large" /></View>;
  return <Stack screenOptions={{ headerShown: false }} />;
}
export default function RootLayout(): JSX.Element { return <QueryClientProvider client={queryClient}><StatusBar style="dark" /><RouteGuard /></QueryClientProvider>; }
const styles = StyleSheet.create({ loading: { alignItems: 'center', backgroundColor: '#F7F8FC', flex: 1, justifyContent: 'center' } });
