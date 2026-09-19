import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";

const { width } = Dimensions.get("window");

interface Slide {
  id: string;
  titleKey: string;
  subtitleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
}

const SLIDES: Slide[] = [
  { id: "1", titleKey: "onboarding1Title", subtitleKey: "onboarding1Subtitle", icon: "barcode-outline", iconBg: "#ECFDF5" },
  { id: "2", titleKey: "onboarding2Title", subtitleKey: "onboarding2Subtitle", icon: "calculator-outline", iconBg: "#EFF6FF" },
  { id: "3", titleKey: "onboarding3Title", subtitleKey: "onboarding3Subtitle", icon: "trending-down-outline", iconBg: "#FFF7ED" },
];

function SlideItem({ slide }: { slide: Slide }) {
  const colors = useColors();
  const { t } = useLanguage();
  const topPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.slide, { width, paddingTop: topPad }]}>
      <View style={[styles.iconCircle, { backgroundColor: slide.iconBg, borderRadius: colors.radius * 4 }]}>
        <Ionicons name={slide.icon} size={64} color={colors.primary} />
      </View>
      <Text style={[styles.slideTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
        {t(slide.titleKey as Parameters<typeof t>[0])}
      </Text>
      <Text style={[styles.slideSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
        {t(slide.subtitleKey as Parameters<typeof t>[0])}
      </Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, language, isRTL, flexDirection } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = async () => {
    await Haptics.selectionAsync();
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  };

  const handleStart = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem("onboarded", "true");
    router.replace("/(tabs)");
  };

  const isLast = currentIndex === SLIDES.length - 1;
  const privacyCopy = {
    en: { notice: "Your shopping data stays on this device unless you explicitly look up a barcode or start a live sharing session.", link: "Read privacy & help" },
    fr: { notice: "Vos données restent sur cet appareil, sauf si vous recherchez un code-barres ou démarrez une session de partage.", link: "Lire confidentialité et aide" },
    ar: { notice: "تبقى بيانات التسوق على هذا الجهاز إلا إذا طلبت البحث عن باركود أو بدأت جلسة مشاركة مباشرة.", link: "اقرأ الخصوصية والمساعدة" },
  }[language];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={({ item }) => <SlideItem slide={item} />}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.flatList}
      />

      <View style={[styles.dots, { paddingBottom: 8 }]}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === currentIndex ? colors.primary : colors.border,
                width: i === currentIndex ? 24 : 8,
              },
            ]}
            accessibilityLabel={`${i + 1} / ${SLIDES.length}`}
          />
        ))}
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8), paddingHorizontal: 24 },
        ]}
      >
        {isLast && (
          <View style={[styles.privacyNotice, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.privacyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }]}>
              {privacyCopy.notice}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/privacy-help")}
              accessibilityRole="link"
              accessibilityLabel={privacyCopy.link}
              testID="onboarding-privacy-link"
            >
              <Text style={[styles.privacyLink, { color: colors.primary, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }]}>
                {privacyCopy.link}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={isLast ? handleStart : handleNext}
          style={[
            styles.btn,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
            },
          ]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isLast ? t("start") : t("next" as Parameters<typeof t>[0])}
        >
          <Text
            style={[
              styles.btnText,
              { color: "#fff", fontFamily: "Inter_700Bold" },
            ]}
          >
            {isLast ? t("start") : t("next" as Parameters<typeof t>[0])}
          </Text>
          {!isLast && (
            <Ionicons
              name={isRTL ? "arrow-back" : "arrow-forward"}
              size={20}
              color="#fff"
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flatList: { flex: 1 },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 24 },
  iconCircle: { width: 160, height: 160, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  slideTitle: { fontSize: 28, lineHeight: 36 },
  slideSubtitle: { fontSize: 16, lineHeight: 24 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 },
  dot: { height: 8, borderRadius: 4 },
  footer: { gap: 16 },
  privacyNotice: { padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  privacyText: { fontSize: 13, lineHeight: 20 },
  privacyLink: { fontSize: 14, lineHeight: 20 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  btnText: { fontSize: 17 },
});
