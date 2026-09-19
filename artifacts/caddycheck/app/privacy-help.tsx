import React from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/context/LanguageContext";

const COPY = {
  en: {
    title: "Privacy & help",
    back: "Back",
    status: "How your data is handled",
    localTitle: "Stored on this device",
    local: "Your basket, saved trips, price history, product lookup cache, budget, stores, and preferences are stored locally. No account is required. Exported backups contain saved trips and price history and go only to the destination you choose.",
    barcodeTitle: "Barcode lookup",
    barcode: "When you scan or manually submit a barcode that is not already cached, the barcode is sent to OpenFoodFacts to request a product name, brand, and image. CaddyCheck does not continuously upload your shopping history to OpenFoodFacts.",
    sharingTitle: "Optional live sharing",
    sharing: "Only after you start a live session, CaddyCheck sends the host name you enter, currency, basket product names, prices, quantities, barcodes and image links to the CaddyCheck server. People with the six-character code can view that session and add reminders. Access expires 12 hours after creation or the latest basket update. Expired sessions are deleted during server cleanup; ending the session requests deletion.",
    analyticsTitle: "No analytics toggle",
    analytics: "The app has no arbitrary analytics-data sharing feature or advertising tracker in the reviewed app code. Network requests are made for explicit barcode lookups and optional shared sessions.",
    cameraTitle: "Camera",
    camera: "Camera permission is requested for barcode scanning. CaddyCheck does not record audio or video and does not save camera images.",
    deleteTitle: "Deleting shopping data",
    delete: "Settings → Delete shopping data clears the basket, saved trips, price history, product cache, budget, store history/custom stores, and local shared-session details. It also asks the server to delete an active hosted session when reachable. Language, currency, region, appearance, onboarding, and help-tip preferences remain.",
    helpTitle: "Need help?",
    help: "Barcode lookup needs an internet connection; manual product entry works without lookup. Backup import accepts a CaddyCheck JSON backup up to 5 MB and merges its saved trips and price history. Do not put passwords, payment-card details, or other sensitive text in shared baskets or reminders.",
    draft: "Publisher: Vanitas. Updated 19 September 2026. The public policy and hosting/retention disclosures still require release verification.",
  },
  fr: {
    title: "Confidentialité et aide",
    back: "Retour",
    status: "Traitement de vos données",
    localTitle: "Stockage sur cet appareil",
    local: "Le panier, les courses, l’historique des prix, le cache produits, le budget, les magasins et les préférences sont stockés localement. Aucun compte n’est requis. Une sauvegarde exportée contient les courses et l’historique des prix et va uniquement vers la destination choisie.",
    barcodeTitle: "Recherche de code-barres",
    barcode: "Quand vous scannez ou envoyez manuellement un code absent du cache, il est transmis à OpenFoodFacts pour demander le nom, la marque et l’image. CaddyCheck n’envoie pas continuellement votre historique à OpenFoodFacts.",
    sharingTitle: "Partage en direct facultatif",
    sharing: "Uniquement après le démarrage d’une session, CaddyCheck envoie au serveur le nom saisi, la devise, les noms, prix, quantités, codes-barres et liens d’images du panier. Les personnes ayant le code à six caractères peuvent voir la session et ajouter des rappels. L’accès expire après 12 heures sans mise à jour du panier. Les sessions expirées sont supprimées lors du nettoyage serveur ; terminer la session demande sa suppression.",
    analyticsTitle: "Aucun interrupteur d’analyse",
    analytics: "Le code examiné ne contient ni partage arbitraire de données analytiques ni traqueur publicitaire. Le réseau sert aux recherches de codes-barres demandées et aux sessions facultatives.",
    cameraTitle: "Caméra",
    camera: "L’autorisation sert au scan. CaddyCheck n’enregistre ni audio ni vidéo et ne sauvegarde pas les images de la caméra.",
    deleteTitle: "Suppression des données d’achats",
    delete: "Paramètres → Supprimer les données d’achats efface le panier, les courses, l’historique, le cache, le budget, l’historique/les magasins personnalisés et la session locale. L’app demande aussi la suppression d’une session hébergée active si le serveur est joignable. Langue, devise, région, apparence, accueil et astuces restent.",
    helpTitle: "Besoin d’aide ?",
    help: "La recherche nécessite internet ; la saisie manuelle fonctionne sans recherche. L’import accepte une sauvegarde JSON CaddyCheck de 5 Mo maximum et fusionne les courses et l’historique. Ne partagez jamais mots de passe, cartes bancaires ou textes sensibles.",
    draft: "Éditeur : Vanitas. Mis à jour le 19 septembre 2026. La politique publique et les informations d’hébergement/conservation restent à vérifier avant publication.",
  },
  ar: {
    title: "الخصوصية والمساعدة",
    back: "رجوع",
    status: "كيفية التعامل مع بياناتك",
    localTitle: "التخزين على هذا الجهاز",
    local: "تُحفظ السلة والرحلات وسجل الأسعار وذاكرة المنتجات والميزانية والمتاجر والتفضيلات محليًا. لا يلزم حساب. تحتوي النسخة المصدّرة على الرحلات وسجل الأسعار فقط وتذهب إلى الوجهة التي تختارها.",
    barcodeTitle: "البحث بالباركود",
    barcode: "عند مسح باركود أو إرساله يدويًا ولم يكن مخزنًا، يُرسل الرقم إلى OpenFoodFacts لطلب اسم المنتج وعلامته وصورته. لا يرفع CaddyCheck سجل تسوقك باستمرار إلى OpenFoodFacts.",
    sharingTitle: "المشاركة المباشرة الاختيارية",
    sharing: "بعد بدء جلسة فقط، يرسل CaddyCheck إلى خادمه الاسم الذي أدخلته والعملة وأسماء منتجات السلة وأسعارها وكمياتها وباركوداتها وروابط صورها. من يملك الرمز المكون من ستة أحرف يستطيع مشاهدة الجلسة وإضافة تذكيرات. تنتهي صلاحية الوصول بعد 12 ساعة من إنشائها أو آخر تحديث للسلة. تُحذف الجلسات المنتهية عند تنظيف الخادم، ويطلب إنهاؤها حذفها.",
    analyticsTitle: "لا يوجد مفتاح للتحليلات",
    analytics: "لا توجد في الشفرة التي تمت مراجعتها ميزة مشاركة عشوائية للتحليلات أو متعقب إعلاني. تُستخدم الشبكة للبحث الصريح عن الباركود ولجلسات المشاركة الاختيارية.",
    cameraTitle: "الكاميرا",
    camera: "يُطلب الإذن لمسح الباركود. لا يسجل CaddyCheck الصوت أو الفيديو ولا يحفظ صور الكاميرا.",
    deleteTitle: "حذف بيانات التسوق",
    delete: "الإعدادات ← حذف بيانات التسوق يمسح السلة والرحلات والسجل وذاكرة المنتجات والميزانية وسجل/قائمة المتاجر المخصصة وتفاصيل الجلسة المحلية. ويطلب حذف الجلسة المستضافة النشطة إذا أمكن الوصول للخادم. تبقى اللغة والعملة والمنطقة والمظهر وشاشة البدء وتفضيلات النصائح.",
    helpTitle: "هل تحتاج مساعدة؟",
    help: "يحتاج البحث بالباركود إلى الإنترنت، بينما يعمل الإدخال اليدوي بدونه. يقبل الاستيراد نسخة JSON من CaddyCheck حتى 5 ميغابايت ويدمج الرحلات وسجل الأسعار. لا تضع كلمات مرور أو بيانات بطاقات أو نصوصًا حساسة في السلال أو التذكيرات المشتركة.",
    draft: "الناشر: Vanitas. آخر تحديث: 19 سبتمبر 2026. يبقى التحقق من نشر السياسة وبيانات الاستضافة والاحتفاظ قبل الإصدار.",
  },
} as const;

export default function PrivacyHelpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { language, flexDirection, textAlign } = useLanguage();
  const copy = COPY[language];
  const sections = [
    ["phone-portrait-outline", copy.localTitle, copy.local],
    ["barcode-outline", copy.barcodeTitle, copy.barcode],
    ["people-outline", copy.sharingTitle, copy.sharing],
    ["analytics-outline", copy.analyticsTitle, copy.analytics],
    ["camera-outline", copy.cameraTitle, copy.camera],
    ["trash-outline", copy.deleteTitle, copy.delete],
    ["help-circle-outline", copy.helpTitle, copy.help],
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8, borderBottomColor: colors.border, flexDirection }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          testID="privacy-help-back"
        >
          <Ionicons name={language === "ar" ? "arrow-forward" : "arrow-back"} size={23} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign }]}>{copy.title}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.primary, fontFamily: "Inter_600SemiBold", textAlign }]}>{copy.status}</Text>
        {sections.map(([icon, title, body]) => (
          <View key={title} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.cardTitleRow, { flexDirection }]}>
              <Ionicons name={icon} size={21} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign }]}>{title}</Text>
            </View>
            <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign }]}>{body}</Text>
          </View>
        ))}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, textAlign }]}>
            {language === "ar" ? "الناشر والتواصل" : language === "fr" ? "Éditeur et contact" : "Publisher & contact"}
          </Text>
          <Text selectable style={[styles.body, { color: colors.foreground, textAlign }]}>Vanitas</Text>
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel={language === "ar" ? "التواصل مع Vanitas بالبريد الإلكتروني" : language === "fr" ? "Contacter Vanitas par e-mail" : "Email Vanitas"}
            onPress={() => {
              void Linking.openURL("mailto:yanvanitas@gmail.com?subject=CaddyCheck%20Privacy%20and%20Support").catch(() => {
                Alert.alert(language === "ar" ? "يمكنك مراسلتنا على:" : language === "fr" ? "Écrivez-nous à :" : "You can email us at:", "yanvanitas@gmail.com");
              });
            }}
            style={{ minHeight: 44, justifyContent: "center" }}
            testID="privacy-contact"
          >
            <Text selectable style={[styles.body, { color: colors.primary }]}>yanvanitas@gmail.com</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.notice, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign }]}>{copy.draft}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 22 },
  content: { padding: 16, gap: 12 },
  intro: { fontSize: 15, marginBottom: 2 },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  cardTitleRow: { alignItems: "center", gap: 10 },
  cardTitle: { flex: 1, fontSize: 16 },
  body: { fontSize: 14, lineHeight: 22 },
  notice: { fontSize: 12, lineHeight: 19, padding: 8 },
});