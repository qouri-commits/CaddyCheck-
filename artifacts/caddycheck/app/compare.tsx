import React, { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { useBasket } from "@/context/BasketContext";
import { StoreSheet } from "@/components/StoreSheet";
import { Store } from "@/constants/stores";
import { Trip, TripItem } from "@/types";

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function shareTripSummary(
  items: { name: string; price: number; quantity: number }[],
  total: number,
  currencySymbol: string
) {
  const lines = items
    .map((i) => `• ${i.name}: ${(i.price * i.quantity).toFixed(2)} ${currencySymbol}`)
    .join("\n");
  const message = `🛒 CaddyCheck\n\n${lines}\n\n💰 Total: ${total.toFixed(2)} ${currencySymbol}`;

  const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);
  if (canOpen) {
    await Linking.openURL(whatsappUrl);
  } else {
    await Share.share({ message });
  }
}

export default function CompareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, flexDirection, textAlign, currencySymbol } = useLanguage();
  const { items, basketTotal, clearBasket, saveTrip, updatePriceHistory } = useBasket();

  const [receiptTotal, setReceiptTotal] = useState("");
  const [storeSheetVisible, setStoreSheetVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedStore, setSavedStore] = useState<Store | null>(null);

  const receiptNum = parseFloat(receiptTotal.replace(",", "."));
  const hasDifference =
    receiptTotal.trim() !== "" && !isNaN(receiptNum) && receiptNum !== basketTotal;
  const diff = hasDifference ? receiptNum - basketTotal : 0;

  const pdfLabels = useMemo(
    () => ({
      product: t("pdfProduct"),
      price: t("pdfPrice"),
      qty: t("pdfQty"),
      subtotal: t("pdfSubtotal"),
      grandTotal: t("pdfGrandTotal"),
    }),
    [t]
  );

  const handleSave = async (store: Store) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA");
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const tripItems: TripItem[] = items.map((item) => ({
      id: item.id,
      barcode: item.barcode,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: parseFloat((item.price * item.quantity).toFixed(2)),
      imageUrl: item.imageUrl,
    }));

    const trip: Trip = {
      id: generateId(),
      date: dateStr,
      time: timeStr,
      store: store.name,
      storeIcon: store.icon,
      total: basketTotal,
      currency: currencySymbol,
      items: tripItems,
    };

    items.forEach((item) => {
      if (item.barcode) {
        updatePriceHistory(item.barcode, {
          lastPrice: item.price,
          lastStore: store.name,
          lastDate: now.toISOString(),
        });
      }
    });

    await saveTrip(trip);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavedStore(store);
    setSaved(true);
  };

  const handleNewTrip = () => {
    clearBasket();
    router.replace("/(tabs)");
  };

  const handleExportPDF = async () => {
    if (Platform.OS === "web") return;
    const direction = isRTL ? "rtl" : "ltr";
    const rows = items
      .map(
        (item) => `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">${item.price.toFixed(2)}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:center">${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`
      )
      .join("");

    const now = new Date();
    const html = `
      <html>
        <head>
          <meta charset="UTF-8"/>
          <style>
            body { font-family: -apple-system, Arial, sans-serif; padding: 24px; direction: ${direction}; }
            h1 { color: #00A86B; font-size: 28px; }
            .meta { color: #6B7280; font-size: 14px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #00A86B; color: white; padding: 10px 8px; text-align: center; font-size: 13px; }
            td { padding: 8px; border-bottom: 1px solid #E5E7EB; font-size: 13px; }
            tr:nth-child(even) { background: #F9FAFB; }
            .total-row td { font-weight: bold; color: #00A86B; background: #ECFDF5; font-size: 15px; }
          </style>
        </head>
        <body>
          <h1>CaddyCheck</h1>
          <div class="meta">${now.toLocaleDateString()}</div>
          <table>
            <thead>
              <tr>
                <th>${pdfLabels.product}</th>
                <th>${pdfLabels.price}</th>
                <th>${pdfLabels.qty}</th>
                <th>${pdfLabels.subtotal}</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="total-row">
                <td colspan="3">${pdfLabels.grandTotal}</td>
                <td>${basketTotal.toFixed(2)} ${currencySymbol}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>`;

    try {
      await Print.printAsync({ html });
    } catch {
      Alert.alert(t("errorTitle"), t("pdfExportFailed"));
    }
  };

  const handleShare = async () => {
    try {
      await shareTripSummary(items, basketTotal, currencySymbol);
    } catch {
      Alert.alert(t("errorTitle"), t("shareFailed"));
    }
  };

  if (saved) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: colors.accent, borderRadius: 50 }]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("savedSuccessfully")}
          </Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            {savedStore?.name ?? ""} · {basketTotal.toFixed(2)} {currencySymbol}
          </Text>

          <TouchableOpacity
            onPress={handleShare}
            style={[styles.shareBtn, { backgroundColor: colors.accent, borderRadius: colors.radius, borderColor: colors.border, borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel={t("shareWhatsApp")}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
            <Text style={[styles.shareBtnText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {t("shareWhatsApp")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNewTrip}
            style={[styles.newTripBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            accessibilityRole="button"
            accessibilityLabel={t("newTrip")}
          >
            <Ionicons name="cart-outline" size={20} color="#fff" />
            <Text style={[styles.newTripBtnText, { fontFamily: "Inter_700Bold" }]}>{t("newTrip")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.archiveBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
            accessibilityRole="button"
            accessibilityLabel={t("archive")}
          >
            <Text style={[styles.archiveBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              {t("archive")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12),
            borderBottomColor: colors.border,
            flexDirection,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
        >
          <Ionicons
            name={isRTL ? "chevron-forward" : "chevron-back"}
            size={28}
            color={colors.foreground}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("compare")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 20,
          gap: 20,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) + 80,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.totalCard, { backgroundColor: colors.primary, borderRadius: colors.radius * 1.5 }]}>
          <Text style={[styles.totalCardLabel, { fontFamily: "Inter_500Medium", textAlign }]}>
            {t("yourTotal")}
          </Text>
          <Text style={[styles.totalCardAmount, { fontFamily: "Inter_700Bold" }]}>
            {basketTotal.toFixed(2)} {currencySymbol}
          </Text>
          <Text style={[styles.totalCardCount, { fontFamily: "Inter_400Regular" }]}>
            {items.length} {t("products")}
          </Text>
        </View>

        <View>
          <Text
            style={[
              styles.inputLabel,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign, marginBottom: 8 },
            ]}
          >
            {t("receiptTotal")}
          </Text>
          <TextInput
            style={[
              styles.receiptInput,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
                borderColor: colors.border,
                borderRadius: colors.radius,
                textAlign: "center",
                fontSize: 28,
              },
            ]}
            value={receiptTotal}
            onChangeText={setReceiptTotal}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
        </View>

        {hasDifference && (
          <View
            style={[
              styles.diffCard,
              {
                backgroundColor: diff > 0 ? "rgba(255,59,48,0.08)" : "rgba(52,199,89,0.08)",
                borderRadius: colors.radius,
                borderLeftWidth: 4,
                borderLeftColor: diff > 0 ? colors.destructive : colors.success,
              },
            ]}
          >
            <Ionicons
              name={diff > 0 ? "warning-outline" : "checkmark-circle-outline"}
              size={24}
              color={diff > 0 ? colors.destructive : colors.success}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.diffLabel,
                  { color: diff > 0 ? colors.destructive : colors.success, fontFamily: "Inter_700Bold", textAlign },
                ]}
              >
                {diff > 0 ? "+" : ""}{diff.toFixed(2)} {currencySymbol}
              </Text>
              <Text style={[styles.diffSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("difference")}
              </Text>
            </View>
          </View>
        )}

        {!hasDifference && receiptTotal.trim() !== "" && !isNaN(receiptNum) && (
          <View
            style={[
              styles.diffCard,
              {
                backgroundColor: "rgba(52,199,89,0.08)",
                borderRadius: colors.radius,
                borderLeftWidth: 4,
                borderLeftColor: colors.success,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={[styles.diffLabel, { color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
              {t("match")}
            </Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => setStoreSheetVisible(true)}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("saveTrip")}
          >
            <Ionicons name="save-outline" size={20} color="#fff" />
            <Text style={[styles.saveBtnText, { fontFamily: "Inter_700Bold" }]}>{t("saveTrip")}</Text>
          </TouchableOpacity>

          <View style={[styles.secondaryButtons, { flexDirection }]}>
            {Platform.OS !== "web" && (
              <TouchableOpacity
                onPress={handleExportPDF}
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, borderWidth: 1, flex: 1 },
                ]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t("savePDF")}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.foreground} />
                <Text style={[styles.secondaryBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {t("savePDF")}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleShare}
              style={[
                styles.secondaryBtn,
                { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border, borderWidth: 1, flex: 1 },
              ]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("share")}
            >
              <Ionicons name="share-social-outline" size={18} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("share")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <StoreSheet
        visible={storeSheetVisible}
        onClose={() => setStoreSheetVisible(false)}
        onSelect={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, textAlign: "center" },
  totalCard: { padding: 24, gap: 4 },
  totalCardLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
  totalCardAmount: { color: "#fff", fontSize: 44, letterSpacing: -1 },
  totalCardCount: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  inputLabel: { fontSize: 15 },
  receiptInput: { paddingVertical: 18, paddingHorizontal: 20, borderWidth: 1 },
  diffCard: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  diffLabel: { fontSize: 20 },
  diffSub: { fontSize: 12 },
  actionButtons: { gap: 12 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  saveBtnText: { color: "#fff", fontSize: 17 },
  secondaryButtons: { gap: 10 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, gap: 8 },
  secondaryBtnText: { fontSize: 15 },
  successContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  successIcon: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 28 },
  successSub: { fontSize: 16, color: "#666" },
  shareBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, gap: 8, width: "100%", justifyContent: "center" },
  shareBtnText: { fontSize: 16 },
  newTripBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 32, paddingVertical: 16, gap: 8, width: "100%", justifyContent: "center" },
  newTripBtnText: { color: "#fff", fontSize: 17 },
  archiveBtn: { paddingHorizontal: 32, paddingVertical: 14, borderWidth: 1, width: "100%", alignItems: "center" },
  archiveBtnText: { fontSize: 15 },
});
