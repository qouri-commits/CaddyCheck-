import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { useBasket } from "@/context/BasketContext";
import { LanguageSheet } from "@/components/LanguageSheet";
import { PriceTrendModal } from "@/components/PriceTrendModal";
import { ShareSessionModal } from "@/components/ShareSessionModal";
import { JoinSessionModal } from "@/components/JoinSessionModal";
import { BasketItem, PriceHistoryEntry } from "@/types";
import { parsePositivePrice, parsePositiveQuantity, normalizeLocalizedDigits } from "@/utils/shoppingReceipt";

const basketFeedback = {
  ar: { invalid: "قيمة غير صالحة", amount: "أدخل مبلغًا صالحًا أكبر من صفر.", quantity: "أدخل كمية صحيحة بين 1 و9999.", storage: "تعذّر حفظ الميزانية. حاول مرة أخرى.", remove: "حذف المنتج", editPrice: "تعديل السعر", editQuantity: "تعديل الكمية" },
  fr: { invalid: "Valeur incorrecte", amount: "Saisissez un montant valide supérieur à zéro.", quantity: "Saisissez une quantité entière entre 1 et 9999.", storage: "Impossible de sauvegarder le budget. Réessayez.", remove: "Supprimer le produit", editPrice: "Modifier le prix", editQuantity: "Modifier la quantité" },
  en: { invalid: "Invalid value", amount: "Enter a valid amount greater than zero.", quantity: "Enter a whole quantity between 1 and 9999.", storage: "Could not save the budget. Please try again.", remove: "Remove product", editPrice: "Edit price", editQuantity: "Edit quantity" },
};

// ─── First-run quick tips overlay ────────────────────────────────────────────
function QuickTipsOverlay({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const colors = useColors();
  const { t, flexDirection, textAlign } = useLanguage();

  const tips: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: "add-circle-outline", text: t("quickTip1") },
    { icon: "people-outline", text: t("quickTip2") },
    { icon: "globe-outline", text: t("quickTip3") },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.tipsOverlay}>
        <View style={[styles.tipsCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
          <Text style={[styles.tipsTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign }]}>
            {t("quickTipsTitle")}
          </Text>
          {tips.map((tip, i) => (
            <View key={i} style={[styles.tipRow, { flexDirection }]}>
              <View style={[styles.tipIconBox, { backgroundColor: colors.accent }]}>
                <Ionicons name={tip.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.tipText, { color: colors.foreground, fontFamily: "Inter_400Regular", textAlign }]}>
                {tip.text}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            onPress={onDismiss}
            style={[styles.tipsBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("gotIt")}
          >
            <Text style={[styles.tipsBtnText, { fontFamily: "Inter_600SemiBold" }]}>{t("gotIt")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function getBudgetColor(ratio: number, colors: ReturnType<typeof useColors>): string {
  if (ratio > 1)    return colors.destructive;
  if (ratio >= 0.8) return colors.warning;
  return colors.success;
}

// ─── Budget alert banner ──────────────────────────────────────────────────────
function BudgetAlertBanner({
  type,
  onDismiss,
}: {
  type: "warning" | "over";
  onDismiss: () => void;
}) {
  const colors = useColors();
  const { t, flexDirection, textAlign } = useLanguage();
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [slideAnim]);

  const bg = type === "over" ? colors.destructive : colors.warning;
  const iconName: keyof typeof Ionicons.glyphMap =
    type === "over" ? "alert-circle" : "warning";

  return (
    <Animated.View
      style={[
        styles.budgetBanner,
        { backgroundColor: bg, flexDirection, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Ionicons name={iconName} size={18} color="#fff" />
      <Text
        style={[
          styles.budgetBannerText,
          { color: "#fff", fontFamily: "Inter_600SemiBold", textAlign },
        ]}
      >
        {type === "over" ? t("budgetOverAlert") : t("budgetWarningAlert")}
      </Text>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t("dismiss")}
      >
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Budget Section ───────────────────────────────────────────────────────────
function BudgetSection({
  total,
  budget,
  onChangeBudget,
}: {
  total: number;
  budget: number | null;
  onChangeBudget: (v: number | null) => void;
}) {
  const colors = useColors();
  const { t, language, flexDirection, textAlign, currencySymbol } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<TextInput>(null);

  const hasBudget = budget !== null && budget > 0;
  const ratio     = hasBudget ? total / budget! : 0;
  const barColor  = getBudgetColor(ratio, colors);
  const barWidth  = Math.min(ratio, 1);
  const isOver    = hasBudget && total > budget!;

  const openEdit = () => {
    setInputValue(hasBudget ? String(budget) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    const val = parsePositivePrice(inputValue);
    if (val !== null && val <= 100000000) {
      onChangeBudget(val);
    } else if (inputValue.trim() === "") {
      onChangeBudget(null);
    } else {
      Alert.alert(basketFeedback[language].invalid, basketFeedback[language].amount);
    }
    setEditing(false);
  };

  return (
    <View style={[styles.budgetWrapper, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={openEdit}
        accessibilityRole="button"
        accessibilityLabel={t("setBudget")}
        testID="edit-budget"
        activeOpacity={0.7}
        style={[styles.budgetRow, { flexDirection }]}
      >
        <View
          style={[
            styles.budgetIconBox,
            {
              backgroundColor: hasBudget
                ? isOver ? "rgba(255,59,48,0.12)" : "rgba(0,168,107,0.1)"
                : colors.muted,
              borderRadius: 8,
            },
          ]}
        >
          <Ionicons
            name="wallet-outline"
            size={16}
            color={hasBudget ? (isOver ? colors.destructive : colors.primary) : colors.mutedForeground}
          />
        </View>

        {editing ? (
          <TextInput
            ref={inputRef}
            style={[
              styles.budgetInput,
              {
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
                borderBottomColor: colors.primary,
                textAlign,
              },
            ]}
            value={inputValue}
            accessibilityLabel={t("budget")}
            testID="budget-input"
            maxLength={16}
            onChangeText={setInputValue}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            onBlur={commitEdit}
            onSubmitEditing={commitEdit}
            returnKeyType="done"
          />
        ) : (
          <Text
            style={[
              styles.budgetLabel,
              {
                color: hasBudget ? (isOver ? colors.destructive : colors.foreground) : colors.mutedForeground,
                fontFamily: hasBudget ? "Inter_600SemiBold" : "Inter_400Regular",
                textAlign,
              },
            ]}
          >
            {hasBudget
              ? `${t("budget")}: ${budget!.toFixed(2)} ${currencySymbol}`
              : t("setBudget")}
          </Text>
        )}

        {hasBudget && !editing && (
          <Text style={[styles.budgetUsed, { color: barColor, fontFamily: "Inter_700Bold" }]}>
            {Math.round(ratio * 100)}%
          </Text>
        )}

        <Ionicons name="pencil-outline" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>

      {hasBudget && (
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(barWidth * 100)}%` as `${number}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

// ─── Trend chip (inline below price row) ─────────────────────────────────────
function TrendChip({
  priceDiff,
  onPress,
}: {
  priceDiff: number | null;
  onPress: () => void;
}) {
  const colors = useColors();

  const isUp   = priceDiff !== null && priceDiff > 0;
  const isDown = priceDiff !== null && priceDiff < 0;
  const isSame = priceDiff !== null && priceDiff === 0;

  const chipBg    = isUp ? "rgba(255,59,48,0.09)" : isDown ? "rgba(52,199,89,0.09)" : colors.muted;
  const chipColor = isUp ? colors.destructive : isDown ? colors.success : colors.mutedForeground;
  const iconName: keyof typeof Ionicons.glyphMap = isUp
    ? "trending-up"
    : isDown
    ? "trending-down"
    : "stats-chart-outline";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.trendChip, { backgroundColor: chipBg, borderRadius: 6 }]}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name={iconName} size={12} color={chipColor} />
      {priceDiff !== null && !isSame && (
        <Text style={[styles.trendChipText, { color: chipColor, fontFamily: "Inter_600SemiBold" }]}>
          {isUp ? "+" : ""}{priceDiff.toFixed(2)}
        </Text>
      )}
      {isSame && (
        <Text style={[styles.trendChipText, { color: chipColor, fontFamily: "Inter_500Medium" }]}>
          =
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Basket item row ──────────────────────────────────────────────────────────
function BasketItemRow({
  item,
  historyEntry,
  hasTripData,
  onDelete,
  onEditPrice,
  onEditQty,
  onTrendTap,
}: {
  item: BasketItem;
  historyEntry?: PriceHistoryEntry;
  hasTripData: boolean;
  onDelete: () => void;
  onEditPrice: (val: string) => void;
  onEditQty: (val: string) => void;
  onTrendTap: () => void;
}) {
  const colors = useColors();
  const { t, language, flexDirection, textAlign, currencySymbol } = useLanguage();
  const [editPrice, setEditPrice] = useState(false);
  const [editQty,   setEditQty]   = useState(false);
  const [localPrice, setLocalPrice] = useState(item.price.toFixed(2));
  const [localQty,   setLocalQty]   = useState(String(item.quantity));

  const subtotal  = item.price * item.quantity;
  const priceDiff = historyEntry != null ? item.price - historyEntry.lastPrice : null;
  const showTrend = hasTripData || historyEntry != null;

  const renderRightActions = () => (
    <TouchableOpacity
      onPress={async () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onDelete();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${basketFeedback[language].remove}: ${item.name}`}
      style={[styles.deleteAction, { backgroundColor: colors.destructive }]}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <View
        style={[
          styles.itemRow,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            flexDirection,
          },
        ]}
      >
        {/* Product image / placeholder */}
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.productImg, { borderRadius: 8 }]}
            contentFit="contain"
          />
        ) : (
          <View
            style={[
              styles.productImg,
              {
                backgroundColor: colors.muted,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            <Ionicons name="cube-outline" size={24} color={colors.mutedForeground} />
          </View>
        )}

        {/* Name + price row + trend */}
        <View
          style={[
            styles.itemInfo,
            {
              marginLeft: flexDirection === "row-reverse" ? 0 : 12,
              marginRight: flexDirection === "row-reverse" ? 12 : 0,
            },
          ]}
        >
          <Text
            style={[
              styles.itemName,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          <View style={[styles.priceRow, { flexDirection }]}>
            {editPrice ? (
              <TextInput
                style={[
                  styles.inlineInput,
                  {
                    color: colors.primary,
                    fontFamily: "Inter_600SemiBold",
                    borderBottomColor: colors.primary,
                    backgroundColor: "transparent",
                  },
                ]}
                value={localPrice}
                accessibilityLabel={`${basketFeedback[language].editPrice}: ${item.name}`}
                maxLength={16}
                onChangeText={setLocalPrice}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                onBlur={() => {
                  const v = parsePositivePrice(localPrice);
                  if (v !== null && v <= 1000000) onEditPrice(String(v));
                  else Alert.alert(basketFeedback[language].invalid, basketFeedback[language].amount);
                  setEditPrice(false);
                }}
              />
            ) : (
              <TouchableOpacity
                onPress={() => { setEditPrice(true); setLocalPrice(item.price.toFixed(2)); }}
                accessibilityRole="button"
                accessibilityLabel={`${basketFeedback[language].editPrice}: ${item.name}`}
                testID={`edit-price-${item.id}`}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={[styles.priceText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  {item.price.toFixed(2)}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.separator, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {` ${t("x")} `}
            </Text>

            {editQty ? (
              <TextInput
                style={[
                  styles.inlineInput,
                  {
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    borderBottomColor: colors.primary,
                    backgroundColor: "transparent",
                    width: 40,
                  },
                ]}
                value={localQty}
                onChangeText={(v) => setLocalQty(normalizeLocalizedDigits(v))}
                accessibilityLabel={`${basketFeedback[language].editQuantity}: ${item.name}`}
                maxLength={4}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                textAlign="center"
                onBlur={() => {
                  const v = parsePositiveQuantity(localQty);
                  if (v !== null) onEditQty(String(v));
                  else Alert.alert(basketFeedback[language].invalid, basketFeedback[language].quantity);
                  setEditQty(false);
                }}
              />
            ) : (
              <TouchableOpacity
                onPress={() => { setEditQty(true); setLocalQty(String(item.quantity)); }}
                accessibilityRole="button"
                accessibilityLabel={`${basketFeedback[language].editQuantity}: ${item.name}`}
                testID={`edit-quantity-${item.id}`}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <View style={[styles.qtyBadge, { backgroundColor: colors.muted, borderRadius: 6 }]}>
                  <Text style={[styles.qtyText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {item.quantity}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <Text style={[styles.separator, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {" = "}
            </Text>
            <Text style={[styles.subtotalText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {subtotal.toFixed(2)}
            </Text>
            <Text style={[styles.currencySmall, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {` ${currencySymbol}`}
            </Text>
          </View>

          {/* Trend chip — shown if item has price history data */}
          {showTrend && (
            <TrendChip priceDiff={priceDiff} onPress={onTrendTap} />
          )}
        </View>

        {/* Chart icon button — always shown if there's trip data */}
        {showTrend && (
          <TouchableOpacity
            onPress={onTrendTap}
            accessibilityRole="button"
            accessibilityLabel={`${t("archive")}: ${item.name}`}
            style={[
              styles.chartBtn,
              {
                backgroundColor: colors.accent,
                borderRadius: 8,
                marginLeft: flexDirection === "row-reverse" ? 12 : 0,
                marginRight: flexDirection === "row-reverse" ? 0 : 12,
              },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="stats-chart-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`${basketFeedback[language].remove}: ${item.name}`}
          testID={`remove-item-${item.id}`}
          style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="trash-outline" size={19} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BasketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, language, isRTL, flexDirection, currencySymbol } = useLanguage();
  const currency = currencySymbol;
  const {
    items,
    trips,
    addItem,
    removeItem,
    updateItemPrice,
    updateItemQuantity,
    basketTotal,
    basketItemCount,
    sessionCode,
    sessionReminders,
    sessionSyncFailed,
    storageError,
    retryPersistence,
  } = useBasket();

  const [langSheetVisible,  setLangSheetVisible]  = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [joinModalVisible,  setJoinModalVisible]  = useState(false);
  const [budget, setBudgetState] = useState<number | null>(null);
  const [trendItem, setTrendItem] = useState<{ name: string; barcode?: string } | null>(null);
  const [budgetAlert, setBudgetAlert] = useState<"warning" | "over" | null>(null);
  const [showQuickTips, setShowQuickTips] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("caddycheck_seen_tips").then((seen) => {
      if (!seen) setShowQuickTips(true);
    }).catch(() => setShowQuickTips(true));
  }, []);

  const dismissQuickTips = () => {
    setShowQuickTips(false);
    void AsyncStorage.setItem("caddycheck_seen_tips", "1").catch(() => {});
  };

  const pendingRemindersCount = sessionReminders.filter((r) => !r.done).length;
  const wasOverRef = useRef(false);
  const wasWarningRef = useRef(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    AsyncStorage.getItem("caddycheck_budget").then((val) => {
      if (active) setBudgetState(val ? parsePositivePrice(val) : null);
    }).catch(() => { if (active) setBudgetState(null); });
    return () => { active = false; };
  }, []));

  const showBanner = (type: "warning" | "over") => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBudgetAlert(type);
    bannerTimerRef.current = setTimeout(() => setBudgetAlert(null), 4000);
  };

  useEffect(() => {
    if (budget === null || budget <= 0) {
      wasOverRef.current = false;
      wasWarningRef.current = false;
      return;
    }
    const ratio = basketTotal / budget;
    const isOver = ratio > 1;
    const isWarning = ratio >= 0.8 && ratio <= 1;

    if (isOver && !wasOverRef.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showBanner("over");
    } else if (isWarning && !wasWarningRef.current && !wasOverRef.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      showBanner("warning");
    }
    wasOverRef.current = isOver;
    wasWarningRef.current = isWarning;
  }, [basketTotal, budget]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const handleSetBudget = async (val: number | null) => {
    try {
      if (val === null) {
        await AsyncStorage.removeItem("caddycheck_budget");
      } else {
        await AsyncStorage.setItem("caddycheck_budget", String(val));
      }
      setBudgetState(val);
    } catch {
      Alert.alert(basketFeedback[language].storage);
    }
  };

  // Build a Set of barcodes/names that appear in any saved trip
  const tripProductKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const trip of trips) {
      if (trip.currency !== currency) continue;
      for (const item of trip.items) {
        if (item.barcode) keys.add(`bc:${item.barcode}`);
        keys.add(`nm:${item.name.trim().toLowerCase()}`);
      }
    }
    return keys;
  }, [trips, currency]);

  const currentCurrencyPrices = useMemo(() => {
    const history: Record<string, PriceHistoryEntry> = {};
    for (const trip of [...trips].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
      if (trip.currency !== currency) continue;
      for (const item of trip.items) {
        if (item.barcode) history[item.barcode] = {
          lastPrice: item.price, lastStore: trip.store, lastDate: trip.date,
        };
      }
    }
    return history;
  }, [trips, currency]);

  // Build a "most frequently bought" quick-add list from trip history
  const frequentItems = useMemo(() => {
    type FreqEntry = {
      key: string;
      name: string;
      barcode?: string;
      imageUrl?: string;
      lastPrice: number;
      count: number;
    };
    const map = new Map<string, FreqEntry>();
    for (const trip of [...trips].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
      if (trip.currency !== currency) continue;
      for (const item of trip.items) {
        const key = item.barcode ? `bc:${item.barcode}` : `nm:${item.name.trim().toLowerCase()}`;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          existing.lastPrice = item.price;
          existing.name = item.name;
          if (item.imageUrl) existing.imageUrl = item.imageUrl;
        } else {
          map.set(key, {
            key,
            name: item.name,
            barcode: item.barcode,
            imageUrl: item.imageUrl,
            lastPrice: item.price,
            count: 1,
          });
        }
      }
    }
    const inBasketKeys = new Set(
      items.map((it) => (it.barcode ? `bc:${it.barcode}` : `nm:${it.name.trim().toLowerCase()}`))
    );
    return Array.from(map.values())
      .filter((e) => e.count >= 2 && !inBasketKeys.has(e.key))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((e) => ({ ...e }));
  }, [trips, items, currency]);

  const handleQuickAdd = async (entry: (typeof frequentItems)[number]) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    addItem({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      barcode: entry.barcode,
      name: entry.name,
      price: entry.lastPrice,
      quantity: 1,
      imageUrl: entry.imageUrl,
    });
  };

  const hasBudget    = budget !== null && budget > 0;
  const isOverBudget = hasBudget && basketTotal > budget!;
  const webTopPad    = Platform.OS === "web" ? 67 : 0;
  const navigationClearance = Platform.OS === "web" ? 84 : insets.bottom + 64;
  const fabBottom = navigationClearance + 16;
  const panelBg      = isOverBudget ? colors.destructive : colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + webTopPad + 8,
            borderBottomColor: colors.border,
            flexDirection,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setLangSheetVisible(true)}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t("language")}
        >
          <Ionicons name="globe-outline" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          CaddyCheck
        </Text>
        {/* Right-side action buttons */}
        <View style={[styles.headerRightGroup, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {/* Eye icon — join a basket (viewer) */}
          <TouchableOpacity
            onPress={() => setJoinModalVisible(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("joinSession")}
          >
            <Ionicons name="eye-outline" size={22} color={colors.foreground} />
          </TouchableOpacity>
          {/* Share icon — share own basket (host) */}
          <TouchableOpacity
            onPress={() => setShareModalVisible(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("shareBasket")}
          >
            <Ionicons
              name="people-outline"
              size={22}
              color={sessionSyncFailed ? colors.destructive : sessionCode ? colors.success : colors.foreground}
            />
            {sessionCode && (
              <View
                style={[
                  styles.liveBadge,
                  { backgroundColor: sessionSyncFailed ? colors.destructive : colors.warning },
                ]}
              >
                {pendingRemindersCount > 0 && !sessionSyncFailed && (
                  <Text style={styles.liveBadgeTxt}>{pendingRemindersCount}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
          {/* Settings */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/settings")}
            style={styles.headerBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("settings")}
          >
            <Ionicons name="settings-outline" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Budget alert banner */}
      {budgetAlert && (
        <BudgetAlertBanner type={budgetAlert} onDismiss={() => setBudgetAlert(null)} />
      )}

      {/* Budget */}
      {storageError && (
        <View accessibilityRole="alert" style={{ padding: 12, backgroundColor: colors.muted }}>
          <Text style={{ color: colors.destructive, textAlign: isRTL ? "right" : "left" }}>
            {language === "ar" ? "تعذّر حفظ بعض البيانات. لا تغلق التطبيق قبل إعادة المحاولة." : language === "fr" ? "Certaines données ne sont pas sauvegardées. Réessayez avant de fermer l’application." : "Some data is not saved. Retry before closing the app."}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => { void retryPersistence(); }} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: colors.primary }}>{language === "ar" ? "إعادة محاولة الحفظ" : language === "fr" ? "Réessayer" : "Retry saving"}</Text>
          </TouchableOpacity>
        </View>
      )}
      <BudgetSection total={basketTotal} budget={budget} onChangeBudget={handleSetBudget} />

      {/* Total panel */}
      <TouchableOpacity
        onPress={() => { if (items.length === 0) return; router.push("/compare"); }}
        accessibilityRole="button"
        accessibilityLabel={t("compare")}
        accessibilityState={{ disabled: items.length === 0 }}
        testID="review-basket"
        activeOpacity={items.length > 0 ? 0.8 : 1}
        style={[styles.totalSection, { backgroundColor: panelBg }]}
      >
        <Text style={[styles.totalLabel, { color: "rgba(255,255,255,0.8)", fontFamily: "Inter_500Medium" }]}>
          {isOverBudget ? t("overBudget") : t("total")}
        </Text>
        <Text style={[styles.totalAmount, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
          {basketTotal.toFixed(2)} {currencySymbol}
        </Text>
        <Text style={[styles.totalCount, { color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" }]}>
          {basketItemCount} {t("products")}
        </Text>
        {items.length > 0 && (
          <View style={[styles.compareHint, { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20 }]}>
            <Ionicons name="git-compare-outline" size={14} color="#fff" />
            <Text style={[styles.compareHintText, { fontFamily: "Inter_500Medium" }]}>
              {t("compare")}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Quick re-add: frequently bought items */}
      {frequentItems.length > 0 && (
        <View style={[styles.frequentSection, { borderBottomColor: colors.border }]}>
          <Text
            style={[
              styles.frequentTitle,
              { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {t("frequentlyBought")}
          </Text>
          <FlatList
            data={frequentItems}
            keyExtractor={(entry) => entry.key}
            horizontal
            inverted={isRTL}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.frequentList}
            renderItem={({ item: entry }) => (
              <TouchableOpacity
                onPress={() => handleQuickAdd(entry)}
                activeOpacity={0.7}
                style={[styles.frequentChip, { backgroundColor: colors.muted, borderRadius: 10 }]}
                accessibilityRole="button"
                accessibilityLabel={`${t("addToBasket")}: ${entry.name}`}
              >
                {entry.imageUrl ? (
                  <Image source={{ uri: entry.imageUrl }} style={styles.frequentImg} contentFit="contain" />
                ) : (
                  <View style={[styles.frequentImg, { alignItems: "center", justifyContent: "center" }]}>
                    <Ionicons name="cube-outline" size={18} color={colors.mutedForeground} />
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  style={[styles.frequentName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}
                >
                  {entry.name}
                </Text>
                <View style={[styles.frequentAddBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="add" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Items */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const historyEntry = item.barcode ? currentCurrencyPrices[item.barcode] : undefined;
          const hasTripData =
            (item.barcode ? tripProductKeys.has(`bc:${item.barcode}`) : false) ||
            tripProductKeys.has(`nm:${item.name.trim().toLowerCase()}`);

          return (
            <BasketItemRow
              item={item}
              historyEntry={historyEntry}
              hasTripData={hasTripData}
              onDelete={() => removeItem(item.id)}
              onEditPrice={(val) => {
                const v = parsePositivePrice(val);
                if (v !== null) updateItemPrice(item.id, v);
              }}
              onEditQty={(val) => {
                const v = parsePositiveQuantity(val);
                if (v !== null) updateItemQuantity(item.id, v);
              }}
              onTrendTap={async () => {
                void Haptics.selectionAsync().catch(() => {});
                setTrendItem({ name: item.name, barcode: item.barcode });
              }}
            />
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {t("emptyBasket")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("emptyBasketSub")}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/scan")}
              testID="empty-basket-scan"
              style={[styles.emptyCta, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("scanFirstProduct")}
            >
              <Ionicons name="barcode-outline" size={18} color="#fff" />
              <Text style={[styles.emptyCtaText, { fontFamily: "Inter_600SemiBold" }]}>
                {t("scanFirstProduct")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={
          items.length === 0
            ? [styles.emptyList, { paddingBottom: navigationClearance + 16 }]
            : { paddingBottom: fabBottom + 64 + 16 }
        }
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
      />

      {/* The empty state already has a scan action; do not overlay a duplicate. */}
      {items.length > 0 && <TouchableOpacity
        onPress={() => router.push("/scan")}
        testID="basket-add-product"
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: fabBottom,
            shadowColor: colors.primary,
          },
        ]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("scanBarcode")}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>}

      <LanguageSheet visible={langSheetVisible} onClose={() => setLangSheetVisible(false)} />

      <QuickTipsOverlay visible={showQuickTips} onDismiss={dismissQuickTips} />

      {/* Price trend modal */}
      {trendItem && (
        <PriceTrendModal
          visible={!!trendItem}
          onClose={() => setTrendItem(null)}
          productName={trendItem.name}
          barcode={trendItem.barcode}
        />
      )}

      {/* Live session — host (share) */}
      <ShareSessionModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
      />

      {/* Live session — viewer (join) */}
      <JoinSessionModal
        visible={joinModalVisible}
        onClose={() => setJoinModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, textAlign: "center" },
  headerRightGroup: { alignItems: "center", gap: 0 },
  liveBadge: {
    position: "absolute", top: 4, right: 4,
    minWidth: 14, height: 14, borderRadius: 7,
    backgroundColor: "#FF9500",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 2,
  },
  liveBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  budgetBanner: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  budgetBannerText: { flex: 1, fontSize: 13 },
  frequentSection: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  frequentTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 8 },
  frequentList: { paddingHorizontal: 16, gap: 8 },
  frequentChip: { width: 96, padding: 8, alignItems: "center", gap: 4 },
  frequentImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.04)" },
  frequentName: { fontSize: 11, textAlign: "center" },
  frequentAddBtn: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  budgetWrapper: { borderBottomWidth: StyleSheet.hairlineWidth },
  budgetRow: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  budgetIconBox: { width: 32, height: 32, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  budgetLabel: { flex: 1, fontSize: 14 },
  budgetInput: { flex: 1, fontSize: 15, borderBottomWidth: 1.5, paddingVertical: 2, paddingHorizontal: 0 },
  budgetUsed: { fontSize: 14, flexShrink: 0 },
  progressTrack: { height: 4, overflow: "hidden" },
  progressFill: { height: "100%" },
  totalSection: { paddingVertical: 20, paddingHorizontal: 24, alignItems: "center", gap: 4 },
  totalLabel: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
  totalAmount: { fontSize: 48, letterSpacing: -1 },
  totalCount: { fontSize: 14 },
  compareHint: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  compareHintText: { color: "#fff", fontSize: 12 },
  itemRow: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  productImg: { width: 50, height: 50, flexShrink: 0 },
  itemInfo: { flex: 1, gap: 6 },
  itemName: { fontSize: 15 },
  priceRow: { alignItems: "center", flexWrap: "wrap", gap: 2 },
  priceText: { fontSize: 15 },
  separator: { fontSize: 14 },
  qtyBadge: { paddingHorizontal: 10, paddingVertical: 2 },
  qtyText: { fontSize: 15 },
  subtotalText: { fontSize: 15 },
  currencySmall: { fontSize: 13 },
  inlineInput: { fontSize: 15, borderBottomWidth: 1.5, minWidth: 50, paddingVertical: 0, paddingHorizontal: 2 },
  trendChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  trendChipText: { fontSize: 11 },
  chartBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  deleteAction: { justifyContent: "center", alignItems: "center", width: 80 },
  emptyContainer: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 24, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 20 },
  emptySubtitle: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  emptyCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", maxWidth: "100%", minHeight: 48, gap: 8, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  emptyCtaText: { color: "#fff", fontSize: 15, flexShrink: 1, textAlign: "center" },
  emptyList: { flexGrow: 1 },
  tipsOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  tipsCard: { width: "100%", maxWidth: 360, padding: 24, gap: 16 },
  tipsTitle: { fontSize: 19, marginBottom: 4 },
  tipRow: { alignItems: "flex-start", gap: 10 },
  tipIconBox: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tipText: { fontSize: 14, flex: 1, lineHeight: 20 },
  tipsBtn: { paddingVertical: 14, alignItems: "center", marginTop: 8 },
  tipsBtnText: { color: "#fff", fontSize: 16 },
  fab: {
    position: "absolute",
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
