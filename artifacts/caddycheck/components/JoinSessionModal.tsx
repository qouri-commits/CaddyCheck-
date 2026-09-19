import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { API_BASE } from "@/constants/api";

interface SessionBasketItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
}

interface SessionReminder {
  id: string;
  name: string;
  addedBy?: string;
  addedAt: string;
  done: boolean;
}

interface SessionData {
  code: string;
  hostName: string;
  basket: SessionBasketItem[];
  reminders: SessionReminder[];
  currency: string;
  updatedAt: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function JoinSessionModal({ visible, onClose }: Props) {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const flexDir = isRTL ? "row-reverse" : "row";

  const [codeInput,     setCodeInput]     = useState("");
  const [viewerName,    setViewerName]    = useState("");
  const [step,          setStep]          = useState<"enter" | "watching">("enter");
  const [session,       setSession]       = useState<SessionData | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [reminderInput, setReminderInput] = useState("");
  const [addingReminder, setAddingReminder] = useState(false);
  const [showReminderInput, setShowReminderInput] = useState(false);
  const [lastUpdate,    setLastUpdate]    = useState<Date | null>(null);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRef  = useRef<TextInput>(null);

  // ── Reset when closed ────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      if (pollRef.current) clearInterval(pollRef.current);
      setStep("enter");
      setSession(null);
      setError("");
      setLoading(false);
      setShowReminderInput(false);
    }
  }, [visible]);

  // ── Poll session every 5s while watching ────────────────────────────────
  useEffect(() => {
    if (step !== "watching" || !session) return;

    const fetchSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${session.code}`);
        if (res.ok) {
          const data = await res.json() as SessionData;
          setSession(data);
          setLastUpdate(new Date());
        } else {
          setError(t("sessionExpired"));
          setStep("enter");
        }
      } catch {
        // network error, keep polling
      }
    };

    pollRef.current = setInterval(fetchSession, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, session?.code]);

  // ── Join session ─────────────────────────────────────────────────────────
  const handleJoin = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 6) { setError(t("enterCode")); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions/${code}`);
      if (!res.ok) { setError(t("sessionNotFound")); setLoading(false); return; }
      const data = await res.json() as SessionData;
      setSession(data);
      setLastUpdate(new Date());
      setStep("watching");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError(t("sessionNotFound"));
    }
    setLoading(false);
  };

  // ── Add reminder ─────────────────────────────────────────────────────────
  const handleAddReminder = async () => {
    const name = reminderInput.trim();
    if (!name || !session) return;

    setAddingReminder(true);
    try {
      const res = await fetch(`${API_BASE}/sessions/${session.code}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, addedBy: viewerName || t("family") }),
      });
      if (res.ok) {
        const reminder = await res.json() as SessionReminder;
        setSession((prev) =>
          prev ? { ...prev, reminders: [...prev.reminders, reminder] } : prev
        );
        setReminderInput("");
        setShowReminderInput(false);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch { /* ignore */ }
    setAddingReminder(false);
  };

  const total = session?.basket.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  const pendingReminders = session?.reminders.filter((r) => !r.done) ?? [];

  const CURRENCY_SYMBOLS: Record<string, string> = {
    MAD: "د.م", TND: "د.ت", DZD: "دج", EUR: "€", GBP: "£", USD: "$", SAR: "﷼", AED: "د.إ",
  };
  const currencySymbol = session ? (CURRENCY_SYMBOLS[session.currency] ?? session.currency) : "";

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
              {step === "enter" ? t("joinSession") : `🛒 ${session?.hostName ?? ""}`}
            </Text>
            {step === "watching" && lastUpdate && (
              <Text style={[styles.liveText, { color: "#34C759", fontFamily: "Inter_500Medium" }]}>
                🟢 {t("liveUpdates")}
              </Text>
            )}
          </View>
          {step === "watching" && (
            <TouchableOpacity
              onPress={() => { setStep("enter"); setSession(null); }}
              style={[styles.leaveBtn, { backgroundColor: colors.muted, borderRadius: 8 }]}
            >
              <Text style={[styles.leaveTxt, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {t("close")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Enter code step */}
        {step === "enter" && (
          <View style={styles.enterStep}>
            <Ionicons name="qr-code-outline" size={60} color={colors.primary} style={{ opacity: 0.8 }} />
            <Text style={[styles.enterHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
              {t("joinHint")}
            </Text>

            {/* Viewer name */}
            <TextInput
              style={[styles.nameInput, {
                backgroundColor: colors.input, borderColor: colors.border,
                color: colors.foreground, fontFamily: "Inter_400Regular",
                textAlign: isRTL ? "right" : "left", borderRadius: 12,
              }]}
              placeholder={t("yourName")}
              placeholderTextColor={colors.mutedForeground}
              value={viewerName}
              onChangeText={setViewerName}
            />

            {/* Code input */}
            <TextInput
              ref={codeRef}
              style={[styles.codeInput, {
                backgroundColor: colors.input, borderColor: error ? colors.destructive : colors.primary,
                color: colors.primary, fontFamily: "Inter_700Bold",
                borderRadius: 14, textAlign: "center", letterSpacing: 8,
              }]}
              placeholder="A3X9K2"
              placeholderTextColor={colors.mutedForeground}
              value={codeInput}
              onChangeText={(v) => { setCodeInput(v.toUpperCase().replace(/[^A-Z0-9]/g, "")); setError(""); }}
              maxLength={6}
              autoCapitalize="characters"
              onSubmitEditing={handleJoin}
              returnKeyType="go"
            />
            {error ? (
              <Text style={[styles.errorTxt, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={handleJoin}
              disabled={loading || codeInput.length !== 6}
              style={[
                styles.joinBtn,
                {
                  backgroundColor: codeInput.length === 6 ? colors.primary : colors.muted,
                  borderRadius: 14,
                  opacity: loading ? 0.7 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="eye-outline" size={18} color={codeInput.length === 6 ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.joinBtnTxt, { color: codeInput.length === 6 ? "#fff" : colors.mutedForeground, fontFamily: "Inter_700Bold" }]}>
                    {t("joinNow")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Watching step */}
        {step === "watching" && session && (
          <FlatList
            data={session.basket}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {/* Stats bar */}
                <View style={[styles.statsBar, { backgroundColor: colors.primary, flexDirection: flexDir }]}>
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={[styles.statsNum, { fontFamily: "Inter_700Bold" }]}>
                      {session.basket.length}
                    </Text>
                    <Text style={[styles.statsLbl, { fontFamily: "Inter_400Regular" }]}>{t("products")}</Text>
                  </View>
                  <View style={[styles.statsDivider]} />
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={[styles.statsNum, { fontFamily: "Inter_700Bold" }]}>
                      {total.toFixed(2)}
                    </Text>
                    <Text style={[styles.statsLbl, { fontFamily: "Inter_400Regular" }]}>{currencySymbol}</Text>
                  </View>
                  {pendingReminders.length > 0 && (
                    <>
                      <View style={styles.statsDivider} />
                      <View style={{ alignItems: "center", flex: 1 }}>
                        <Text style={[styles.statsNum, { fontFamily: "Inter_700Bold" }]}>
                          {pendingReminders.length}
                        </Text>
                        <Text style={[styles.statsLbl, { fontFamily: "Inter_400Regular" }]}>{t("reminders")}</Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Reminders sent */}
                {session.reminders.length > 0 && (
                  <View style={[styles.remindSection, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", textAlign: isRTL ? "right" : "left" }]}>
                      {t("reminders")}
                    </Text>
                    {session.reminders.map((r) => (
                      <View key={r.id} style={[styles.reminderRow, { flexDirection: flexDir, borderBottomColor: colors.border }]}>
                        <Ionicons
                          name={r.done ? "checkmark-circle" : "alert-circle-outline"}
                          size={16}
                          color={r.done ? "#34C759" : "#FF9500"}
                        />
                        <Text style={[
                          styles.reminderName,
                          { color: r.done ? colors.mutedForeground : colors.foreground, fontFamily: "Inter_500Medium", flex: 1, textAlign: isRTL ? "right" : "left",
                            textDecorationLine: r.done ? "line-through" : "none" },
                        ]}>
                          {r.name}
                        </Text>
                        {r.done && (
                          <Text style={[styles.doneLbl, { color: "#34C759", fontFamily: "Inter_500Medium" }]}>{t("doneReminder")}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", paddingHorizontal: 20, paddingTop: 16, textAlign: isRTL ? "right" : "left" }]}>
                  {t("basket")}
                </Text>

                {session.basket.length === 0 && (
                  <View style={styles.empty}>
                    <Ionicons name="cart-outline" size={48} color={colors.border} />
                    <Text style={[styles.emptyTxt, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {t("noItemsYet")}
                    </Text>
                  </View>
                )}
              </>
            }
            renderItem={({ item }) => (
              <View style={[styles.itemRow, { borderBottomColor: colors.border, flexDirection: flexDir }]}>
                <View style={[styles.itemDot, { backgroundColor: colors.primary + "30" }]}>
                  <Ionicons name="cube-outline" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.itemName, { color: colors.foreground, fontFamily: "Inter_500Medium", flex: 1, textAlign: isRTL ? "right" : "left" }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.itemQty, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  ×{item.quantity}
                </Text>
                <Text style={[styles.itemPrice, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                  {(item.price * item.quantity).toFixed(2)} {currencySymbol}
                </Text>
              </View>
            )}
            ListFooterComponent={
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                {/* Add reminder */}
                {showReminderInput ? (
                  <View style={[styles.reminderInputRow, { flexDirection: flexDir, borderColor: colors.primary, borderRadius: 12 }]}>
                    <TextInput
                      style={[styles.reminderInput, {
                        color: colors.foreground, fontFamily: "Inter_400Regular",
                        textAlign: isRTL ? "right" : "left", flex: 1,
                      }]}
                      placeholder={t("addReminder")}
                      placeholderTextColor={colors.mutedForeground}
                      value={reminderInput}
                      onChangeText={setReminderInput}
                      autoFocus
                      onSubmitEditing={handleAddReminder}
                      returnKeyType="send"
                    />
                    <TouchableOpacity onPress={handleAddReminder} disabled={addingReminder || !reminderInput.trim()}>
                      {addingReminder ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="send" size={20} color={reminderInput.trim() ? colors.primary : colors.mutedForeground} />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowReminderInput(true)}
                    style={[styles.addReminderBtn, { backgroundColor: "#FF9500" + "18", borderRadius: 12, flexDirection: flexDir }]}
                  >
                    <Ionicons name="notifications-outline" size={18} color="#FF9500" />
                    <Text style={[styles.addReminderTxt, { color: "#FF9500", fontFamily: "Inter_600SemiBold" }]}>
                      {t("addReminderBtn")}
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
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:      { maxHeight: "92%", paddingTop: 12 },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14, opacity: 0.3 },
  header:     { alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  title:      { fontSize: 18 },
  liveText:   { fontSize: 12, marginTop: 2 },
  leaveBtn:   { paddingHorizontal: 10, paddingVertical: 6 },
  leaveTxt:   { fontSize: 13 },
  enterStep:  { padding: 28, alignItems: "center", gap: 14 },
  enterHint:  { fontSize: 14, paddingHorizontal: 20 },
  nameInput:  { width: "100%", borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  codeInput:  { width: "100%", borderWidth: 2, paddingHorizontal: 20, paddingVertical: 14, fontSize: 30 },
  errorTxt:   { fontSize: 13 },
  joinBtn:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, width: "100%", justifyContent: "center" },
  joinBtnTxt: { fontSize: 16 },
  statsBar:   { alignItems: "center", justifyContent: "center", paddingVertical: 18, paddingHorizontal: 20 },
  statsNum:   { color: "#fff", fontSize: 22 },
  statsLbl:   { color: "rgba(255,255,255,0.75)", fontSize: 11 },
  statsDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.3)" },
  remindSection: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle:  { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  reminderRow:   { alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  reminderName:  { fontSize: 14 },
  doneLbl:       { fontSize: 11 },
  empty:         { paddingVertical: 40, alignItems: "center", gap: 12 },
  emptyTxt:      { fontSize: 14 },
  itemRow:       { alignItems: "center", paddingHorizontal: 20, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  itemDot:       { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  itemName:      { fontSize: 14 },
  itemQty:       { fontSize: 13 },
  itemPrice:     { fontSize: 14, flexShrink: 0 },
  footer:        { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  reminderInputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, gap: 10 },
  reminderInput:    { fontSize: 15, padding: 0 },
  addReminderBtn:   { alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  addReminderTxt:   { fontSize: 14 },
});
