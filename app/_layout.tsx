import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { clearLocalSessionIfRefreshTokenInvalid, isSupabaseConfigured } from '@/lib/supabase';
import { ToastProvider } from '@/lib/toast';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void clearLocalSessionIfRefreshTokenInvalid();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ToastProvider>
        <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
        </Stack>
        <StatusBar style="auto" />
      </ToastProvider>
    </ThemeProvider>
  );
}
