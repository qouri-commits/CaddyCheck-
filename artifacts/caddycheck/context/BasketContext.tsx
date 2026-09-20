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
import { useLanguage } from "@/context/LanguageContext";
import {
  assertQuantity,
  calculateBasketItemCount,
  calculateBasketTotal,
  mergeValidatedBackup,
  validateBasketBackup,
  validateBasketItem,
  validatePriceHistoryEntry,
  validateTrip,
} from "@/utils/basketBackupReliability";

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
  importBackup: (data: unknown) => Promise<void>;
  basketTotal: number;
  basketItemCount: number;
  // Session sharing
  sessionCode: string | null;
  sessionHostToken: string | null;
  sessionReminders: SessionReminder[];
  sessionSyncFailed: boolean;
  storageError: string | null;
  retryPersistence: () => Promise<boolean>;
  startSession: (hostName: string, currency?: string) => Promise<boolean>;
  endSession: () => Promise<void>;
  markReminderDone: (reminderId: string) => Promise<void>;
}

const BasketContext = createContext<BasketContextType | null>(null);

const STORAGE_KEYS = {
  BASKET:        "caddycheck_basket",
  TRIPS:         "caddycheck_trips",
  PRICE_HISTORY: "caddycheck_price_history",
  PRODUCT_CACHE: "caddycheck_product_cache",
  SESSION_CODE:  "caddycheck_session_code",
  SESSION_TOKEN: "caddycheck_session_token",
};

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const { currency: appCurrency } = useLanguage();
  const [items,        setItems]       = useState<BasketItem[]>([]);
  const [trips,        setTrips]       = useState<Trip[]>([]);
  const [priceHistory, setPriceHistory]= useState<Record<string, PriceHistoryEntry>>({});
  const [productCache, setProductCache]= useState<Record<string, Record<string, unknown>>>({});

  // Session state
  const [sessionCode,      setSessionCode]      = useState<string | null>(null);
  const [sessionHostToken, setSessionHostToken] = useState<string | null>(null);
  const [sessionReminders, setSessionReminders] = useState<SessionReminder[]>([]);
  const [sessionSyncFailed, setSessionSyncFailed] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

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
  const storageQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingPersistenceRef = useRef<Array<() => Promise<void>>>([]);
  const persistenceRetryRef = useRef<Promise<boolean> | null>(null);
  const mutationVersionRef = useRef({
    items: 0,
    trips: 0,
    priceHistory: 0,
    productCache: 0,
    session: 0,
  });

  // AsyncStorage operations are serialized so a slower, older write can never
  // overwrite a newer user action. The rejection handler also prevents ignored
  // fire-and-forget writes from becoming unhandled promise rejections.
  const enqueueStorage = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const retryableOperation = async () => {
      await operation();
    };
    const execute = async (): Promise<T> => {
      if (pendingPersistenceRef.current.length > 0) {
        pendingPersistenceRef.current.push(retryableOperation);
        setStorageError("Shopping data could not be saved. Please retry.");
        throw new Error("Persistence is waiting for an earlier failed write");
      }
      try {
        const value = await operation();
        setStorageError(null);
        return value;
      } catch (error) {
        pendingPersistenceRef.current.push(retryableOperation);
        setStorageError("Shopping data could not be saved. Please retry.");
        throw error;
      }
    };
    const result = storageQueueRef.current.then(execute);
    storageQueueRef.current = result.then(
      () => undefined,
      (error) => {
        console.error("CaddyCheck storage operation failed", error);
      },
    );
    return result;
  }, []);

  const retryPersistence = useCallback(async (): Promise<boolean> => {
    if (persistenceRetryRef.current) return persistenceRetryRef.current;

    // Persist the state actually shown to the user, not failed import/delete
    // callbacks whose post-write state updates never ran. Serialize recovery
    // with normal writes so edits made during recovery are written afterwards.
    const retry = storageQueueRef.current.then(async () => {
      try {
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.BASKET, JSON.stringify(itemsRef.current)],
          [STORAGE_KEYS.TRIPS, JSON.stringify(tripsRef.current)],
          [STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(priceHistoryRef.current)],
          [STORAGE_KEYS.PRODUCT_CACHE, JSON.stringify(productCacheRef.current)],
          [STORAGE_KEYS.SESSION_CODE, sessionCodeRef.current ?? ""],
          [STORAGE_KEYS.SESSION_TOKEN, sessionTokenRef.current ?? ""],
        ]);
        pendingPersistenceRef.current = [];
        setStorageError(null);
        return true;
      } catch (error) {
        setStorageError("Shopping data could not be saved. Please retry.");
        console.error("CaddyCheck persistence retry failed", error);
        return false;
      }
    });
    storageQueueRef.current = retry.then(() => undefined);
    persistenceRetryRef.current = retry;
    try {
      return await retry;
    } finally {
      persistenceRetryRef.current = null;
    }
  }, []);

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
        const restore = (label: string, operation: () => void) => {
          try {
            operation();
          } catch (error) {
            // Keep malformed storage untouched for potential recovery, while
            // still restoring every other independently valid data section.
            console.error(`CaddyCheck could not restore ${label}`, error);
          }
        };
        if (basketRaw && mutationVersionRef.current.items === 0) {
          restore("the stored basket", () => {
            const parsed = JSON.parse(basketRaw) as unknown;
            if (!Array.isArray(parsed)) throw new Error("Stored basket must be an array");
            const loaded = parsed.map((item, index) =>
              validateBasketItem(item, `stored basket[${index}]`),
            );
            itemsRef.current = loaded;
            setItems(loaded);
          });
        }
        if (tripsRaw && mutationVersionRef.current.trips === 0) {
          restore("stored trips", () => {
            const loaded =
              validateBasketBackup({ trips: JSON.parse(tripsRaw) }).trips ?? [];
            tripsRef.current = loaded;
            setTrips(loaded);
          });
        }
        if (historyRaw && mutationVersionRef.current.priceHistory === 0) {
          restore("stored price history", () => {
            const loaded = validateBasketBackup({
              priceHistory: JSON.parse(historyRaw),
            }).priceHistory ?? {};
            priceHistoryRef.current = loaded;
            setPriceHistory(loaded);
          });
        }
        if (cacheRaw && mutationVersionRef.current.productCache === 0) {
          restore("the stored product cache", () => {
            const parsed = JSON.parse(cacheRaw) as unknown;
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              throw new Error("Stored product cache must be an object");
            }
            const loaded = parsed as Record<string, Record<string, unknown>>;
            productCacheRef.current = loaded;
            setProductCache(loaded);
          });
        }
        if (codeRaw && tokenRaw && mutationVersionRef.current.session === 0) {
          setSessionCode(codeRaw);
          setSessionHostToken(tokenRaw);
          sessionCodeRef.current  = codeRaw;
          sessionTokenRef.current = tokenRaw;
        }
      } catch (error) {
        console.error("CaddyCheck could not load stored shopping data", error);
      }
    };
    void load();
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
    const syncCurrency = currency ?? appCurrency;
    lastSyncedCurrencyRef.current = syncCurrency;
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
            currency: syncCurrency,
          }),
        });
        if (requestId !== syncRequestRef.current) return;
        setSessionSyncFailed(!res.ok);
        if (!res.ok && attempt < 3) {
          retryTimerRef.current = setTimeout(() => {
            void attemptSync(attempt + 1);
          }, 5000 * (attempt + 1));
        }
      } catch {
        if (requestId !== syncRequestRef.current) return;
        // Network unreachable — surface a non-blocking sync indicator and retry
        setSessionSyncFailed(true);
        if (attempt < 3) {
          retryTimerRef.current = setTimeout(() => {
            void attemptSync(attempt + 1);
          }, 5000 * (attempt + 1));
        }
      }
    };

    syncTimerRef.current = setTimeout(() => {
      void attemptSync(0);
    }, 1500);
  }, [appCurrency]);

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
          const data = await res.json() as { reminders?: unknown };
          if (!Array.isArray(data.reminders)) {
            throw new Error("Session reminders response is invalid");
          }
          const reminders = data.reminders.map((value, index) => {
            if (!value || typeof value !== "object") {
              throw new Error(`Session reminder ${index} is invalid`);
            }
            const reminder = value as Partial<SessionReminder>;
            if (
              typeof reminder.id !== "string" ||
              typeof reminder.name !== "string" ||
              typeof reminder.addedAt !== "string" ||
              typeof reminder.done !== "boolean"
            ) {
              throw new Error(`Session reminder ${index} is invalid`);
            }
            return reminder as SessionReminder;
          });
          setSessionReminders(reminders);
        } else if (res.status === 404 || res.status === 410) {
          // Session expired — clear local state
          sessionCodeRef.current = null;
          sessionTokenRef.current = null;
          if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
          if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
          syncRequestRef.current += 1;
          setSessionCode(null);
          setSessionHostToken(null);
          setSessionReminders([]);
          mutationVersionRef.current.session += 1;
          await enqueueStorage(() =>
            AsyncStorage.multiRemove([STORAGE_KEYS.SESSION_CODE, STORAGE_KEYS.SESSION_TOKEN]),
          );
        } else {
          setSessionSyncFailed(true);
          console.error(`CaddyCheck session polling failed with status ${res.status}`);
        }
      } catch (error) {
        setSessionSyncFailed(true);
        console.error("CaddyCheck session polling failed", error);
      }
    };

    void fetchReminders();
    pollTimerRef.current = setInterval(() => {
      void fetchReminders();
    }, 20_000);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [enqueueStorage, sessionCode, sessionHostToken]);

  // ─────────────────────────────────────────────────────────────────────────
  // Basket mutators — all trigger server sync if session is active
  // ─────────────────────────────────────────────────────────────────────────

  const addItem = useCallback((item: BasketItem) => {
    const validItem = validateBasketItem(item);
    const next = [...itemsRef.current, validItem];
    calculateBasketTotal(next);
    calculateBasketItemCount(next);
    mutationVersionRef.current.items += 1;
    itemsRef.current = next;
    setItems(next);
    void enqueueStorage(() =>
      AsyncStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(next)),
    );
    syncBasketToServer(next);
  }, [enqueueStorage, syncBasketToServer]);

  const removeItem = useCallback((id: string) => {
    const next = itemsRef.current.filter((i) => i.id !== id);
    mutationVersionRef.current.items += 1;
    itemsRef.current = next;
    setItems(next);
    void enqueueStorage(() =>
      AsyncStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(next)),
    );
    syncBasketToServer(next);
  }, [enqueueStorage, syncBasketToServer]);

  const updateItemPrice = useCallback((id: string, price: number) => {
    const validPrice = validateBasketItem({
      id: "validation",
      name: "validation",
      price,
      quantity: 1,
    }).price;
    const next = itemsRef.current.map((i) =>
      i.id === id ? { ...i, price: validPrice } : i
    );
    calculateBasketTotal(next);
    mutationVersionRef.current.items += 1;
    itemsRef.current = next;
    setItems(next);
    void enqueueStorage(() =>
      AsyncStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(next)),
    );
    syncBasketToServer(next);
  }, [enqueueStorage, syncBasketToServer]);

  const updateItemQuantity = useCallback((id: string, quantity: number) => {
    const validQuantity = assertQuantity(quantity);
    const next = itemsRef.current.map((i) =>
      i.id === id ? { ...i, quantity: validQuantity } : i
    );
    calculateBasketTotal(next);
    calculateBasketItemCount(next);
    mutationVersionRef.current.items += 1;
    itemsRef.current = next;
    setItems(next);
    void enqueueStorage(() =>
      AsyncStorage.setItem(STORAGE_KEYS.BASKET, JSON.stringify(next)),
    );
    syncBasketToServer(next);
  }, [enqueueStorage, syncBasketToServer]);

  const clearBasket = useCallback(() => {
    setItems([]);
    mutationVersionRef.current.items += 1;
    itemsRef.current = [];
    void enqueueStorage(() => AsyncStorage.setItem(STORAGE_KEYS.BASKET, "[]"));
    syncBasketToServer([]);
  }, [enqueueStorage, syncBasketToServer]);

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
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    syncRequestRef.current += 1;
    await enqueueStorage(() =>
      AsyncStorage.multiRemove([
        STORAGE_KEYS.BASKET,
        STORAGE_KEYS.TRIPS,
        STORAGE_KEYS.PRICE_HISTORY,
        STORAGE_KEYS.PRODUCT_CACHE,
        STORAGE_KEYS.SESSION_CODE,
        STORAGE_KEYS.SESSION_TOKEN,
        "user_stores",
        "store_visits",
        "last_store",
        "caddycheck_budget",
      ]),
    );
    mutationVersionRef.current.items += 1;
    mutationVersionRef.current.trips += 1;
    mutationVersionRef.current.priceHistory += 1;
    mutationVersionRef.current.productCache += 1;
    mutationVersionRef.current.session += 1;
    itemsRef.current = [];
    tripsRef.current = [];
    priceHistoryRef.current = {};
    productCacheRef.current = {};
    sessionCodeRef.current = null;
    sessionTokenRef.current = null;
    lastSyncedCurrencyRef.current = undefined;
    setItems([]);
    setTrips([]);
    setPriceHistory({});
    setProductCache({});
    setSessionCode(null);
    setSessionHostToken(null);
    setSessionReminders([]);
    setSessionSyncFailed(false);
  }, [enqueueStorage]);

  const saveTrip = useCallback(async (trip: Trip) => {
    const validTrip = validateTrip(trip);
    await enqueueStorage(async () => {
      const next = [
        validTrip,
        ...tripsRef.current.filter((current) => current.id !== validTrip.id),
      ];
      await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(next));
      mutationVersionRef.current.trips += 1;
      tripsRef.current = next;
      setTrips(next);
    });
  }, [enqueueStorage]);

  const deleteTrip = useCallback(async (id: string) => {
    await enqueueStorage(async () => {
      const next = tripsRef.current.filter((t) => t.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(next));
      mutationVersionRef.current.trips += 1;
      tripsRef.current = next;
      setTrips(next);
    });
  }, [enqueueStorage]);

  const saveProductCache = useCallback(
    (barcode: string, data: Record<string, unknown>) => {
      if (typeof barcode !== "string" || barcode.trim().length === 0) {
        throw new Error("barcode must be a non-empty string");
      }
      const next = { ...productCacheRef.current, [barcode]: data };
      mutationVersionRef.current.productCache += 1;
      productCacheRef.current = next;
      setProductCache(next);
      void enqueueStorage(() =>
        AsyncStorage.setItem(STORAGE_KEYS.PRODUCT_CACHE, JSON.stringify(next)),
      );
    }, [enqueueStorage]
  );

  const getProductCache = useCallback(
    (barcode: string): Record<string, unknown> | null =>
      productCacheRef.current[barcode] ?? null,
    []
  );

  const updatePriceHistory = useCallback(
    (barcode: string, entry: PriceHistoryEntry) => {
      if (typeof barcode !== "string" || barcode.trim().length === 0) {
        throw new Error("barcode must be a non-empty string");
      }
      const validEntry = validatePriceHistoryEntry(entry);
      const next = { ...priceHistoryRef.current, [barcode]: validEntry };
      mutationVersionRef.current.priceHistory += 1;
      priceHistoryRef.current = next;
      setPriceHistory(next);
      void enqueueStorage(() =>
        AsyncStorage.setItem(STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(next)),
      );
    }, [enqueueStorage]
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
    async (data: unknown) => {
      // Validate the entire document before touching state or storage. A single
      // malformed trip rejects the complete restore rather than partially
      // importing data and silently dropping the bad portion.
      const validated = validateBasketBackup(data);
      await enqueueStorage(async () => {
        const merged = mergeValidatedBackup(
          tripsRef.current,
          priceHistoryRef.current,
          validated,
        );
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.TRIPS, JSON.stringify(merged.trips)],
          [STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(merged.priceHistory)],
        ]);
        mutationVersionRef.current.trips += 1;
        mutationVersionRef.current.priceHistory += 1;
        tripsRef.current = merged.trips;
        priceHistoryRef.current = merged.priceHistory;
        setTrips(merged.trips);
        setPriceHistory(merged.priceHistory);
      });
    },
    [enqueueStorage]
  );

  // ─── Session functions ────────────────────────────────────────────────────

  const startSession = useCallback(async (hostName: string, currency = "MAD"): Promise<boolean> => {
    if (!API_BASE || !hostName.trim() || !currency.trim()) return false;
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName, currency }),
      });
      if (!res.ok) return false;
      const data = await res.json() as { code?: unknown; hostToken?: unknown };
      if (
        typeof data.code !== "string" ||
        !data.code.trim() ||
        typeof data.hostToken !== "string" ||
        !data.hostToken.trim()
      ) {
        return false;
      }
      await enqueueStorage(() =>
        AsyncStorage.multiSet([
          [STORAGE_KEYS.SESSION_CODE, data.code as string],
          [STORAGE_KEYS.SESSION_TOKEN, data.hostToken as string],
        ]),
      );
      // Update refs before the immediate sync. React state updates are async,
      // while syncBasketToServer intentionally reads refs to avoid stale edits.
      sessionCodeRef.current = data.code;
      sessionTokenRef.current = data.hostToken;
      setSessionCode(data.code);
      setSessionHostToken(data.hostToken);
      setSessionReminders([]);
      setSessionSyncFailed(false);
      mutationVersionRef.current.session += 1;
      // Immediately push current basket
      syncBasketToServer(itemsRef.current, currency);
      return true;
    } catch {
      return false;
    }
  }, [enqueueStorage, syncBasketToServer]);

  const endSession = useCallback(async () => {
    const activeCode = sessionCodeRef.current;
    const activeToken = sessionTokenRef.current;
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    syncRequestRef.current += 1;
    if (activeCode && activeToken && API_BASE) {
      try {
        await fetch(`${API_BASE}/sessions/${activeCode}`, {
          method: "DELETE",
          headers: { "x-host-token": activeToken },
        });
      } catch (error) {
        console.error("CaddyCheck could not close the remote session", error);
      }
    }
    sessionCodeRef.current = null;
    sessionTokenRef.current = null;
    lastSyncedCurrencyRef.current = undefined;
    mutationVersionRef.current.session += 1;
    setSessionCode(null);
    setSessionHostToken(null);
    setSessionReminders([]);
    setSessionSyncFailed(false);
    await enqueueStorage(() =>
      AsyncStorage.multiRemove([STORAGE_KEYS.SESSION_CODE, STORAGE_KEYS.SESSION_TOKEN]),
    );
  }, [enqueueStorage]);

  const markReminderDone = useCallback(async (reminderId: string) => {
    if (!sessionCodeRef.current || !sessionTokenRef.current || !API_BASE) return;
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionCodeRef.current}/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "x-host-token": sessionTokenRef.current },
      });
      if (!res.ok) {
        setSessionSyncFailed(true);
        return;
      }
      setSessionReminders((prev) =>
        prev.map((r) => (r.id === reminderId ? { ...r, done: true } : r))
      );
    } catch (error) {
      setSessionSyncFailed(true);
      console.error("CaddyCheck could not update the session reminder", error);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  const basketTotal     = calculateBasketTotal(items);
  const basketItemCount = calculateBasketItemCount(items);

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
        storageError,
        retryPersistence,
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
  const context = useContext(BasketContext);
  if (!context) {
    throw new Error("useBasket must be used within a BasketProvider");
  }
  return context;
}
