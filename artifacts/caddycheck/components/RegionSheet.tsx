import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { CURRENCY_SYMBOLS } from "@/context/LanguageContext";
import { getGroupedRegions, getRegionLabel, Region } from "@/constants/regions";
import type { Language } from "@/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedRegionId: string | null;
  onSelect: (region: Region) => void;
}

export function RegionSheet({ visible, onClose, selectedRegionId, onSelect }: Props) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const flexDir = isRTL ? "row-reverse" : "row";

  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  const sections = useMemo(
    () => getGroupedRegions(query, language as Language),
    [query, language]
  );

  const handleSelect = useCallback(async (region: Region) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(region);
    onClose();
  }, [onSelect, onClose]);

  const renderItem = useCallback(({ item }: { item: Region }) => {
    const isSelected = item.id === selectedRegionId;
    const cityLabel = language === "ar" ? item.cityAr : language === "fr" ? item.cityFr : item.city;
    const currSym   = CURRENCY_SYMBOLS[item.currency] ?? item.currency;

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item)}
        activeOpacity={0.6}
        style={[
          styles.regionRow,
          {
            flexDirection: flexDir,
            borderBottomColor: colors.border,
            backgroundColor: isSelected ? colors.primary + "12" : "transparent",
          },
        ]}
      >
        <Text style={styles.cityFlag}>{item.flag}</Text>
        <Text
          style={[
            styles.cityName,
            {
              color: isSelected ? colors.primary : colors.foreground,
              fontFamily: isSelected ? "Inter_700Bold" : "Inter_500Medium",
              flex: 1,
              textAlign: isRTL ? "right" : "left",
              marginLeft:  isRTL ? 0 : 10,
              marginRight: isRTL ? 10 : 0,
            },
          ]}
        >
          {cityLabel}
        </Text>
        <View style={[styles.currencyTag, { backgroundColor: isSelected ? colors.primary : colors.muted, borderRadius: 6 }]}>
          <Text style={[styles.currencyCode, { color: isSelected ? "#fff" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            {item.currency}
          </Text>
          <Text style={[styles.currencySym, { color: isSelected ? "rgba(255,255,255,0.8)" : colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {currSym}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }} />
        )}
      </TouchableOpacity>
    );
  }, [selectedRegionId, language, isRTL, colors, flexDir, handleSelect]);

  const renderSectionHeader = useCallback(({ section }: { section: { label: string; flag: string } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.muted }]}>
      <Text style={[styles.sectionHeaderText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }]}>
        {section.flag}  {section.label}
      </Text>
    </View>
  ), [colors, isRTL]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

        {/* Header */}
        <View style={[styles.sheetHeader, { flexDirection: flexDir, borderBottomColor: colors.border }]}>
          <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left" }]}>
            {t("selectRegion")}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchRow, { flexDirection: flexDir, borderBottomColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[
              styles.searchInput,
              {
                color: colors.foreground,
                fontFamily: "Inter_400Regular",
                textAlign: isRTL ? "right" : "left",
                flex: 1,
              },
            ]}
            placeholder={t("searchCity")}
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {sections.length === 0 ? (
          <View style={styles.emptyView}>
            <Ionicons name="location-outline" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("noResults")}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections.map((s) => ({ ...s, data: s.regions }))}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:            { maxHeight: "88%", paddingTop: 12 },
  handle:           { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14, opacity: 0.3 },
  sheetHeader:      { alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  sheetTitle:       { fontSize: 18 },
  searchRow:        { alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput:      { fontSize: 15, padding: 0 },
  sectionHeader:    { paddingHorizontal: 16, paddingVertical: 6 },
  sectionHeaderText:{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  regionRow:        { alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  cityFlag:         { fontSize: 22, flexShrink: 0 },
  cityName:         { fontSize: 15 },
  currencyTag:      { paddingHorizontal: 8, paddingVertical: 4, alignItems: "center", flexShrink: 0 },
  currencyCode:     { fontSize: 12 },
  currencySym:      { fontSize: 10, marginTop: 1 },
  emptyView:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyText:        { fontSize: 14 },
});
