import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Linking,
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

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ShareSessionModal({ visible, onClose }: Props) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t, isRTL, currencySymbol } = useLanguage();
  const flexDir = isRTL ? "row-reverse" : "row";
  const {
    items,
    basketTotal,
    sessionCode,
    sessionHostToken,
    sessionReminders,
    startSession,
    endSession,
    markReminderDone,
  } = useBasket();

  const [creating,    setCreating]    = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [hostName,    setHostName]    = useState("");
  const [nameStep,    setNameStep]    = useState(true);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setNameStep(!sessionCode);
      setCreating(false);
      setCopied(false);
    }
  }, [visible, sessionCode]);

  const handleCreate = async () => {
    const name = hostName.trim() || t("shopper");
    setCreating(true);
    const ok = await startSession(name);
    setCreating(false);
    if (!ok) {
      Alert.alert(t("errorTitle") ?? "", t("sessionCreateFailed") ?? "");
      return;
    }
    setNameStep(false);
  };

  const handleCopy = async () => {
    if (!sessionCode) return;
    Clipboard.setString(sessionCode);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!sessionCode) return;
    const msg = encodeURIComponent(
      `${t("sessionShareMsg")} *${sessionCode}* 🛒\n${t("sessionShareSub")}`
    );
    Linking.openURL(`whatsapp://send?text=${msg}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${msg}`)
    );
  };

  const handleEnd = async () => {
    try {
      await endSession();
      onClose();
    } catch {
      Alert.alert(t("errorTitle"));
    }
  };

  const pendingReminders = sessionReminders.filter((r) => !r.done);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
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
        <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

        {/* Header */}
        <View style={[styles.header, { flexDirection: flexDir, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: isRTL ? "right" : "left" }]}>
              {t("sessionSharing")}
            </Text>
            {sessionCode && (
              <View style={[{ flexDirection: flexDir, alignItems: "center", gap: 6, marginTop: 4 }]}>
                <View style={[styles.liveDot, { backgroundColor: "#34C759" }]} />
                <Text style={[styles.liveText, { color: "#34C759", fontFamily: "Inter_600SemiBold" }]}>
                  {t("sessionActive")}
                </Text>
              </View>
            )}
          </View>
          {sessionCode && (
            <TouchableOpacity
              onPress={handleEnd}
              style={[styles.endBtn, { backgroundColor: "rgba(255,59,48,0.1)", borderRadius: 8 }]}
            >
              <Ionicons name="stop-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.endBtnTxt, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>
                {t("endSession")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Name step */}
        {nameStep && !sessionCode ? (
          <View style={styles.nameStep}>
            <Ionicons name="person-circle-outline" size={56} color={colors.primary} />
            <Text style={[styles.nameTitle, { color: colors.foreground, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
              {t("whoIsShoppingQ")}
            </Text>
            <TextInput
              ref={nameRef}
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.foreground,
                  fontFamily: "Inter_400Regular",
                  textAlign: isRTL ? "right" : "left",
                  borderRadius: 12,
                },
              ]}
              placeholder={t("yourName")}
              placeholderTextColor={colors.mutedForeground}
              value={hostName}
              onChangeText={setHostName}
              autoFocus
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating}
              style={[styles.createBtn, { backgroundColor: colors.primary, borderRadius: 14 }]}
            >
              {creating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Text style={[styles.createBtnTxt, { fontFamily: "Inter_700Bold" }]}>
                    {t("startSharing")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : sessionCode ? (
          <FlatList
            data={[]}
            renderItem={null}
            keyExtractor={() => ""}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {/* Code display */}
                <View style={styles.codeSection}>
                  <Text style={[styles.codeHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
                    {t("sessionInfo")}
                  </Text>
                  <TouchableOpacity onPress={handleCopy} activeOpacity={0.8}>
                    <View style={[styles.codeBox, { backgroundColor: colors.muted, borderRadius: 16, borderColor: colors.primary, borderWidth: 2 }]}>
                      <Text style={[styles.codeText, { color: colors.primary, fontFamily: "Inter_700Bold", letterSpacing: 12 }]}>
                        {sessionCode}
                      </Text>
                      <View style={[styles.copyRow, { flexDirection: flexDir }]}>
                        <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={16} color={copied ? "#34C759" : colors.mutedForeground} />
                        <Text style={[styles.copyTxt, { color: copied ? "#34C759" : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                          {copied ? t("copied") : t("copyCode")}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Share buttons */}
                  <TouchableOpacity
                    onPress={handleWhatsApp}
                    style={[styles.waBtn, { backgroundColor: "#25D366", borderRadius: 14 }]}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                    <Text style={[styles.waBtnTxt, { fontFamily: "Inter_700Bold" }]}>{t("shareViaWhatsApp")}</Text>
                  </TouchableOpacity>
                </View>

                {/* Reminders from family */}
                {pendingReminders.length > 0 && (
                  <View style={[styles.remindersSection, { borderTopColor: colors.border }]}>
                    <View style={[styles.remindersHeader, { flexDirection: flexDir }]}>
                      <Ionicons name="notifications-outline" size={16} color="#FF9500" />
                      <Text style={[styles.remindersTitle, { color: "#FF9500", fontFamily: "Inter_700Bold", flex: 1, textAlign: isRTL ? "right" : "left" }]}>
                        {t("reminders")} ({pendingReminders.length})
                      </Text>
                    </View>
                    {pendingReminders.map((r) => (
                      <View key={r.id} style={[styles.reminderRow, { borderBottomColor: colors.border, flexDirection: flexDir }]}>
                        <Ionicons name="alert-circle-outline" size={18} color="#FF9500" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reminderName, { color: colors.foreground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }]}>
                            {r.name}
                          </Text>
                          {r.addedBy && (
                            <Text style={[styles.reminderBy, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: isRTL ? "right" : "left" }]}>
                              {r.addedBy}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => markReminderDone(r.id)}
                          style={[styles.doneBtn, { backgroundColor: colors.primary + "20", borderRadius: 8 }]}
                        >
                          <Ionicons name="checkmark" size={16} color={colors.primary} />
                          <Text style={[styles.doneTxt, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                            {t("doneReminder")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Current basket */}
                <View style={[styles.basketSection, { borderTopColor: colors.border }]}>
                  <Text style={[styles.basketTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }]}>
                    {t("basket")} — {items.length} {t("products")}
                  </Text>
                  {items.length === 0 && (
                    <Text style={[styles.emptyTxt, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
                      {t("noItemsYet")}
                    </Text>
                  )}
                  {items.map((item) => (
                    <View key={item.id} style={[styles.basketRow, { borderBottomColor: colors.border, flexDirection: flexDir }]}>
                      <Text style={[styles.basketItemName, { color: colors.foreground, fontFamily: "Inter_500Medium", flex: 1, textAlign: isRTL ? "right" : "left" }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.basketItemPrice, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                        {(item.price * item.quantity).toFixed(2)} {currencySymbol}
                      </Text>
                    </View>
                  ))}
                  {items.length > 0 && (
                    <View style={[styles.totalRow, { flexDirection: flexDir, borderTopColor: colors.border }]}>
                      <Text style={[styles.totalLbl, { color: colors.mutedForeground, fontFamily: "Inter_500Medium", flex: 1, textAlign: isRTL ? "right" : "left" }]}>
                        {t("total")}
                      </Text>
                      <Text style={[styles.totalVal, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {basketTotal.toFixed(2)} {currencySymbol}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            }
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:     { maxHeight: "92%", paddingTop: 12 },
  handle:    { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14, opacity: 0.3 },
  header:    { alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  title:     { fontSize: 18 },
  liveDot:   { width: 8, height: 8, borderRadius: 4 },
  liveText:  { fontSize: 12 },
  endBtn:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  endBtnTxt: { fontSize: 12 },
  nameStep:  { padding: 28, alignItems: "center", gap: 16 },
  nameTitle: { fontSize: 20 },
  nameInput: { width: "100%", borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, width: "100%", justifyContent: "center" },
  createBtnTxt: { color: "#fff", fontSize: 16 },
  codeSection: { padding: 24, alignItems: "center", gap: 16 },
  codeHint:  { fontSize: 13, paddingHorizontal: 16 },
  codeBox:   { alignItems: "center", paddingHorizontal: 32, paddingVertical: 20, gap: 10, minWidth: 220 },
  codeText:  { fontSize: 36 },
  copyRow:   { alignItems: "center", gap: 6 },
  copyTxt:   { fontSize: 13 },
  waBtn:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 13, width: "100%" },
  waBtnTxt:  { color: "#fff", fontSize: 15 },
  remindersSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 8 },
  remindersHeader:  { alignItems: "center", gap: 8, marginBottom: 12 },
  remindersTitle:   { fontSize: 14 },
  reminderRow:      { alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  reminderName:     { fontSize: 15 },
  reminderBy:       { fontSize: 12, marginTop: 2 },
  doneBtn:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  doneTxt:          { fontSize: 12 },
  basketSection:    { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 16 },
  basketTitle:      { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  emptyTxt:         { fontSize: 14, paddingVertical: 20 },
  basketRow:        { alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  basketItemName:   { fontSize: 14 },
  basketItemPrice:  { fontSize: 14, flexShrink: 0 },
  totalRow:         { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, marginTop: 4 },
  totalLbl:         { fontSize: 14 },
  totalVal:         { fontSize: 18 },
});
