import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BasketItem, PriceHistoryEntry, Trip } from "@/types";
import { API_BASE } from "@/constants/api";

// ─── Session types ────────────────────────────────────────────────────────────
export interface SessionReminder {
  id: string;
  name: string;
  addedBy?: string;
  addedAt: string;
  done: boolean;
}

// ─── Context interface ────────────────────────────────────────────────────────
interface BasketContextType {
  items: BasketItem[];
  trips: Trip[];
  priceHistory: Record<string, PriceHistoryEntry>;
  addItem: (item: BasketItem) => void;
  removeItem: (id: string) => void;
  updateItemPrice: (id: string, price: number) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  clearBasket: () => void;
  clearAll: () => Promise<void>;
  saveTrip: (trip: Trip) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  saveProductCache: (barcode: string, data: Record<string, unknown>) => void;
  getProductCache: (barcode: string) => Record<string, unknown> | null;
  updatePriceHistory: (barcode: string, entry: PriceHistoryEntry) => void;
  exportBackup: () => Promise<{ trips: Trip[]; priceHistory: Record<string, PriceHistoryEntry>; exportedAt: string; version: number }>;
  importBackup: (data: { trips?: Trip[]; priceHistory?: Record<string, PriceHistoryEntry> }) => Promise<void>;
  basketTotal: number;
  basketItemCount: number;
  // Session sharing
  sessionCode: string | null;
  sessionHostToken: string | null;
  sessionReminders: SessionReminder[];
  sessionSyncFailed: boolean;
  startSession: (hostName: string, currency?: string) => Promise<boolean>;
  endSession: () => Promise<void>;
  markReminderDone: (reminderId: string) => Promise<void>;
}

const BasketContext = createContext<BasketContextType>({} as BasketContextType);

const STORAGE_KEYS = {
  BASKET:        "caddycheck_basket",
  TRIPS:         "caddycheck_trips",
  PRICE_HISTORY: "caddycheck_price_history",
  PRODUCT_CACHE: "caddycheck_product_cache",
  SESSION_CODE:  "caddycheck_session_code",
  SESSION_TOKEN: "caddycheck_session_token",
};

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [items,        setItems]       = useState<BasketItem[]>([]);
  const [trips,        setTrips]       = useState<Trip[]>([]);
  const [priceHistory, setPriceHistory]= useState<Record<string, PriceHistoryEntry>>({});
  const [productCache, setProductCache]= useState<Record<string, Record<string, unknown>>>({});

  // Session state
  const [sessionCode,      setSessionCode]      = useState<string | null>(null);
  const [sessionHostToken, setSessionHostToken] = useState<string | null>(null);
  const [sessionReminders, setSessionReminders] = useState<SessionReminder[]>([]);
  const [sessionSyncFailed, setSessionSyncFailed] = useState(false);

  const itemsRef        = useRef<BasketItem[]>(items);
  const tripsRef        = useRef<Trip[]>(trips);
  const priceHistoryRef = useRef<Record<string, PriceHistoryEntry>>(priceHistory);
  const productCacheRef = useRef<Record<string, Record<string, unknown>>>(productCache);
  const sessionCodeRef  = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const syncTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedCurrencyRef = useRef<string | undefined>(undefined);
  const syncRequestRef = useRef(0);

  useEffect(() => { itemsRef.current        = items; },        [items]);
  useEffect(() => { tripsRef.current        = trips; },        [trips]);
  useEffect(() => { priceHistoryRef.current = priceHistory; }, [priceHistory]);
  useEffect(() => { productCacheRef.current = productCache; }, [productCache]);
  useEffect(() => { sessionCodeRef.current  = sessionCode; },  [sessionCode]);
  useEffect(() => { sessionTokenRef.current = sessionHostToken; }, [sessionHostToken]);

  // ── Load persisted data on mount ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [basketRaw, tripsRaw, historyRaw, cacheRaw, codeRaw, tokenRaw] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.BASKET),
            AsyncStorage.getItem(STORAGE_KEYS.TRIPS),
            AsyncStorage.getItem(STORAGE_KEYS.PRICE_HISTORY),
            AsyncStorage.getItem(STORAGE_KEYS.PRODUCT_CACHE),
            AsyncStorage.getItem(STORAGE_KEYS.SESSION_CODE),
            AsyncStorage.getItem(STORAGE_KEYS.SESSION_TOKEN),
          ]);
        if (basketRaw)  setItems(JSON.parse(basketRaw));
        if (tripsRaw)   setTrips(JSON.parse(tripsRaw));
        if (historyRaw) setPriceHistory(JSON.parse(historyRaw));
        if (cacheRaw)   setProductCache(JSON.parse(cacheRaw));
        if (codeRaw && tokenRaw) {
          setSessionCode(codeRaw);
          setSessionHostToken(tokenRaw);
          sessionCodeRef.current  = codeRaw;
          sessionTokenRef.current = tokenRaw;
        }
      } catch {}
    };
    load();
  }, []);

  // Never leave a delayed sync or poll running after the provider unmounts.
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      syncRequestRef.current += 1;
    };
  }, []);

  // ── Sync basket to server (debounced 1.5s, auto-retries on failure) ──────
  const syncBasketToServer = useCallback((currentItems: BasketItem[], currency?: string) => {
    if (currency !== undefined) lastSyncedCurrencyRef.current = currency;
    if (!sessionCodeRef.current || !sessionTokenRef.current || !API_BASE) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    const requestId = ++syncRequestRef.current;

    const attemptSync = async (attempt: number) => {
      if (!sessionCodeRef.current || !sessionTokenRef.current) return;
      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionCodeRef.current}/basket`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-host-token": sessionTokenRef.current,
          },
          body: JSON.stringify({
            basket: currentItems.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              barcode: i.barcode,
              imageUrl: i.imageUrl,
            })),
            currency: currency ?? lastSyncedCurrencyRef.current,
          }),
        });
        if (requestId !== syncRequestRef.current) return;
        setSessionSyncFailed(!res.ok);
        if (!res.ok && attempt < 3) {
          retryTimerRef.current = setTimeout(() => attemptSync(attempt + 1), 5000 * (attempt + 1));
        }
      } catch {
        if (requestId !== syncRequestRef.current) return;
        // Network unreachable — surface a non-blocking sync indicator and retry
        setSessionSyncFailed(true);
        if (attempt < 3) {
          retryTimerRef.current = setTimeout(() => attemptSync(attempt + 1), 5000 * (attempt + 1));
        }
      }
    };

    syncTimerRef.current = setTimeout(() => attemptSync(0), 1500);
  }, []);

  // ── Poll for new reminders from family (every 20s when session active) ───
  useEffect(() => {
    if (!sessionCode || !sessionHostToken || !API_BASE) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    const fetchReminders = async () => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionCode}`);
        if (res.ok) {
          const data = await res.json() as { reminders: SessionReminder[] };
          setSessionReminders(data.reminders ?? []);
        } else {
          // Session expired — clear local state
          sessionCodeRef.current = null;
          sessionTokenRef.current = null;
          if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
          if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
          syncRequestRef.current += 1;
          setSessionCode(null);
          setSessionHostToken(null);
          setSessionReminders([]);
          await AsyncStorage.multiRemove([STORAGE_KEYS.SESSION_CODE, STORAGE_KEYS.SESSION_TOKEN]);
        }
      } catch {}
    };

    fetchReminders();
    pollTimerRef.current = setInterval(fetchReminders, 20_000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [sessionCode, sessionHostToken]);

  // ─────────────────────────────────────────────────────────────────────────
  // Basket mutators — all trigger server sync if session is active
  // ─────────────────────────────────────────────────────────────────────────

  const addItem = useCallback((item: BasketItem) => {
    const next = [...itemsRef.current, item];
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(next));
    syncBasketToServer(next);
  }, [syncBasketToServer]);

  const removeItem = useCallback((id: string) => {
    const next = itemsRef.current.filter((i) => i.id !== id);
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(next));
    syncBasketToServer(next);
  }, [syncBasketToServer]);

  const updateItemPrice = useCallback((id: string, price: number) => {
    const next = itemsRef.current.map((i) => (i.id === id ? { ...i, price } : i));
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(next));
    syncBasketToServer(next);
  }, [syncBasketToServer]);

  const updateItemQuantity = useCallback((id: string, quantity: number) => {
    const next = itemsRef.current.map((i) =>
      i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
    );
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(next));
    syncBasketToServer(next);
  }, [syncBasketToServer]);

  const clearBasket = useCallback(() => {
    setItems([]);
    itemsRef.current = [];
    AsyncStorage.setItem(STORAGE_KEYS.BASKET, "[]");
    syncBasketToServer([]);
  }, [syncBasketToServer]);

  const clearAll = useCallback(async () => {
    const activeCode = sessionCodeRef.current;
    const activeToken = sessionTokenRef.current;
    if (activeCode && activeToken && API_BASE) {
      try {
        await fetch(`${API_BASE}/sessions/${activeCode}`, {
          method: "DELETE",
          headers: { "x-host-token": activeToken },
        });
      } catch {
        // Local data is still cleared even if the server cannot be reached.
      }
    }
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    syncRequestRef.current += 1;
    setItems([]);
    setTrips([]);
    setPriceHistory({});
    setProductCache({});
    setSessionCode(null);
    setSessionHostToken(null);
    setSessionReminders([]);
    itemsRef.current = [];
    tripsRef.current = [];
    priceHistoryRef.current = {};
    productCacheRef.current = {};
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.BASKET,
      STORAGE_KEYS.TRIPS,
      STORAGE_KEYS.PRICE_HISTORY,
      STORAGE_KEYS.PRODUCT_CACHE,
      STORAGE_KEYS.SESSION_CODE,
      STORAGE_KEYS.SESSION_TOKEN,
      "user_stores",
    ]);
  }, []);

  const saveTrip = useCallback(async (trip: Trip) => {
    const next = [trip, ...tripsRef.current];
    await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(next));
    setTrips(next);
  }, []);

  const deleteTrip = useCallback(async (id: string) => {
    const next = tripsRef.current.filter((t) => t.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(next));
    setTrips(next);
  }, []);

  const saveProductCache = useCallback(
    (barcode: string, data: Record<string, unknown>) => {
      const next = { ...productCacheRef.current, [barcode]: data };
      setProductCache(next);
      AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_CACHE, JSON.stringify(next));
    }, []
  );

  const getProductCache = useCallback(
    (barcode: string): Record<string, unknown> | null =>
      productCacheRef.current[barcode] ?? null,
    []
  );

  const updatePriceHistory = useCallback(
    (barcode: string, entry: PriceHistoryEntry) => {
      const next = { ...priceHistoryRef.current, [barcode]: entry };
      setPriceHistory(next);
      AsyncStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(next));
    }, []
  );

  const exportBackup = useCallback(async () => {
    return {
      trips: tripsRef.current,
      priceHistory: priceHistoryRef.current,
      exportedAt: new Date().toISOString(),
      version: 1,
    };
  }, []);

  const importBackup = useCallback(
    async (data: { trips?: Trip[]; priceHistory?: Record<string, PriceHistoryEntry> }) => {
      if (Array.isArray(data.trips)) {
        const existingIds = new Set(tripsRef.current.map((t) => t.id));
        const merged = [
          ...tripsRef.current,
          ...data.trips.filter((t) => t && t.id && !existingIds.has(t.id)),
        ];
        setTrips(merged);
        tripsRef.current = merged;
        await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(merged));
      }
      if (data.priceHistory && typeof data.priceHistory === "object") {
        const merged = { ...priceHistoryRef.current, ...data.priceHistory };
        setPriceHistory(merged);
        priceHistoryRef.current = merged;
        await AsyncStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(merged));
      }
    },
    []
  );

  // ─── Session functions ────────────────────────────────────────────────────

  const startSession = useCallback(async (hostName: string, currency = "MAD"): Promise<boolean> => {
    if (!API_BASE) return false;
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName, currency }),
      });
      if (!res.ok) return false;
      const data = await res.json() as { code: string; hostToken: string };
      // Update refs before the immediate sync. React state updates are async,
      // while syncBasketToServer intentionally reads refs to avoid stale edits.
      sessionCodeRef.current = data.code;
      sessionTokenRef.current = data.hostToken;
      setSessionCode(data.code);
      setSessionHostToken(data.hostToken);
      setSessionReminders([]);
      setSessionSyncFailed(false);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_CODE,  data.code);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.hostToken);
      // Immediately push current basket
      syncBasketToServer(itemsRef.current, currency);
      return true;
    } catch {
      return false;
    }
  }, [syncBasketToServer]);

  const endSession = useCallback(async () => {
    if (!sessionCodeRef.current || !sessionTokenRef.current || !API_BASE) return;
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    syncRequestRef.current += 1;
    try {
      await fetch(`${API_BASE}/sessions/${sessionCodeRef.current}`, {
        method: "DELETE",
        headers: { "x-host-token": sessionTokenRef.current },
      });
    } catch {}
    setSessionCode(null);
    setSessionHostToken(null);
    setSessionReminders([]);
    setSessionSyncFailed(false);
    await AsyncStorage.multiRemove([STORAGE_KEYS.SESSION_CODE, STORAGE_KEYS.SESSION_TOKEN]);
  }, []);

  const markReminderDone = useCallback(async (reminderId: string) => {
    if (!sessionCodeRef.current || !sessionTokenRef.current || !API_BASE) return;
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionCodeRef.current}/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "x-host-token": sessionTokenRef.current },
      });
      if (!res.ok) return;
      setSessionReminders((prev) =>
        prev.map((r) => (r.id === reminderId ? { ...r, done: true } : r))
      );
    } catch {}
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const basketTotal     = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const basketItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <BasketContext.Provider
      value={{
        items,
        trips,
        priceHistory,
        addItem,
        removeItem,
        updateItemPrice,
        updateItemQuantity,
        clearBasket,
        clearAll,
        saveTrip,
        deleteTrip,
        saveProductCache,
        getProductCache,
        updatePriceHistory,
        exportBackup,
        importBackup,
        basketTotal,
        basketItemCount,
        sessionCode,
        sessionHostToken,
        sessionReminders,
        sessionSyncFailed,
        startSession,
        endSession,
        markReminderDone,
      }}
    >
      {children}
    </BasketContext.Provider>
  );
}

export function useBasket() {
  return useContext(BasketContext);
}
