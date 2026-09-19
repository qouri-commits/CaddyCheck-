import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { useColors } from "@/hooks/useColors";
import { useLanguage, Theme, CURRENCY_SYMBOLS } from "@/context/LanguageContext";
import { useBasket } from "@/context/BasketContext";
import { LanguageSheet } from "@/components/LanguageSheet";
import { RegionSheet } from "@/components/RegionSheet";
import { Language } from "@/types";
import type { Region } from "@/constants/regions";

const LANG_LABELS: Record<Language, string> = {
  ar: "العربية",
  fr: "Français",
  en: "English",
};

const CURRENCIES: { code: string; label: string }[] = [
  { code: "MAD", label: "MAD" },
  { code: "TND", label: "TND" },
  { code: "DZD", label: "DZD" },
  { code: "EGP", label: "EGP" },
  { code: "SAR", label: "SAR" },
  { code: "AED", label: "AED" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "USD", label: "USD" },
];

const THEMES: { mode: Theme; labelKey: "lightMode" | "darkMode" | "themeSystem"; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: "light", labelKey: "lightMode", icon: "sunny-outline" },
  { mode: "dark",  labelKey: "darkMode",  icon: "moon-outline" },
  { mode: "system",labelKey: "themeSystem",icon: "phone-portrait-outline" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    t, language, isRTL, flexDirection, textAlign,
    currency, changeCurrency, theme, changeTheme,
    homeRegionId, homeRegionLabel, changeRegion,
  } = useLanguage();
  const { clearAll, exportBackup, importBackup } = useBasket();

  const [dataSharing,       setDataSharing]       = useState(true);
  const [langSheetVisible,  setLangSheetVisible]  = useState(false);
  const [regionSheetVisible,setRegionSheetVisible]= useState(false);
  const [privacyVisible,    setPrivacyVisible]     = useState(false);
  const [aboutVisible,      setAboutVisible]       = useState(false);
  const [backupBusy,        setBackupBusy]         = useState(false);

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  // Load persisted dataSharing preference
  useEffect(() => {
    AsyncStorage.getItem("caddycheck_data_sharing").then((v) => {
      if (v !== null) setDataSharing(v === "true");
    });
  }, []);

  const handleToggleDataSharing = async (val: boolean) => {
    await Haptics.selectionAsync();
    setDataSharing(val);
    await AsyncStorage.setItem("caddycheck_data_sharing", String(val));
  };

  const handleExportBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const data = await exportBackup();
      const json = JSON.stringify(data, null, 2);
      const fileName = `caddycheck_backup_${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/json",
            dialogTitle: t("exportBackup"),
          });
        } else {
          Alert.alert(t("errorTitle"), t("backupFailed"));
        }
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t("errorTitle"), t("backupFailed"));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        setBackupBusy(false);
        return;
      }
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = JSON.parse(content);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("invalid");
      }
      await importBackup(parsed);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("", t("restoreSuccess"));
    } catch {
      Alert.alert(t("errorTitle"), t("restoreFailed"));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDeleteData = () => {
    Alert.alert(t("confirmDelete"), t("deleteAllData"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await clearAll();
          Alert.alert("", t("dataDeleted"));
        },
      },
    ]);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      {title ? (
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium", textAlign },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
        ]}
      >
        {children}
      </View>
    </View>
  );

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
    rightElement,
    destructive,
    noBorder,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
    noBorder?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.6 : 1}
      style={[
        styles.settingRow,
        { borderBottomColor: colors.border, flexDirection, borderBottomWidth: noBorder ? 0 : StyleSheet.hairlineWidth },
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: destructive ? "rgba(255,59,48,0.1)" : colors.accent,
            borderRadius: 8,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? colors.destructive : colors.primary}
        />
      </View>
      <Text
        style={[
          styles.settingLabel,
          {
            color: destructive ? colors.destructive : colors.foreground,
            fontFamily: "Inter_500Medium",
            flex: 1,
            marginLeft: flexDirection === "row-reverse" ? 0 : 12,
            marginRight: flexDirection === "row-reverse" ? 12 : 0,
            textAlign,
          },
        ]}
      >
        {label}
      </Text>
      {rightElement ? (
        rightElement
      ) : value ? (
        <Text style={[styles.settingValue, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {value}
        </Text>
      ) : onPress ? (
        <Ionicons
          name={isRTL ? "chevron-back" : "chevron-forward"}
          size={18}
          color={colors.mutedForeground}
        />
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + webTopPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign }]}>
          {t("settings")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 84 + 34 : insets.bottom + 80,
        }}
      >
        {/* Language, Region & Currency */}
        <Section title={t("language")}>
          <SettingRow
            icon="globe-outline"
            label={t("language")}
            value={LANG_LABELS[language]}
            onPress={() => setLangSheetVisible(true)}
          />
          <SettingRow
            icon="location-outline"
            label={t("homeRegion")}
            value={homeRegionLabel || t("noRegionSet")}
            onPress={() => setRegionSheetVisible(true)}
          />
          {/* Currency picker */}
          <View style={[styles.currencySection, { borderBottomColor: colors.border }]}>
            <View style={[styles.currencyTopRow, { flexDirection }]}>
              <View style={[styles.iconBox, { backgroundColor: colors.accent, borderRadius: 8 }]}>
                <Ionicons name="cash-outline" size={18} color={colors.primary} />
              </View>
              <Text
                style={[
                  styles.settingLabel,
                  {
                    color: colors.foreground,
                    fontFamily: "Inter_500Medium",
                    flex: 1,
                    marginLeft: flexDirection === "row-reverse" ? 0 : 12,
                    marginRight: flexDirection === "row-reverse" ? 12 : 0,
                    textAlign,
                  },
                ]}
              >
                {t("currency_label")}
              </Text>
            </View>
            <View style={styles.currencyGrid}>
              {CURRENCIES.map((c) => {
                const active = currency === c.code;
                const sym = CURRENCY_SYMBOLS[c.code] ?? c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    onPress={async () => {
                      if (active) return;
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      await changeCurrency(c.code);
                    }}
                    style={[
                      styles.currencyChip,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderRadius: 10,
                        borderWidth: active ? 0 : 1,
                        borderColor: colors.border,
                      },
                    ]}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${sym} ${c.code}`}
                  >
                    <Text
                      style={[
                        styles.currencyChipCode,
                        {
                          color: active ? "#fff" : colors.foreground,
                          fontFamily: active ? "Inter_700Bold" : "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {c.code}
                    </Text>
                    <Text
                      style={[
                        styles.currencyChipSym,
                        {
                          color: active ? "rgba(255,255,255,0.8)" : colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {sym}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>

        {/* Appearance / Dark Mode */}
        <Section title={t("appearance")}>
          <View style={[styles.themeSection, { paddingHorizontal: 16, paddingVertical: 14 }]}>
            <View style={[{ flexDirection }, styles.themeTopRow]}>
              <View style={[styles.iconBox, { backgroundColor: colors.accent, borderRadius: 8 }]}>
                <Ionicons name="contrast-outline" size={18} color={colors.primary} />
              </View>
              <Text
                style={[
                  styles.settingLabel,
                  {
                    color: colors.foreground,
                    fontFamily: "Inter_500Medium",
                    flex: 1,
                    marginLeft: flexDirection === "row-reverse" ? 0 : 12,
                    marginRight: flexDirection === "row-reverse" ? 12 : 0,
                    textAlign,
                  },
                ]}
              >
                {t("appearance")}
              </Text>
            </View>
            <View style={[styles.themeChips, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {THEMES.map(({ mode, labelKey, icon }) => {
                const active = theme === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      await changeTheme(mode);
                    }}
                    style={[
                      styles.themeChip,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderRadius: 10,
                        borderWidth: active ? 0 : 1,
                        borderColor: colors.border,
                        flex: 1,
                      },
                    ]}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(labelKey)}
                  >
                    <Ionicons name={icon} size={16} color={active ? "#fff" : colors.mutedForeground} />
                    <Text
                      style={[
                        styles.themeChipLabel,
                        {
                          color: active ? "#fff" : colors.foreground,
                          fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                        },
                      ]}
                    >
                      {t(labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>

        {/* Privacy */}
        <Section title="">
          <SettingRow
            icon="analytics-outline"
            label={t("dataSharing")}
            rightElement={
              <Switch
                value={dataSharing}
                onValueChange={handleToggleDataSharing}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        <Section title="">
          <SettingRow icon="shield-outline" label={t("privacyPolicy")} onPress={() => setPrivacyVisible(true)} />
          <SettingRow icon="information-circle-outline" label={t("about")} onPress={() => setAboutVisible(true)} noBorder />
        </Section>

        {/* Backup & Restore */}
        <Section title={t("backupRestore")}>
          <SettingRow
            icon="cloud-upload-outline"
            label={t("exportBackup")}
            onPress={handleExportBackup}
            rightElement={backupBusy ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          />
          <SettingRow
            icon="cloud-download-outline"
            label={t("importBackup")}
            onPress={handleImportBackup}
            noBorder
            rightElement={backupBusy ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          />
        </Section>

        <Section title="">
          <SettingRow icon="trash-outline" label={t("deleteAllData")} onPress={handleDeleteData} destructive noBorder />
        </Section>
      </ScrollView>

      <LanguageSheet visible={langSheetVisible} onClose={() => setLangSheetVisible(false)} />

      <RegionSheet
        visible={regionSheetVisible}
        onClose={() => setRegionSheetVisible(false)}
        selectedRegionId={homeRegionId}
        onSelect={async (region: Region) => {
          await changeRegion(region.id);
        }}
      />

      {/* Privacy modal */}
      <Modal
        visible={privacyVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPrivacyVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, flexDirection }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("privacyPolicy")}
            </Text>
            <TouchableOpacity onPress={() => setPrivacyVisible(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text
              style={[
                styles.modalText,
                { color: colors.foreground, fontFamily: "Inter_400Regular", textAlign, lineHeight: 24 },
              ]}
            >
              {t("privacyText")}
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* About modal */}
      <Modal
        visible={aboutVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAboutVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, flexDirection }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("about")}
            </Text>
            <TouchableOpacity onPress={() => setAboutVisible(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={[styles.aboutContent, { alignItems: "center" }]}>
            <View style={[styles.aboutIcon, { backgroundColor: colors.accent, borderRadius: 20 }]}>
              <Ionicons name="cart-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.aboutAppName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              CaddyCheck
            </Text>
            <Text
              style={[
                styles.aboutText,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" },
              ]}
            >
              {t("aboutText")}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 28 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 },
  sectionCard: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  settingRow: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  iconBox: { width: 34, height: 34, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  settingLabel: { fontSize: 15 },
  settingValue: { fontSize: 14 },
  currencySection: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 0 },
  currencyTopRow: { alignItems: "center", marginBottom: 12 },
  currencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  currencyChip: { paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", minWidth: 68 },
  currencyChipCode: { fontSize: 13 },
  currencyChipSym: { fontSize: 11, marginTop: 2 },
  themeSection: {},
  themeTopRow: { alignItems: "center", marginBottom: 12 },
  themeChips: { gap: 8 },
  themeChip: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6 },
  themeChipLabel: { fontSize: 12 },
  modalContainer: { flex: 1 },
  modalHeader: { alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: 56 },
  modalTitle: { fontSize: 20 },
  modalContent: { padding: 20 },
  modalText: { fontSize: 15 },
  aboutContent: { padding: 40, gap: 16 },
  aboutIcon: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  aboutAppName: { fontSize: 28 },
  aboutText: { fontSize: 14, lineHeight: 22 },
});
