import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
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
import { useBasket } from "@/context/BasketContext";
import { BasketItem } from "@/types";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { parseLocalizedDecimal, parsePositivePrice, parsePositiveQuantity } from "@/utils/shoppingReceipt";

interface ScannedProduct {
  barcode?: string;
  name?: string;
  imageUrl?: string;
  brand?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdded?: (item: BasketItem) => void;
  product: ScannedProduct | null;
  isLoading?: boolean;
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function AddProductModal({ visible, onClose, onAdded, product, isLoading }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, currencySymbol, language } = useLanguage();
  const { addItem, priceHistory, updatePriceHistory } = useBasket();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [validationError, setValidationError] = useState("");
  const priceInputRef = useRef<TextInput>(null);

  const historyEntry = product?.barcode
    ? priceHistory[product.barcode]
    : null;
  const historyCurrency = (historyEntry as (typeof historyEntry & { currency?: string }) | null)?.currency;
  const comparableHistory = historyCurrency === currencySymbol ? historyEntry : null;
  const parsedPrice = parseLocalizedDecimal(price);

  const priceDiff =
    comparableHistory && parsedPrice !== null && parsedPrice !== comparableHistory.lastPrice
      ? parsedPrice - comparableHistory.lastPrice
      : null;

  useEffect(() => {
    if (visible && product) {
      setName(product.name ?? "");
      setPrice("");
      setQuantity("1");
      setValidationError("");
    }
  }, [visible, product]);

  const handleAdd = async () => {
    if (!name.trim()) {
      setValidationError(t("productNameRequired"));
      return;
    }
    const numPrice = parsePositivePrice(price);
    const numQty = parsePositiveQuantity(quantity);
    if (numPrice === null) {
      setValidationError(t("validPriceRequired"));
      return;
    }
    if (numQty === null) {
      setValidationError({
        en: "Enter a whole quantity from 1 to 9,999.",
        fr: "Saisissez une quantité entière de 1 à 9 999.",
        ar: "أدخل كمية صحيحة من 1 إلى 9999.",
      }[language]);
      return;
    }
    setValidationError("");

    const item: BasketItem = {
      id: generateId(),
      barcode: product?.barcode,
      name: name.trim(),
      price: numPrice,
      quantity: numQty,
      imageUrl: product?.imageUrl,
    };

    // Adding to the basket is the primary action. A secondary history write
    // must never prevent a scanned product from being added.
    addItem(item);
    if (product?.barcode) {
      try {
        updatePriceHistory(product.barcode, {
          lastPrice: numPrice,
          lastStore: {
            ar: "غير محدد",
            fr: "Non renseigné",
            en: "Not specified",
          }[language],
          lastDate: new Date().toISOString(),
          currency: currencySymbol,
        });
      } catch (error) {
        console.error("Could not update scanned product price history", error);
      }
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
    onAdded?.(item);
  };

  const textAlign = isRTL ? "right" : "left";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("close")}
        testID="add-product-dismiss"
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 16,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
        ]}
      >
        <View
          style={[styles.handle, { backgroundColor: colors.mutedForeground }]}
        />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              {t("fetchingProduct")}
            </Text>
          </View>
        ) : (
          <KeyboardAwareScrollViewCompat
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bottomOffset={24}
          >
            {product?.imageUrl && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: product.imageUrl }}
                  style={[
                    styles.productImage,
                    { borderRadius: colors.radius },
                  ]}
                  resizeMode="contain"
                />
              </View>
            )}

            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                  textAlign,
                },
              ]}
            >
              {product?.name ? t("productFound") : t("productNotFound")}
            </Text>

            <View style={[styles.inputGroup, { paddingHorizontal: 20 }]}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign },
                ]}
              >
                {t("productName")}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.input,
                    color: colors.foreground,
                    borderColor: colors.border,
                    borderRadius: 10,
                    fontFamily: "Inter_400Regular",
                    textAlign,
                  },
                ]}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (validationError) setValidationError("");
                }}
                placeholder={t("productName")}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
                onSubmitEditing={() => priceInputRef.current?.focus()}
                accessibilityLabel={t("productName")}
                testID="add-product-name"
              />
            </View>

            <View style={[styles.rowInputs, { paddingHorizontal: 20 }]}>
              <View style={[styles.inputGroup, styles.priceGroup]}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign },
                  ]}
                >
                  {t("shelfPrice")}
                </Text>
                <TextInput
                  ref={priceInputRef}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.input,
                      color: colors.foreground,
                      borderColor: colors.border,
                      borderRadius: 10,
                      fontFamily: "Inter_500Medium",
                      textAlign: "center",
                    },
                  ]}
                  value={price}
                  onChangeText={(value) => {
                    setPrice(value);
                    if (validationError) setValidationError("");
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  onSubmitEditing={handleAdd}
                  returnKeyType="done"
                   accessibilityLabel={t("shelfPrice")}
                   testID="add-product-price"
                />
              </View>
              <View style={[styles.inputGroup, styles.quantityGroup]}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign: "center" },
                  ]}
                >
                  {t("quantity")}
                </Text>
                <View
                  style={[
                    styles.qtyRow,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                      borderRadius: 10,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setQuantity((q) => String(Math.max(1, (parsePositiveQuantity(q) ?? 1) - 1)))
                    }
                    style={styles.qtyBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t("decreaseQuantity")}
                    testID="add-product-quantity-decrease"
                  >
                    <Ionicons name="remove" size={18} color={colors.foreground} />
                  </TouchableOpacity>
                  <TextInput
                    style={[
                      styles.qtyInput,
                      { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                    ]}
                    value={quantity}
                    onChangeText={(v) => {
                      setQuantity(v);
                      if (validationError) setValidationError("");
                    }}
                    keyboardType="number-pad"
                    textAlign="center"
                    selectTextOnFocus
                    accessibilityLabel={t("quantity")}
                    testID="add-product-quantity"
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setQuantity((q) => String(Math.min(9999, (parsePositiveQuantity(q) ?? 0) + 1)))
                    }
                    style={styles.qtyBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t("increaseQuantity")}
                    testID="add-product-quantity-increase"
                  >
                    <Ionicons name="add" size={18} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {priceDiff !== null && priceDiff !== 0 && (
              <View
                style={[
                  styles.alertBox,
                  {
                    backgroundColor:
                      priceDiff > 0
                        ? "rgba(255,59,48,0.08)"
                        : "rgba(52,199,89,0.08)",
                    marginHorizontal: 20,
                    borderRadius: 10,
                    borderLeftWidth: 3,
                    borderLeftColor:
                      priceDiff > 0 ? colors.destructive : colors.success,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.alertText,
                    {
                      color:
                        priceDiff > 0 ? colors.destructive : colors.success,
                      fontFamily: "Inter_600SemiBold",
                      textAlign,
                    },
                  ]}
                >
                  {priceDiff > 0 ? "▲" : "▼"}{" "}
                  {Math.abs(priceDiff).toFixed(2)} {currencySymbol}{" "}
                  {t("priceIncrease")}
                  {historyEntry?.lastStore
                    ? ` ${t("comparedToLast")} ${historyEntry.lastStore}`
                    : ""}
                </Text>
              </View>
            )}

            {comparableHistory && (
              <TouchableOpacity
                onPress={() => setPrice(String(comparableHistory.lastPrice))}
                style={[
                  styles.suggestionChip,
                  {
                    marginHorizontal: 20,
                    backgroundColor: colors.accent,
                    borderRadius: 8,
                    borderColor: colors.accentForeground,
                    borderWidth: 1,
                    flexDirection: isRTL ? "row-reverse" : "row",
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${t("lastPaid")}: ${comparableHistory.lastPrice.toFixed(2)} ${currencySymbol}`}
                testID="add-product-last-price"
              >
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={colors.accentForeground}
                />
                <Text
                  style={[
                    styles.suggestionText,
                    { color: colors.accentForeground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {t("lastPaid")}: {comparableHistory.lastPrice.toFixed(2)}{" "}
                  {currencySymbol}
                </Text>
              </TouchableOpacity>
            )}

            {validationError ? (
              <Text
                style={[
                  styles.validationError,
                  { color: colors.destructive, fontFamily: "Inter_500Medium", textAlign },
                ]}
              >
                {validationError}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={handleAdd}
              disabled={!name.trim() || !price.trim()}
              style={[
                styles.addBtn,
                {
                  backgroundColor:
                    !name.trim() || !price.trim()
                      ? colors.muted
                      : colors.primary,
                  marginHorizontal: 20,
                  borderRadius: 14,
                  marginTop: 16,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("addToBasket")}
              testID="add-product-submit"
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={
                  !name.trim() || !price.trim()
                    ? colors.mutedForeground
                    : "#fff"
                }
              />
              <Text
                style={[
                  styles.addBtnText,
                  {
                    color:
                      !name.trim() || !price.trim()
                        ? colors.mutedForeground
                        : "#fff",
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {t("addToBasket")}
              </Text>
            </TouchableOpacity>
          </KeyboardAwareScrollViewCompat>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
    opacity: 0.3,
  },
  loadingContainer: {
    padding: 48,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  productImage: {
    width: 100,
    height: 100,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  priceGroup: {
    flex: 1.7,
    minWidth: 0,
  },
  quantityGroup: {
    flex: 1.3,
    minWidth: 136,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
  },
  qtyBtn: {
    width: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyInput: {
    flex: 1,
    minWidth: 48,
    fontSize: 18,
    height: "100%",
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  alertBox: {
    padding: 12,
    marginBottom: 10,
  },
  alertText: {
    fontSize: 13,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 13,
  },
  validationError: {
    fontSize: 13,
    marginHorizontal: 20,
    marginTop: 8,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    marginBottom: 8,
  },
  addBtnText: {
    fontSize: 17,
  },
});
