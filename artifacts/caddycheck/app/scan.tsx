import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";
import { useBasket } from "@/context/BasketContext";
import { AddProductModal } from "@/components/AddProductModal";
import { isValidGtin, normalizeBarcode } from "@/utils/shoppingReceipt";

interface ScannedProduct {
  barcode?: string;
  name?: string;
  imageUrl?: string;
  brand?: string;
}

function pickProductName(p: Record<string, string | undefined>, lang: string): string | undefined {
  if (lang === "fr") {
    return p.product_name_fr ?? p.product_name_en ?? p.product_name_ar ?? p.product_name ?? p.abbreviated_product_name;
  }
  if (lang === "en") {
    return p.product_name_en ?? p.product_name_fr ?? p.product_name_ar ?? p.product_name ?? p.abbreviated_product_name;
  }
  // Default: Arabic first
  return p.product_name_ar ?? p.product_name_fr ?? p.product_name_en ?? p.product_name ?? p.abbreviated_product_name;
}

async function fetchProductFromOpenFoodFacts(
  barcode: string,
  lang: string,
  externalSignal?: AbortSignal
): Promise<{ product: ScannedProduct; error: "network" | "timeout" | "cancelled" | null }> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
    const response = await fetch(url, {
      headers: { "User-Agent": "CaddyCheck/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenFoodFacts request failed: ${response.status}`);
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product as Record<string, string | undefined>;
      return {
        product: {
          barcode,
          name: pickProductName(p, lang),
          imageUrl: p.image_front_url ?? p.image_url,
          brand: p.brands,
        },
        error: null,
      };
    }
    return { product: { barcode }, error: null };
  } catch {
    const error = timedOut ? "timeout" : externalSignal?.aborted ? "cancelled" : "network";
    return { product: { barcode }, error };
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

const scanMessages = {
  en: {
    invalidBarcode: "Enter a valid EAN/UPC barcode (8, 12, 13, or 14 digits).",
    timeout: "The lookup timed out. You can still enter the product details manually.",
    manualHint: "Enter a barcode to look it up, or add a product without one.",
    search: "Look up barcode",
    settingsError: "Could not open Settings. Open your device settings and allow camera access for CaddyCheck.",
  },
  fr: {
    invalidBarcode: "Saisissez un code EAN/UPC valide (8, 12, 13 ou 14 chiffres).",
    timeout: "La recherche a expiré. Vous pouvez saisir le produit manuellement.",
    manualHint: "Saisissez un code-barres ou ajoutez un produit sans code.",
    search: "Rechercher le code-barres",
    settingsError: "Impossible d’ouvrir les réglages. Autorisez l’appareil photo pour CaddyCheck dans les réglages de l’appareil.",
  },
  ar: {
    invalidBarcode: "أدخل رمز EAN/UPC صالحًا من 8 أو 12 أو 13 أو 14 رقمًا.",
    timeout: "انتهت مهلة البحث. يمكنك إدخال تفاصيل المنتج يدويًا.",
    manualHint: "أدخل رمزًا للبحث، أو أضف منتجًا بدونه.",
    search: "البحث عن الرمز",
    settingsError: "تعذر فتح الإعدادات. افتح إعدادات الجهاز واسمح لـ CaddyCheck باستخدام الكاميرا.",
  },
} as const;

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, flexDirection, textAlign, language } = useLanguage();
  const { getProductCache, saveProductCache } = useBasket();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const lookupControllerRef = useRef<AbortController | null>(null);
  const messages = scanMessages[language];

  useEffect(() => () => lookupControllerRef.current?.abort(), []);

  const handleBarcode = useCallback(
    async (barcode: string) => {
      if (scanned) return;
      const normalized = normalizeBarcode(barcode);
      if (!isValidGtin(normalized)) {
        Alert.alert(t("errorTitle"), messages.invalidBarcode);
        return;
      }
      setScanned(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const cached = getProductCache(normalized);
      if (cached) {
        setIsLoading(false);
        setProduct({ ...(cached as unknown as ScannedProduct), barcode: normalized });
        setModalVisible(true);
        return;
      }

      lookupControllerRef.current?.abort();
      const controller = new AbortController();
      lookupControllerRef.current = controller;
      setIsLoading(true);
      setModalVisible(true);
      setProduct({ barcode: normalized });

      const { product: result, error } = await fetchProductFromOpenFoodFacts(normalized, language, controller.signal);
      if (controller.signal.aborted || lookupControllerRef.current !== controller) return;
      lookupControllerRef.current = null;
      if (!error) {
        saveProductCache(normalized, result as unknown as Record<string, unknown>);
      }
      setProduct(result);
      setIsLoading(false);
      if (error) {
        Alert.alert(t("errorTitle"), error === "timeout" ? messages.timeout : t("networkErrorLookup"));
      }
    },
    [scanned, getProductCache, saveProductCache, t, language, messages]
  );

  const handleCloseModal = () => {
    setModalVisible(false);
    setScanned(false);
    setProduct(null);
    setIsLoading(false);
    setManualBarcode("");
    lookupControllerRef.current?.abort();
    lookupControllerRef.current = null;
  };

  const handleProductAdded = () => {
    router.replace("/");
  };

  const handleManualSearch = async () => {
    if (!manualBarcode.trim()) {
      setProduct({ barcode: undefined });
      setModalVisible(true);
      return;
    }
    await handleBarcode(manualBarcode);
  };

  // Close button position respects RTL
  const closeBtnSide = isRTL ? { right: 16 } : { left: 16 };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: "#000", paddingTop: insets.top + 67 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeBtn, { top: insets.top + 67, ...closeBtnSide }]}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          testID="scan-close"
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.webFallback}>
          <Ionicons name="barcode-outline" size={80} color="rgba(255,255,255,0.4)" />
          <Text style={[styles.webFallbackText, { fontFamily: "Inter_500Medium", textAlign: "center" }]}>
            {t("webScanNotSupported")}
          </Text>
          <Text style={[styles.webFallbackSub, { fontFamily: "Inter_400Regular", textAlign: "center" }]}>
            {t("useManualEntry")}
          </Text>
          <View style={[styles.manualInputRow, { flexDirection }]}>
            <TextInput
              style={[
                styles.manualInput,
                {
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontFamily: "Inter_400Regular",
                  borderRadius: 10,
                  textAlign,
                },
              ]}
              placeholder={t("enterBarcode")}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="number-pad"
              accessibilityLabel={t("enterBarcode")}
              testID="scan-manual-barcode"
            />
            <TouchableOpacity
              onPress={handleManualSearch}
              style={[styles.manualBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}
              accessibilityRole="button"
              accessibilityLabel={messages.search}
              testID="scan-manual-search"
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <AddProductModal visible={modalVisible} onClose={handleCloseModal} onAdded={handleProductAdded} product={product} isLoading={isLoading} />
      </View>
    );
  }

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: "#000" }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <TouchableOpacity
          style={[styles.closeBtnLight, { borderColor: colors.border }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          testID="scan-close"
        >
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.permissionContent}>
          <Ionicons name="camera-outline" size={80} color={colors.mutedForeground} />
          <Text style={[styles.permissionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign: "center" }]}>
            {t("cameraPermission")}
          </Text>
          {permission.canAskAgain && (
            <TouchableOpacity
              onPress={requestPermission}
              style={[styles.permissionBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              accessibilityRole="button"
              accessibilityLabel={t("requestPermission")}
              testID="scan-request-camera"
            >
              <Text style={[styles.permissionBtnText, { fontFamily: "Inter_600SemiBold" }]}>{t("requestPermission")}</Text>
            </TouchableOpacity>
          )}
          {!permission.canAskAgain && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch {
                  Alert.alert(t("errorTitle"), messages.settingsError);
                }
              }}
              style={[styles.settingsBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
              accessibilityRole="button"
              accessibilityLabel={t("openSettings")}
              testID="scan-open-settings"
            >
              <Text style={[styles.settingsBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                {t("openSettings")}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.manualHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {messages.manualHint}
          </Text>
          <View style={[styles.deniedManualRow, { flexDirection }]}>
            <TextInput
              style={[styles.deniedManualInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, textAlign }]}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              placeholder={t("enterBarcode")}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              accessibilityLabel={t("enterBarcode")}
              testID="scan-denied-manual-barcode"
            />
            <TouchableOpacity
              onPress={handleManualSearch}
              style={[styles.deniedSearchBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={messages.search}
              testID="scan-denied-manual-search"
            >
              <Ionicons name="search" size={21} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => { setProduct({ barcode: undefined }); setModalVisible(true); }}
            style={styles.manualAddBtn}
            accessibilityRole="button"
            accessibilityLabel={t("manualAdd")}
            testID="scan-manual-add"
          >
            <Text style={[styles.manualAddText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
              {t("manualAdd")}
            </Text>
          </TouchableOpacity>
        </View>
        <AddProductModal visible={modalVisible} onClose={handleCloseModal} onAdded={handleProductAdded} product={product} isLoading={isLoading} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "qr", "code128", "upc_a", "upc_e"] }}
        onBarcodeScanned={({ data }) => handleBarcode(data)}
      />

      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.closeBtn, { top: insets.top + 16, ...closeBtnSide }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t("close")}
        testID="scan-close"
      >
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>

      <View style={styles.overlay}>
        <View style={[styles.overlayTop, { height: "25%" }]} />
        <View style={styles.overlayMiddle}>
          <View style={[styles.overlaySide, { width: "10%" }]} />
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft,    { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.topRight,   { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.bottomRight,{ borderColor: colors.primary }]} />
          </View>
          <View style={[styles.overlaySide, { width: "10%" }]} />
        </View>
        <View style={[styles.overlayBottom, { flex: 1 }]}>
          <Text style={[styles.scanHint, { fontFamily: "Inter_400Regular" }]}>
            {t("pointCamera")}
          </Text>
          <TouchableOpacity
            onPress={() => { setProduct({ barcode: undefined }); setModalVisible(true); }}
            style={[
              styles.manualEntryBtn,
              { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, borderColor: "rgba(255,255,255,0.3)", borderWidth: 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("manualAdd")}
            testID="scan-manual-add"
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={[styles.manualEntryText, { fontFamily: "Inter_500Medium" }]}>{t("manualAdd")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AddProductModal visible={modalVisible} onClose={handleCloseModal} onAdded={handleProductAdded} product={product} isLoading={isLoading} />
    </View>
  );
}

const OVERLAY_COLOR = "rgba(0,0,0,0.6)";

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: { position: "absolute", zIndex: 10, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeBtnLight: { margin: 16, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderWidth: 1 },
  permissionContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20 },
  permissionTitle: { fontSize: 18, lineHeight: 26 },
  permissionBtn: { paddingHorizontal: 32, paddingVertical: 14, width: "100%", alignItems: "center" },
  permissionBtnText: { color: "#fff", fontSize: 16 },
  settingsBtn: { paddingHorizontal: 32, paddingVertical: 14, width: "100%", alignItems: "center", borderWidth: 1 },
  settingsBtnText: { fontSize: 16 },
  manualAddBtn: { paddingVertical: 12 },
  manualAddText: { fontSize: 15 },
  manualHint: { fontSize: 13, textAlign: "center" },
  deniedManualRow: { width: "100%", alignItems: "center", gap: 8 },
  deniedManualInput: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14 },
  deniedSearchBtn: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  overlayTop: { backgroundColor: OVERLAY_COLOR },
  overlayMiddle: { flexDirection: "row", height: "35%" },
  overlaySide: { backgroundColor: OVERLAY_COLOR },
  scanFrame: { flex: 1, aspectRatio: 1.6 },
  overlayBottom: { backgroundColor: OVERLAY_COLOR, alignItems: "center", justifyContent: "center", gap: 20, paddingTop: 24 },
  corner: { position: "absolute", width: 28, height: 28, borderWidth: 3 },
  topLeft:     { top: 0,    left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  topRight:    { top: 0,    right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 6 },
  bottomLeft:  { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 6 },
  scanHint: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  manualEntryBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  manualEntryText: { color: "#fff", fontSize: 15 },
  webFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  webFallbackText: { color: "rgba(255,255,255,0.8)", fontSize: 18 },
  webFallbackSub: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  manualInputRow: { width: "100%", gap: 10, alignItems: "center", marginTop: 16 },
  manualInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15 },
  manualBtn: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
});
