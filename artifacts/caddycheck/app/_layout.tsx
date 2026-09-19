import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/context/LanguageContext";
import { BasketProvider } from "@/context/BasketContext";

if (Platform.OS !== "web") {
  void SplashScreen.preventAutoHideAsync().catch((error) => {
    console.warn("Unable to keep the splash screen visible:", error);
  });
}

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web" || fontsLoaded || fontError) return;
    const timeout = setTimeout(() => setFontLoadTimedOut(true), 3500);
    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (
      Platform.OS !== "web" &&
      (fontsLoaded || fontError || fontLoadTimedOut)
    ) {
      void SplashScreen.hideAsync().catch((error) => {
        console.warn("Unable to hide the splash screen:", error);
      });
    }
  }, [fontsLoaded, fontError, fontLoadTimedOut]);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <LanguageProvider>
                <BasketProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="scan"
                      options={{ headerShown: false, presentation: "fullScreenModal" }}
                    />
                    <Stack.Screen
                      name="compare"
                      options={{ headerShown: false, presentation: "modal" }}
                    />
                    <Stack.Screen
                      name="price-compare"
                      options={{ headerShown: false, presentation: "modal" }}
                    />
                  </Stack>
                </BasketProvider>
              </LanguageProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
