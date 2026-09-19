import React, { useMemo } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { useBasket } from "@/context/BasketContext";

interface StorePrice {
  store: string;
  price: number;
  date: string;
}

interface ComparableProduct {
  key: string;
  name: string;
  imageUrl?: string;
  stores: StorePrice[];
  minPrice: number;
  maxPrice: number;
  savings: number;
}

function StoreRow({
  storePrice,
  isCheapest,
  currencySymbol,
  colors,
  flexDirection,
  textAlign,
  t,
}: {
  storePrice: StorePrice;
  isCheapest: boolean;
  currencySymbol: string;
  colors: ReturnType<typeof useColors>;
  flexDirection: "row" | "row-reverse";
  textAlign: "left" | "right";
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <View
      style={[
        styles.storeRow,
        {
          flexDirection,
          backgroundColor: isCheapest ? "rgba(0,168,107,0.08)" : "transparent",
          borderRadius: 10,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.storeName,
            {
              color: colors.foreground,
              fontFamily: isCheapest ? "Inter_700Bold" : "Inter_500Medium",
              textAlign,
            },
          ]}
          numberOfLines={1}
        >
          {storePrice.store}
        </Text>
        <Text
          style={[
            styles.storeDate,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign },
          ]}
        >
          {storePrice.date}
        </Text>
      </View>
      {isCheapest && (
        <View style={[styles.cheapestBadge, { backgroundColor: colors.primary, borderRadius: 20 }]}>
          <Ionicons name="star" size={11} color="#fff" />
          <Text style={styles.cheapestBadgeText}>{t("cheapestHere")}</Text>
        </View>
      )}
      <Text
        style={[
          styles.storePrice,
          {
            color: isCheapest ? colors.primary : colors.foreground,
            fontFamily: "Inter_700Bold",
          },
        ]}
      >
        {storePrice.price.toFixed(2)} {currencySymbol}
      </Text>
    </View>
  );
}

function ProductCard({ product }: { product: ComparableProduct }) {
  const colors = useColors();
  const { t, flexDirection, textAlign, currencySymbol } = useLanguage();
  const sorted = [...product.stores].sort((a, b) => a.price - b.price);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
      ]}
    >
      <View style={[styles.cardHeader, { flexDirection }]}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.productImg} contentFit="contain" />
        ) : (
          <View style={[styles.productImg, { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="cube-outline" size={22} color={colors.mutedForeground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.productName, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign }]}
            numberOfLines={1}
          >
            {product.name}
          </Text>
          {product.savings > 0 && (
            <Text style={[styles.savingsText, { color: colors.primary, fontFamily: "Inter_500Medium", textAlign }]}>
              {t("potentialSavings")} {product.savings.toFixed(2)} {currencySymbol}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.storeList}>
        {sorted.map((sp, i) => (
          <StoreRow
            key={`${sp.store}-${i}`}
            storePrice={sp}
            isCheapest={i === 0}
            currencySymbol={currencySymbol}
            colors={colors}
            flexDirection={flexDirection}
            textAlign={textAlign}
            t={t}
          />
        ))}
      </View>
    </View>
  );
}

export default function PriceCompareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, flexDirection, textAlign } = useLanguage();
  const { trips } = useBasket();

  const comparableProducts = useMemo<ComparableProduct[]>(() => {
    interface Entry {
      key: string;
      name: string;
      imageUrl?: string;
      byStore: Map<string, StorePrice>;
    }
    const map = new Map<string, Entry>();

    for (const trip of trips) {
      for (const item of trip.items) {
        const key = item.barcode ? `bc:${item.barcode}` : `nm:${item.name.trim().toLowerCase()}`;
        let entry = map.get(key);
        if (!entry) {
          entry = { key, name: item.name, imageUrl: item.imageUrl, byStore: new Map() };
          map.set(key, entry);
        }
        const existing = entry.byStore.get(trip.store);
        if (!existing || existing.date < trip.date) {
          entry.byStore.set(trip.store, { store: trip.store, price: item.price, date: trip.date });
        }
        if (item.imageUrl) entry.imageUrl = item.imageUrl;
      }
    }

    const products: ComparableProduct[] = [];
    for (const entry of map.values()) {
      if (entry.byStore.size < 2) continue;
      const stores = Array.from(entry.byStore.values());
      const prices = stores.map((s) => s.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      products.push({
        key: entry.key,
        name: entry.name,
        imageUrl: entry.imageUrl,
        stores,
        minPrice,
        maxPrice,
        savings: maxPrice - minPrice,
      });
    }

    return products.sort((a, b) => b.savings - a.savings);
  }, [trips]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border, flexDirection }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
        >
          <Ionicons name={flexDirection === "row-reverse" ? "arrow-forward" : "arrow-back"} size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
          {t("priceComparison")}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <FlatList
        data={comparableProducts}
        keyExtractor={(p) => p.key}
        renderItem={({ item }) => <ProductCard product={item} />}
        contentContainerStyle={comparableProducts.length === 0 ? styles.emptyList : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="git-compare-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign }]}>
              {t("noComparableProducts")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
              {t("noComparableProductsSub")}
            </Text>
          </View>
        )}
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
  headerTitle: { flex: 1, fontSize: 18 },
  listContent: { padding: 16, gap: 12 },
  emptyList: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 12, marginHorizontal: 16 },
  cardHeader: { alignItems: "center", gap: 12, marginBottom: 12 },
  productImg: { width: 44, height: 44, borderRadius: 8, flexShrink: 0 },
  productName: { fontSize: 15 },
  savingsText: { fontSize: 12, marginTop: 2 },
  storeList: { gap: 4 },
  storeRow: { alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, gap: 8 },
  storeName: { fontSize: 14 },
  storeDate: { fontSize: 11, marginTop: 1 },
  cheapestBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  cheapestBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  storePrice: { fontSize: 15, flexShrink: 0, minWidth: 70, textAlign: "right" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
});
