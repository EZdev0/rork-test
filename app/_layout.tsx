import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof process !== 'undefined' && process.env) {
  // Proxy Rork SDK requests to avoid CORS in browser
  process.env['EXPO_PUBLIC_TOOLKIT_URL'] = 'https://corsproxy.io/?' + encodeURIComponent('https://toolkit.rork.com');
}

import { AppProvider } from '@/providers/AppProvider';
import { ProjectProvider } from '@/providers/ProjectProvider';
import { ChatProvider } from '@/providers/ChatProvider';
import { AgentProvider } from '@/providers/AgentProvider';
import { IDE } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Zurück' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="editor"
        options={{
          presentation: 'card',
          headerStyle: { backgroundColor: IDE.surface },
          headerTintColor: IDE.text,
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <ProjectProvider>
            <ChatProvider>
              <AgentProvider>
                <StatusBar style="light" />
                <RootLayoutNav />
              </AgentProvider>
            </ChatProvider>
          </ProjectProvider>
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
