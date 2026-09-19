import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  Share,
  StyleSheet,
  Text,
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
import { PriceTrendModal } from "@/components/PriceTrendModal";
import { Trip, TripItem } from "@/types";
import { escapeReceiptHtml, summarizeTripsByCurrency } from "@/utils/shoppingReceipt";

interface SelectedProduct {
  name: string;
  barcode?: string;
  currency: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

interface ExportStrings {
  product: string;
  price: string;
  qty: string;
  subtotal: string;
  grandTotal: string;
}

async function exportTripPDF(
  trip: Trip,
  currencyLabel: string,
  isRTL: boolean,
  labels: ExportStrings
) {
  const direction = isRTL ? "rtl" : "ltr";
  const rows = trip.items
    .map(
      (item) => `
    <tr>
       <td>${escapeReceiptHtml(item.name)}</td>
      <td style="text-align:center">${item.price.toFixed(2)}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">${item.subtotal.toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const html = `
    <html>
      <head>
        <meta charset="UTF-8"/>
        <style>
          body { font-family: -apple-system, Arial, sans-serif; padding: 24px; direction: ${direction}; }
          h1 { color: #00A86B; font-size: 28px; margin-bottom: 4px; }
          .meta { color: #6B7280; font-size: 14px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #00A86B; color: white; padding: 10px 8px; text-align: center; font-size: 13px; }
          td { padding: 8px; border-bottom: 1px solid #E5E7EB; font-size: 13px; }
          tr:nth-child(even) { background: #F9FAFB; }
          .total-row td { font-weight: bold; color: #00A86B; font-size: 15px; background: #ECFDF5; }
          .footer { margin-top: 24px; color: #9CA3AF; font-size: 11px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>CaddyCheck</h1>
         <div class="meta">${escapeReceiptHtml(trip.date)} ${escapeReceiptHtml(trip.time)} — ${escapeReceiptHtml(trip.store)}</div>
        <table>
          <thead>
            <tr>
               <th>${escapeReceiptHtml(labels.product)}</th>
               <th>${escapeReceiptHtml(labels.price)}</th>
               <th>${escapeReceiptHtml(labels.qty)}</th>
               <th>${escapeReceiptHtml(labels.subtotal)}</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
               <td colspan="3">${escapeReceiptHtml(labels.grandTotal)}</td>
               <td>${trip.total.toFixed(2)} ${escapeReceiptHtml(currencyLabel)}</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">CaddyCheck — Data by OpenFoodFacts.org</div>
      </body>
    </html>`;

  await Print.printAsync({ html });
}

async function shareTrip(trip: Trip, currencyLabel: string) {
  const lines = trip.items
    .map((item) => `• ${item.name}: ${item.subtotal.toFixed(2)} ${currencyLabel}`)
    .join("\n");
  const message = `🛒 CaddyCheck — ${trip.store}\n📅 ${trip.date}\n\n${lines}\n\n💰 ${trip.total.toFixed(2)} ${currencyLabel}`;

  const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
  const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);
  if (canOpen) {
    await Linking.openURL(whatsappUrl);
  } else {
    await Share.share({ message });
  }
}

function TripRow({
  trip,
  onDelete,
  onExportPDF,
  onShare,
  onItemTap,
}: {
  trip: Trip;
  onDelete: () => void;
  onExportPDF: () => void;
  onShare: () => void;
  onItemTap: (item: TripItem) => void;
}) {
  const colors = useColors();
  const { t, flexDirection, textAlign } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const storeIconName = (trip.storeIcon as keyof typeof Ionicons.glyphMap | undefined) ?? "storefront-outline";

  return (
    <View
      style={[
        styles.tripCard,
        { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        style={[styles.tripHeader, { flexDirection }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${trip.store} · ${trip.total.toFixed(2)} ${trip.currency}`}
        testID={`archive-trip-${trip.id}`}
      >
        <View style={[styles.storeIconBox, { backgroundColor: colors.accent, borderRadius: 10 }]}>
          <Ionicons name={storeIconName} size={20} color={colors.primary} />
        </View>
        <View
          style={[
            styles.tripInfo,
            {
              marginLeft: flexDirection === "row-reverse" ? 0 : 12,
              marginRight: flexDirection === "row-reverse" ? 12 : 0,
            },
          ]}
        >
          <Text style={[styles.storeName, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign }]}>
            {trip.store}
          </Text>
          <Text style={[styles.tripMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign }]}>
            {formatDate(trip.date)} {t("at")} {trip.time} · {trip.items.length} {t("items")}
          </Text>
        </View>
        <View style={styles.tripRight}>
          <Text style={[styles.tripTotal, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
            {trip.total.toFixed(2)} {trip.currency}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
          {trip.items.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => onItemTap(item)}
              activeOpacity={0.65}
              style={[
                styles.itemDetailRow,
                { flexDirection, borderBottomColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.name}
              testID={`archive-item-${item.id}`}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.itemDetailName, { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={[styles.itemDetailSubtotal, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign }]}>
                  {item.price.toFixed(2)} {t("x")} {item.quantity} = {item.subtotal.toFixed(2)} {trip.currency}
                </Text>
              </View>
              <View style={[styles.chartHint, { backgroundColor: colors.accent, borderRadius: 6 }]}>
                <Ionicons name="stats-chart-outline" size={14} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))}

          <View style={[styles.tripActions, { flexDirection }]}>
            <TouchableOpacity
              onPress={onShare}
              style={[styles.actionBtn, { backgroundColor: colors.accent, borderRadius: 8 }]}
              accessibilityRole="button"
              accessibilityLabel={t("share")}
              testID={`archive-share-${trip.id}`}
            >
              <Ionicons name="share-social-outline" size={16} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                {t("share")}
              </Text>
            </TouchableOpacity>
            {Platform.OS !== "web" && (
              <TouchableOpacity
                onPress={onExportPDF}
                style={[styles.actionBtn, { backgroundColor: colors.accent, borderRadius: 8 }]}
                accessibilityRole="button"
                accessibilityLabel={t("exportPDF")}
                testID={`archive-pdf-${trip.id}`}
              >
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                  {t("exportPDF")}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onDelete}
              style={[styles.actionBtn, { backgroundColor: "rgba(255,59,48,0.08)", borderRadius: 8 }]}
              accessibilityRole="button"
              accessibilityLabel={t("delete")}
              testID={`archive-delete-${trip.id}`}
            >
              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
              <Text style={[styles.actionBtnText, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>
                {t("delete")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function StatChip({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[statStyles.chip, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 10 }]}>
      <Text style={[statStyles.val, { color: colors.primary, fontFamily: "Inter_700Bold" }]} numberOfLines={2}>
        {value}
      </Text>
      <Text style={[statStyles.lbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: { flex: 1, alignItems: "center", paddingVertical: 10, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth },
  val: { fontSize: 14 },
  lbl: { fontSize: 10, marginTop: 2 },
});

export default function ArchiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, flexDirection, textAlign, isRTL, currencySymbol } = useLanguage();
  const { trips, deleteTrip } = useBasket();

  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const webTopPad = Platform.OS === "web" ? 67 : 0;

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

  const stats = useMemo(() => {
    if (trips.length === 0) return null;
    const currencySummaries = summarizeTripsByCurrency(trips);
    const storeCounts = trips.reduce<Record<string, number>>((acc, tr) => {
      acc[tr.store] = (acc[tr.store] ?? 0) + 1;
      return acc;
    }, {});
    const topStore =
      Object.entries(storeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      t("noTopStore");
    return {
      totalSpent: currencySummaries.map((summary) => `${summary.total.toFixed(0)} ${summary.currency}`).join(" · "),
      avgPerTrip: currencySummaries.map((summary) => `${summary.average.toFixed(0)} ${summary.currency}`).join(" · "),
      topStore,
    };
  }, [trips, t]);

  const handleDelete = (trip: Trip) => {
    Alert.alert(t("confirmDelete"), t("deleteConfirmMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        style: "destructive",
        onPress: async () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          try {
            await deleteTrip(trip.id);
          } catch {
            Alert.alert(t("errorTitle"));
          }
        },
      },
    ]);
  };

  const handleExportPDF = async (trip: Trip) => {
    try {
      await exportTripPDF(trip, trip.currency || currencySymbol, isRTL, pdfLabels);
    } catch {
      Alert.alert(t("errorTitle"), t("pdfExportFailed"));
    }
  };

  const handleShare = async (trip: Trip) => {
    try {
      await shareTrip(trip, trip.currency || currencySymbol);
    } catch {
      Alert.alert(t("errorTitle"), t("shareFailed"));
    }
  };

  const handleItemTap = async (item: TripItem, currency: string) => {
    await Haptics.selectionAsync();
    setSelectedProduct({ name: item.name, barcode: item.barcode, currency: currency || currencySymbol });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + webTopPad + 8, borderBottomColor: colors.border, flexDirection },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign }]}>
            {t("archive")}
          </Text>
          {trips.length > 0 && (
            <Text style={[styles.headerCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign }]}>
              {trips.length} {t("tripsWord")}
            </Text>
          )}
        </View>
        {trips.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/price-compare")}
            style={[styles.compareBtn, { backgroundColor: colors.accent, borderRadius: 10 }]}
            accessibilityRole="button"
            accessibilityLabel={t("comparePricesAction")}
            testID="archive-price-compare"
          >
            <Ionicons name="git-compare-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripRow
            trip={item}
            onDelete={() => handleDelete(item)}
            onExportPDF={() => handleExportPDF(item)}
            onShare={() => handleShare(item)}
            onItemTap={(tripItem) => handleItemTap(tripItem, item.currency)}
          />
        )}
        ListHeaderComponent={
          stats ? (
            <View style={[styles.statsCard, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <StatChip label={t("totalSpent")} value={stats.totalSpent} colors={colors} />
              <StatChip label={t("avgPerTrip")} value={stats.avgPerTrip} colors={colors} />
              <StatChip label={t("topStore")} value={stats.topStore} colors={colors} />
            </View>
          ) : null
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {t("emptyArchive")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("emptyArchiveSub")}
            </Text>
          </View>
        )}
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          paddingBottom: Platform.OS === "web" ? 84 + 34 : insets.bottom + 80,
          flexGrow: trips.length === 0 ? 1 : undefined,
        }}
        showsVerticalScrollIndicator={false}
      />

      {selectedProduct && (
        <PriceTrendModal
          visible={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          productName={selectedProduct.name}
          barcode={selectedProduct.barcode}
          currency={selectedProduct.currency}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  headerTitle: { fontSize: 28 },
  headerCount: { fontSize: 13 },
  compareBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statsCard: { gap: 8, marginBottom: 4 },
  tripCard: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  tripHeader: { padding: 16, alignItems: "center" },
  storeIconBox: { width: 44, height: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tripInfo: { flex: 1, gap: 2 },
  storeName: { fontSize: 16 },
  tripMeta: { fontSize: 12 },
  tripRight: { alignItems: "flex-end", gap: 2, flexShrink: 0 },
  tripTotal: { fontSize: 16 },
  expandedSection: { borderTopWidth: StyleSheet.hairlineWidth },
  itemDetailRow: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: "center", gap: 12 },
  itemDetailName: { fontSize: 14 },
  itemDetailSubtotal: { fontSize: 12, marginTop: 2 },
  chartHint: { width: 28, height: 28, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tripActions: { padding: 12, gap: 8, flexWrap: "wrap" },
  actionBtn: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  actionBtnText: { fontSize: 13 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  emptyTitle: { fontSize: 20 },
  emptySubtitle: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
});
