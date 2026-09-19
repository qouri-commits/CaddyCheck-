import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Image, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function Index() {
  const colors = useColors();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const fallbackTimer = setTimeout(() => {
      if (active) setOnboarded(false);
    }, 2000);

    AsyncStorage.getItem("onboarded")
      .then((val) => {
        if (active) setOnboarded(!!val);
      })
      .catch(() => {
        if (active) setOnboarded(false);
      })
      .finally(() => clearTimeout(fallbackTimer));

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  if (onboarded === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          gap: 16,
        }}
      >
        <Image
          source={require("@/assets/images/icon.png")}
          style={{ width: 84, height: 84, borderRadius: 20 }}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
