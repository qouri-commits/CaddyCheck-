import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";

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

const DIRHAM_LABELS: Record<Language, string> = {
  ar: "الدرهم المغربي",
  fr: "Dirham marocain",
  en: "Moroccan dirham",
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

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function safeBackupValidationPath(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const message = error.message.replace(/^Invalid backup:\s*/, "");
  const boundary = message.search(/\s(?:must|does|contains|is)\b/);
  if (boundary <= 0) return null;
  const path = message
    .slice(0, boundary)
    .replace(/\["[^"]*"\]/g, "[…]")
    .replace(/[^A-Za-z0-9_.\[\]… -]/g, "");
  return path.startsWith("backup") && path.length <= 120 ? path : null;
}

const SCREEN_COPY = {
  en: {
    privacyHelp: "Privacy & help",
    privacySummary: "Barcode lookups contact OpenFoodFacts only when you scan or enter a barcode. Basket data is sent to CaddyCheck only when you start a live sharing session. CaddyCheck does not have an analytics-sharing switch.",
    deleteShopping: "Delete shopping data",
    deleteDetail: "Deletes the basket, saved trips, price history, product cache, budget, store history/custom stores, and live-session details from this device. Language, currency, region, appearance, onboarding, and help-tip preferences stay.",
    deleteQuestion: "Delete shopping data?",
    invalidBackup: "This is not a valid CaddyCheck backup, or its version is not supported.",
    backupTooLarge: "This backup is larger than 5 MB and cannot be imported.",
    backupReadFailed: "The selected file could not be read. Choose a local JSON backup and try again.",
    exportUnavailable: "Sharing is not available on this device, so the backup could not be exported.",
    validationField: "Problem field",
    validationAdvice: "Export a fresh backup from CaddyCheck and import the JSON file without editing it.",
    basketCurrencyBlocked: "Finish and save or clear the current basket before changing its currency or home region. Existing prices will not be relabeled.",
  },
  fr: {
    privacyHelp: "Confidentialité et aide",
    privacySummary: "Une recherche de code-barres contacte OpenFoodFacts uniquement lorsque vous scannez ou saisissez un code. Le panier est envoyé à CaddyCheck uniquement si vous démarrez une session de partage. Il n’existe pas d’interrupteur de partage analytique.",
    deleteShopping: "Supprimer les données d’achats",
    deleteDetail: "Supprime le panier, les courses, l’historique des prix, le cache, le budget, l’historique/les magasins personnalisés et la session de cet appareil. La langue, la devise, la région, l’apparence, l’accueil et les astuces restent.",
    deleteQuestion: "Supprimer les données d’achats ?",
    invalidBackup: "Ce fichier n’est pas une sauvegarde CaddyCheck valide ou sa version n’est pas prise en charge.",
    backupTooLarge: "Cette sauvegarde dépasse 5 Mo et ne peut pas être importée.",
    backupReadFailed: "Impossible de lire le fichier sélectionné. Choisissez une sauvegarde JSON locale et réessayez.",
    exportUnavailable: "Le partage n’est pas disponible sur cet appareil ; la sauvegarde n’a pas été exportée.",
    validationField: "Champ concerné",
    validationAdvice: "Exportez une nouvelle sauvegarde depuis CaddyCheck, puis importez le fichier JSON sans le modifier.",
    basketCurrencyBlocked: "Terminez et enregistrez ou videz le panier actuel avant de changer sa devise ou votre région. Les prix existants ne seront pas réétiquetés.",
  },
  ar: {
    privacyHelp: "الخصوصية والمساعدة",
    privacySummary: "يتصل البحث عن الباركود بخدمة OpenFoodFacts فقط عند مسح باركود أو إدخاله. ولا تُرسل السلة إلى CaddyCheck إلا عند بدء جلسة مشاركة مباشرة. لا يوجد مفتاح لمشاركة بيانات التحليلات.",
    deleteShopping: "حذف بيانات التسوق",
    deleteDetail: "يحذف السلة والرحلات وسجل الأسعار وذاكرة المنتجات والميزانية وسجل/قائمة المتاجر المخصصة وبيانات الجلسة من هذا الجهاز. تبقى تفضيلات اللغة والعملة والمنطقة والمظهر وشاشة البدء والنصائح.",
    deleteQuestion: "حذف بيانات التسوق؟",
    invalidBackup: "هذا الملف ليس نسخة CaddyCheck صالحة أو أن إصداره غير مدعوم.",
    backupTooLarge: "حجم النسخة أكبر من 5 ميغابايت ولا يمكن استيرادها.",
    backupReadFailed: "تعذرت قراءة الملف المحدد. اختر نسخة JSON محلية وحاول مجددًا.",
    exportUnavailable: "المشاركة غير متاحة على هذا الجهاز، لذلك لم يتم تصدير النسخة.",
    validationField: "الحقل الذي يحتوي على المشكلة",
    validationAdvice: "صدّر نسخة جديدة من CaddyCheck ثم استورد ملف JSON من دون تعديله.",
    basketCurrencyBlocked: "أكمل السلة الحالية واحفظها أو أفرغها قبل تغيير العملة أو المنطقة. لن نغيّر تسمية الأسعار الموجودة تلقائيًا.",
  },
} as const;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    t, language, isRTL, flexDirection, textAlign,
    currency, changeCurrency, theme, changeTheme,
    homeRegionId, homeRegionLabel, changeRegion,
  } = useLanguage();
  const { items, clearAll, exportBackup, importBackup } = useBasket()!;

  const [langSheetVisible,  setLangSheetVisible]  = useState(false);
  const [regionSheetVisible,setRegionSheetVisible]= useState(false);
  const [aboutVisible,      setAboutVisible]       = useState(false);
  const [backupBusy,        setBackupBusy]         = useState(false);
  const backupBusyRef = useRef(false);
  const copy = SCREEN_COPY[language];

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  const requireEmptyBasketForCurrencyChange = () => {
    if (items.length === 0) return true;
    Alert.alert(t("currency_label"), copy.basketCurrencyBlocked);
    return false;
  };

  const beginBackupOperation = () => {
    if (backupBusyRef.current) return false;
    backupBusyRef.current = true;
    setBackupBusy(true);
    return true;
  };

  const endBackupOperation = () => {
    backupBusyRef.current = false;
    setBackupBusy(false);
  };

  const handleExportBackup = async () => {
    if (!beginBackupOperation()) return;
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
          Alert.alert(t("errorTitle"), copy.exportUnavailable);
          return;
        }
      }
      if (Platform.OS === "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {
      Alert.alert(t("errorTitle"), t("backupFailed"));
    } finally {
      endBackupOperation();
    }
  };

  const handleImportBackup = async () => {
    if (!beginBackupOperation()) return;
    let fileWasRead = false;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const asset = result.assets[0];
      let fileSize = asset.size;
      if (fileSize == null) {
        const info = await FileSystem.getInfoAsync(asset.uri);
        fileSize = info.exists && "size" in info ? info.size : undefined;
      }
      if (fileSize != null && fileSize > MAX_BACKUP_BYTES) {
        Alert.alert(t("errorTitle"), copy.backupTooLarge);
        return;
      }
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      fileWasRead = true;
      if (utf8ByteLength(content) > MAX_BACKUP_BYTES) {
        Alert.alert(t("errorTitle"), copy.backupTooLarge);
        return;
      }
      const parsed = JSON.parse(content);
      await importBackup(parsed);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("", t("restoreSuccess"));
    } catch (error) {
      if (!fileWasRead) {
        Alert.alert(t("errorTitle"), copy.backupReadFailed);
      } else {
        const safePath = safeBackupValidationPath(error);
        const detail = safePath ? `\n${copy.validationField}: ${safePath}` : "";
        Alert.alert(t("errorTitle"), `${copy.invalidBackup}\n${copy.validationAdvice}${detail}`);
      }
    } finally {
      endBackupOperation();
    }
  };

  const handleDeleteData = () => {
    Alert.alert(copy.deleteQuestion, copy.deleteDetail, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        style: "destructive",
        onPress: async () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          try {
            await clearAll();
            Alert.alert("", t("dataDeleted"));
          } catch {
            Alert.alert(t("errorTitle"), language === "ar" ? "تعذّر حذف البيانات. حاول مرة أخرى." : language === "fr" ? "Impossible de supprimer les données. Réessayez." : "Could not delete data. Please retry.");
          }
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
    disabled,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
    noBorder?: boolean;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || (!onPress && !rightElement)}
      activeOpacity={onPress ? 0.6 : 1}
      style={[
        styles.settingRow,
        { borderBottomColor: colors.border, flexDirection, borderBottomWidth: noBorder ? 0 : StyleSheet.hairlineWidth },
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={{ disabled: !!disabled }}
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
                const currencyLabel = c.code === "MAD" ? DIRHAM_LABELS[language] : sym;
                return (
                  <TouchableOpacity
                    key={c.code}
                    testID={`currency-${c.code}`}
                    onPress={async () => {
                      if (active) return;
                      if (!requireEmptyBasketForCurrencyChange()) return;
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
                    accessibilityLabel={`${currencyLabel} ${c.code}`}
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
                      {currencyLabel}
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

        <Section title="">
          <View style={[styles.privacySummary, { borderBottomColor: colors.border }]}>
            <View style={[styles.privacySummaryTitle, { flexDirection }]}>
              <View style={[styles.iconBox, { backgroundColor: colors.accent, borderRadius: 8 }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold", flex: 1, textAlign }]}>
                {copy.privacyHelp}
              </Text>
            </View>
            <Text style={[styles.privacySummaryText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign }]}>
              {copy.privacySummary}
            </Text>
          </View>
          <SettingRow icon="shield-outline" label={copy.privacyHelp} onPress={() => router.push("/privacy-help")} />
          <SettingRow icon="information-circle-outline" label={t("about")} onPress={() => setAboutVisible(true)} noBorder />
        </Section>

        {/* Backup & Restore */}
        <Section title={t("backupRestore")}>
          <SettingRow
            icon="cloud-upload-outline"
            label={t("exportBackup")}
            onPress={handleExportBackup}
            rightElement={backupBusy ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
            disabled={backupBusy}
          />
          <SettingRow
            icon="cloud-download-outline"
            label={t("importBackup")}
            onPress={handleImportBackup}
            noBorder
            rightElement={backupBusy ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
            disabled={backupBusy}
          />
        </Section>

        <Section title="">
          <SettingRow icon="trash-outline" label={copy.deleteShopping} onPress={handleDeleteData} destructive noBorder />
        </Section>
      </ScrollView>

      <LanguageSheet visible={langSheetVisible} onClose={() => setLangSheetVisible(false)} />

      <RegionSheet
        visible={regionSheetVisible}
        onClose={() => setRegionSheetVisible(false)}
        selectedRegionId={homeRegionId}
        onSelect={async (region: Region) => {
          if (region.id !== homeRegionId && !requireEmptyBasketForCurrencyChange()) return;
          await changeRegion(region.id);
        }}
      />

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
  privacySummary: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  privacySummaryTitle: { alignItems: "center", gap: 12, marginBottom: 10 },
  privacySummaryText: { fontSize: 13, lineHeight: 20 },
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
