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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import {
  CURRENCY_TO_REGIONS,
  DEFAULT_STORES,
  LANG_TO_REGIONS,
  Store,
  StoreRegion,
  getRegionLabel,
} from "@/constants/stores";

const VISITS_KEY  = "store_visits";
const CUSTOM_KEY  = "user_stores";

interface SectionData {
  title: string;
  data: Store[];
  key: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (store: Store) => void;
}

export function StoreSheet({ visible, onClose, onSelect }: Props) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t, isRTL, language, currency } = useLanguage();
  const flexDir  = isRTL ? "row-reverse" : "row";

  const [search,       setSearch]       = useState("");
  const [customStores, setCustomStores] = useState<Store[]>([]);
  const [visits,       setVisits]       = useState<Record<string, number>>({});
  const [customInput,  setCustomInput]  = useState("");
  const [showInput,    setShowInput]    = useState(false);
  const inputRef = useRef<TextInput>(null);

  // ── Load persisted data when sheet opens ─────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setSearch("");
    setCustomInput("");
    setShowInput(false);

    Promise.all([
      AsyncStorage.getItem(VISITS_KEY),
      AsyncStorage.getItem(CUSTOM_KEY),
    ]).then(([visitsRaw, customRaw]) => {
      if (visitsRaw) setVisits(JSON.parse(visitsRaw) as Record<string, number>);
      if (customRaw) setCustomStores(JSON.parse(customRaw) as Store[]);
    });
  }, [visible]);

  // ── Detect user's home regions from currency + language ───────────────────
  const homeRegions = useMemo<StoreRegion[]>(() => {
    const fromCurrency = CURRENCY_TO_REGIONS[currency] ?? [];
    const fromLang     = LANG_TO_REGIONS[language]     ?? [];
    const merged       = [...new Set([...fromCurrency, ...fromLang])];
    return merged;
  }, [currency, language]);

  // ── All stores: custom first, then defaults ────────────────────────────────
  const allStores = useMemo<Store[]>(
    () => [...customStores, ...DEFAULT_STORES],
    [customStores]
  );

  // ── Filtered list when searching ──────────────────────────────────────────
  const searchResults = useMemo<Store[]>(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return allStores.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(q);
      const tagMatch  = s.tags?.some((tag) => tag.toLowerCase().includes(q)) ?? false;
      return nameMatch || tagMatch;
    });
  }, [search, allStores]);

  // ── Sections for the grouped list ─────────────────────────────────────────
  const sections = useMemo<SectionData[]>(() => {
    const visitedNames = Object.entries(visits)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const visitedSet = new Set(visitedNames);
    const homeSet    = new Set(homeRegions);
    const inRegionSet = new Set<string>();

    const result: SectionData[] = [];

    // 1. "Your regulars" — stores the user has visited, sorted by frequency
    if (visitedNames.length > 0) {
      const regularStores = visitedNames
        .map((name) => allStores.find((s) => s.name === name))
        .filter((s): s is Store => s !== undefined)
        .slice(0, 6);
      if (regularStores.length > 0) {
        result.push({ key: "frequent", title: t("frequentStores"), data: regularStores });
      }
    }

    // 2. "In your area" — stores matching home regions (not already in regulars)
    if (homeRegions.length > 0) {
      const areaStores = allStores.filter(
        (s) => homeSet.has(s.region) && !visitedSet.has(s.name)
      );
      if (areaStores.length > 0) {
        areaStores.forEach((s) => inRegionSet.add(s.name));
        result.push({ key: "area", title: t("yourArea"), data: areaStores });
      }
    }

    // 3. Other regions — grouped by region, excluding already shown stores
    const shownNames = new Set([...visitedSet, ...inRegionSet]);
    const regionOrder: StoreRegion[] = ["MA","TN","DZ","SA","AE","EG","FR","BE","GB","US","DE","ES","IT","GLOBAL","CUSTOM"];
    const otherRegions = regionOrder.filter((r) => !homeRegions.includes(r));

    for (const region of otherRegions) {
      const regionStores = allStores.filter(
        (s) => s.region === region && !shownNames.has(s.name)
      );
      if (regionStores.length > 0) {
        result.push({
          key: `region-${region}`,
          title: getRegionLabel(region, t as (key: string) => string),
          data: regionStores,
        });
      }
    }

    return result;
  }, [allStores, visits, homeRegions, t]);

  // ── Handle selection ───────────────────────────────────────────────────────
  const handleSelect = useCallback(
    async (store: Store) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Increment visit count
      const newVisits = { ...visits, [store.name]: (visits[store.name] ?? 0) + 1 };
      setVisits(newVisits);
      await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(newVisits));
      await AsyncStorage.setItem("last_store", JSON.stringify(store));

      onSelect(store);
      onClose();
    },
    [visits, onSelect, onClose]
  );

  // ── Add custom store ───────────────────────────────────────────────────────
  const handleAddCustom = useCallback(async () => {
    const name = customInput.trim();
    if (!name) return;

    const newStore: Store = { name, icon: "storefront-outline", region: "CUSTOM" };
    const updated = [newStore, ...customStores];
    setCustomStores(updated);
    await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
    setCustomInput("");
    setShowInput(false);
    await handleSelect(newStore);
  }, [customInput, customStores, handleSelect]);

  // ── Render a single store row ──────────────────────────────────────────────
  const renderStore = useCallback(
    (store: Store) => {
      const visitCount = visits[store.name] ?? 0;
      return (
        <Pressable
          key={store.name}
          onPress={() => handleSelect(store)}
          testID={`store-option-${store.name}`}
          style={({ pressed }) => [
            styles.storeRow,
            {
              backgroundColor: pressed ? colors.muted : colors.background,
              borderBottomColor: colors.border,
              flexDirection: flexDir,
            },
          ]}
        >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: colors.accent, borderRadius: 8 },
            ]}
          >
            <Ionicons
              name={store.icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={colors.primary}
            />
          </View>
          <Text
            style={[
              styles.storeName,
              {
                color: colors.foreground,
                fontFamily: "Inter_500Medium",
                textAlign: isRTL ? "right" : "left",
              },
            ]}
            numberOfLines={1}
          >
            {store.name}
          </Text>
          {visitCount > 0 && (
            <View
              style={[
                styles.visitBadge,
                { backgroundColor: colors.primary + "20", borderRadius: 20 },
              ]}
            >
              <Ionicons name="checkmark" size={10} color={colors.primary} />
              <Text
                style={[
                  styles.visitCount,
                  { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {visitCount}
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </Pressable>
      );
    },
    [visits, handleSelect, colors, flexDir, isRTL]
  );

  // ── Render section header ──────────────────────────────────────────────────
  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <View
        style={[
          styles.sectionHeader,
          { backgroundColor: colors.muted, flexDirection: flexDir },
        ]}
      >
        {section.key === "frequent" && (
          <Ionicons name="flame-outline" size={12} color={colors.primary} />
        )}
        {section.key === "area" && (
          <Ionicons name="location-outline" size={12} color={colors.primary} />
        )}
        <Text
          style={[
            styles.sectionTitle,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_600SemiBold",
              textAlign: isRTL ? "right" : "left",
            },
          ]}
        >
          {section.title}
        </Text>
      </View>
    ),
    [colors, flexDir, isRTL]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 8,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

        {/* Title */}
        <Text
          style={[
            styles.title,
            {
              color: colors.foreground,
              fontFamily: "Inter_700Bold",
              textAlign: isRTL ? "right" : "left",
            },
          ]}
        >
          {t("whereDidYouShop")}
        </Text>

        {/* Search bar */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.input,
              borderColor: colors.border,
              flexDirection: flexDir,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[
              styles.searchInput,
              {
                color: colors.foreground,
                fontFamily: "Inter_400Regular",
                textAlign: isRTL ? "right" : "left",
              },
            ]}
            placeholder={t("searchStore")}
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Store list or search results */}
        {search.trim() ? (
          /* ── Search results ── */
          <FlatList
            data={searchResults}
            keyExtractor={(s) => s.name}
            renderItem={({ item }) => renderStore(item)}
            ListEmptyComponent={
              <View style={styles.emptySearch}>
                <Ionicons name="search-outline" size={36} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {customInput.length === 0 ? t("searchStore") : ""}
                </Text>
                {/* Suggest adding what they typed */}
                <TouchableOpacity
                  onPress={() => {
                    setCustomInput(search);
                    setSearch("");
                    setShowInput(true);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  style={[styles.addFromSearch, { backgroundColor: colors.primary, borderRadius: 10 }]}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={[styles.addFromSearchTxt, { fontFamily: "Inter_600SemiBold" }]}>
                    {t("add")} "{search}"
                  </Text>
                </TouchableOpacity>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        ) : (
          /* ── Sectioned list ── */
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            renderItem={({ item }) => renderStore(item)}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              <View style={{ paddingBottom: 12 }}>
                {/* Custom store input */}
                {showInput ? (
                  <View
                    style={[
                      styles.customInputRow,
                      { borderTopColor: colors.border, flexDirection: flexDir },
                    ]}
                  >
                    <TextInput
                      ref={inputRef}
                      style={[
                        styles.customInput,
                        {
                          backgroundColor: colors.input,
                          color: colors.foreground,
                          fontFamily: "Inter_400Regular",
                          textAlign: isRTL ? "right" : "left",
                          borderRadius: 10,
                          borderColor: colors.primary,
                        },
                      ]}
                      placeholder={t("typeStoreName")}
                      placeholderTextColor={colors.mutedForeground}
                      value={customInput}
                      onChangeText={setCustomInput}
                      autoFocus
                      onSubmitEditing={handleAddCustom}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={handleAddCustom}
                      style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}
                    >
                      <Text style={[styles.addBtnTxt, { fontFamily: "Inter_600SemiBold" }]}>
                        {t("add")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setShowInput(false); setCustomInput(""); }}
                      style={styles.cancelBtn}
                    >
                      <Ionicons name="close" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setShowInput(true);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    style={[
                      styles.addStoreBtn,
                      {
                        borderTopColor: colors.border,
                        flexDirection: flexDir,
                      },
                    ]}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                    <Text
                      style={[
                        styles.addStoreTxt,
                        { color: colors.primary, fontFamily: "Inter_500Medium" },
                      ]}
                    >
                      {t("addCustomStore")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:     { maxHeight: "85%", paddingTop: 12 },
  handle:    { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14, opacity: 0.3 },
  title:     { fontSize: 20, marginHorizontal: 20, marginBottom: 12, fontWeight: "700" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    gap: 6,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    flex: 1,
  },
  storeRow: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconBox:    { width: 34, height: 34, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  storeName:  { flex: 1, fontSize: 15 },
  visitBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3 },
  visitCount: { fontSize: 11 },
  emptySearch: { paddingVertical: 40, alignItems: "center", gap: 14, paddingHorizontal: 32 },
  emptyText:  { fontSize: 14, textAlign: "center" },
  addFromSearch: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  addFromSearchTxt: { color: "#fff", fontSize: 14 },
  addStoreBtn: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10, alignItems: "center" },
  addStoreTxt: { fontSize: 15 },
  customInputRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  customInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1.5 },
  addBtn:     { paddingHorizontal: 16, paddingVertical: 10 },
  addBtnTxt:  { color: "#fff", fontSize: 14 },
  cancelBtn:  { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
