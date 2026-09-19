import React, { useMemo } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { useBasket } from "@/context/BasketContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  productName: string;
  barcode?: string;
}

interface ChartPoint {
  dateISO: string;
  label: string;
  price: number;
  store: string;
}

const STORE_COLORS: { pattern: RegExp; color: string }[] = [
  { pattern: /مرجان|marjane/i,        color: "#EF4444" },
  { pattern: /بيم|bim/i,              color: "#3B82F6" },
  { pattern: /كارفور|carrefour/i,     color: "#F97316" },
  { pattern: /أسواق|aswa/i,           color: "#8B5CF6" },
  { pattern: /لابيل|labelvie/i,       color: "#EC4899" },
  { pattern: /lidl/i,                  color: "#EAB308" },
  { pattern: /auchan/i,               color: "#14B8A6" },
];
const FALLBACK_COLOR = "#6B7280";

function getStoreColor(store: string): string {
  for (const s of STORE_COLORS) {
    if (s.pattern.test(store)) return s.color;
  }
  return FALLBACK_COLOR;
}

function shortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return dateStr.slice(5, 10);
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 48;

export function PriceTrendModal({ visible, onClose, productName, barcode }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, flexDirection, textAlign, currencySymbol } = useLanguage();
  const { trips } = useBasket();

  const chartPoints = useMemo<ChartPoint[]>(() => {
    const points: ChartPoint[] = [];
    for (const trip of trips) {
      for (const item of trip.items) {
        const matches = barcode
          ? item.barcode === barcode
          : item.name.trim().toLowerCase() === productName.trim().toLowerCase();
        if (matches) {
          points.push({ dateISO: trip.date, label: shortDate(trip.date), price: item.price, store: trip.store });
          break;
        }
      }
    }
    points.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    return points.slice(-10);
  }, [trips, productName, barcode]);

  const storesInData = useMemo(() => {
    const seen = new Set<string>();
    const list: { store: string; color: string }[] = [];
    for (const p of chartPoints) {
      if (!seen.has(p.store)) {
        seen.add(p.store);
        list.push({ store: p.store, color: getStoreColor(p.store) });
      }
    }
    return list;
  }, [chartPoints]);

  const minPrice  = chartPoints.length ? Math.min(...chartPoints.map((p) => p.price)) : 0;
  const maxPrice  = chartPoints.length ? Math.max(...chartPoints.map((p) => p.price)) : 0;
  const priceRange = maxPrice - minPrice;
  const priceTrend =
    chartPoints.length >= 2
      ? chartPoints[chartPoints.length - 1].price - chartPoints[0].price
      : 0;

  const hasEnoughData = chartPoints.length >= 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("close")}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 20,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

        {/* Header */}
        <View style={[styles.header, { flexDirection, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.productName, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign }]} numberOfLines={1}>
              {productName}
            </Text>
            <Text style={[styles.subTitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign }]}>
              {chartPoints.length} {chartPoints.length === 1 ? t("product") : t("products")}
            </Text>
          </View>
          {hasEnoughData && (
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor:
                    priceTrend > 0 ? "rgba(239,68,68,0.1)"
                    : priceTrend < 0 ? "rgba(52,199,89,0.1)"
                    : colors.muted,
                  borderRadius: 20,
                },
              ]}
            >
              <Ionicons
                name={priceTrend > 0 ? "trending-up" : priceTrend < 0 ? "trending-down" : "remove"}
                size={16}
                color={priceTrend > 0 ? "#EF4444" : priceTrend < 0 ? "#34C759" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.trendText,
                  {
                    color: priceTrend > 0 ? "#EF4444" : priceTrend < 0 ? "#34C759" : colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {priceTrend > 0 ? "+" : ""}{priceTrend.toFixed(2)} {currencySymbol}
              </Text>
            </View>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {!hasEnoughData ? (
            <View style={styles.emptyChart}>
              <Ionicons name="stats-chart-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {chartPoints.length === 0 ? "No price history yet" : "Need at least 2 purchases to show a trend"}
              </Text>
              {chartPoints.length === 1 && (
                <View
                  style={[
                    styles.singlePoint,
                    { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.singlePointPrice, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                    {chartPoints[0].price.toFixed(2)} {currencySymbol}
                  </Text>
                  <Text style={[styles.singlePointMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {chartPoints[0].label} · {chartPoints[0].store}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <LineChart
                data={{
                  labels: chartPoints.map((p) => p.label),
                  datasets: [{ data: chartPoints.map((p) => p.price), strokeWidth: 2.5 }],
                }}
                width={CHART_WIDTH}
                height={200}
                getDotColor={() => "transparent"}
                renderDotContent={({ x, y, index }) => {
                  const point = chartPoints[index];
                  if (!point) return null;
                  return (
                    <View
                      key={`dot-${index}`}
                      style={[styles.dot, { left: x - 8, top: y - 8, backgroundColor: getStoreColor(point.store) }]}
                    />
                  );
                }}
                chartConfig={{
                  backgroundColor: "transparent",
                  backgroundGradientFrom: colors.background,
                  backgroundGradientTo: colors.background,
                  decimalPlaces: 2,
                  color: (opacity = 1) => `rgba(0, 168, 107, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                  style: { borderRadius: 12 },
                  propsForDots: { r: "0" },
                  propsForBackgroundLines: { stroke: colors.border, strokeWidth: 1, strokeDasharray: "4" },
                  propsForLabels: { fontFamily: "Inter_400Regular", fontSize: 10 },
                  fillShadowGradientFrom: colors.primary,
                  fillShadowGradientFromOpacity: 0.12,
                  fillShadowGradientTo: colors.background,
                  fillShadowGradientToOpacity: 0,
                }}
                bezier
                style={{ ...styles.chart, borderRadius: 12 }}
                withInnerLines
                withOuterLines={false}
                withVerticalLines={false}
                fromZero={false}
                segments={4}
              />
              {priceRange > 0 && (
                <Text style={[styles.rangeLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {currencySymbol} {minPrice.toFixed(2)} — {maxPrice.toFixed(2)}
                </Text>
              )}
            </View>
          )}

          {/* Legend */}
          {storesInData.length > 0 && (
            <View style={[styles.legendContainer, { borderTopColor: colors.border }]}>
              <Text style={[styles.legendTitle, { color: colors.mutedForeground, fontFamily: "Inter_500Medium", textAlign }]}>
                {t("whereDidYouShop")}
              </Text>
              <View style={[styles.legendItems, { flexDirection }]}>
                {storesInData.map(({ store, color }) => (
                  <View key={store} style={[styles.legendItem, { flexDirection }]}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={[styles.legendText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                      {store}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Purchase list */}
          {chartPoints.length > 0 && (
            <View style={[styles.purchaseList, { borderTopColor: colors.border }]}>
              {[...chartPoints].reverse().map((point, i) => (
                <View
                  key={`${point.dateISO}-${i}`}
                  style={[styles.purchaseRow, { borderBottomColor: colors.border, flexDirection }]}
                >
                  <View style={[styles.purchaseDot, { backgroundColor: getStoreColor(point.store) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.purchaseStore, { color: colors.foreground, fontFamily: "Inter_500Medium", textAlign }]}>
                      {point.store}
                    </Text>
                    <Text style={[styles.purchaseDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign }]}>
                      {point.dateISO}
                    </Text>
                  </View>
                  <Text style={[styles.purchasePrice, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                    {point.price.toFixed(2)} {currencySymbol}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { maxHeight: "88%", paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16, opacity: 0.3 },
  header: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  productName: { fontSize: 18 },
  subTitle: { fontSize: 12, marginTop: 2 },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  trendText: { fontSize: 13 },
  chartContainer: { paddingHorizontal: 16, paddingTop: 16, alignItems: "center" },
  chart: { marginLeft: -8 },
  rangeLabel: { fontSize: 11, marginTop: 4 },
  dot: { position: "absolute", width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, borderColor: "#fff" },
  emptyChart: { padding: 40, alignItems: "center", gap: 16 },
  emptyText: { fontSize: 14, textAlign: "center" },
  singlePoint: { paddingHorizontal: 24, paddingVertical: 16, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, gap: 6, marginTop: 8 },
  singlePointPrice: { fontSize: 28 },
  singlePointMeta: { fontSize: 13 },
  legendContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  legendTitle: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  legendItems: { flexWrap: "wrap", gap: 12 },
  legendItem: { alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 13 },
  purchaseList: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20 },
  purchaseRow: { alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  purchaseDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  purchaseStore: { fontSize: 14 },
  purchaseDate: { fontSize: 12, marginTop: 1 },
  purchasePrice: { fontSize: 15, flexShrink: 0 },
});
