import type {
  BasketItem,
  PriceHistoryEntry,
  Trip,
  TripItem,
} from "../types";

const MAX_SAFE_MONEY = Number.MAX_SAFE_INTEGER / 100;
const CENT_TOLERANCE = 1e-7;

type UnknownRecord = Record<string, unknown>;

export interface ValidatedBasketBackup {
  trips?: Trip[];
  priceHistory?: Record<string, PriceHistoryEntry>;
}

function fail(path: string, expectation: string): never {
  throw new Error(`Invalid backup: ${path} ${expectation}`);
}

function asRecord(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }
  return value as UnknownRecord;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(path, "must be a non-empty string");
  }
  return value;
}

function requiredDate(value: unknown, path: string): string {
  const date = requiredString(value, path);
  if (!Number.isFinite(Date.parse(date))) {
    fail(path, "must be a valid date");
  }
  return date;
}

export function moneyToCents(value: number, path = "amount"): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_SAFE_MONEY
  ) {
    throw new RangeError(`${path} must be a finite, non-negative monetary amount`);
  }
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > CENT_TOLERANCE) {
    throw new RangeError(`${path} must have at most two decimal places`);
  }
  return cents;
}

export function centsToMoney(cents: number): number {
  return cents / 100;
}

export function assertQuantity(value: number, path = "quantity"): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${path} must be a positive whole number`);
  }
  return value;
}

export function calculateLineSubtotal(price: number, quantity: number): number {
  const cents = moneyToCents(price, "price");
  const validQuantity = assertQuantity(quantity);
  const subtotal = cents * validQuantity;
  if (!Number.isSafeInteger(subtotal)) {
    throw new RangeError("line subtotal is too large");
  }
  return centsToMoney(subtotal);
}

export function calculateBasketTotal(
  items: ReadonlyArray<Pick<BasketItem, "price" | "quantity">>,
): number {
  const cents = items.reduce((sum, item, index) => {
    const lineCents = moneyToCents(item.price, `items[${index}].price`) *
      assertQuantity(item.quantity, `items[${index}].quantity`);
    const next = sum + lineCents;
    if (!Number.isSafeInteger(next)) {
      throw new RangeError("basket total is too large");
    }
    return next;
  }, 0);
  return centsToMoney(cents);
}

export function calculateBasketItemCount(
  items: ReadonlyArray<Pick<BasketItem, "quantity">>,
): number {
  return items.reduce((sum, item, index) => {
    const next = sum + assertQuantity(item.quantity, `items[${index}].quantity`);
    if (!Number.isSafeInteger(next)) {
      throw new RangeError("basket item count is too large");
    }
    return next;
  }, 0);
}

export function validateBasketItem(value: unknown, path = "item"): BasketItem {
  const item = asRecord(value, path);
  const price = centsToMoney(moneyToCents(item.price as number, `${path}.price`));
  const quantity = assertQuantity(item.quantity as number, `${path}.quantity`);
  return {
    id: requiredString(item.id, `${path}.id`),
    name: requiredString(item.name, `${path}.name`),
    price,
    quantity,
    ...(item.barcode === undefined
      ? {}
      : { barcode: requiredString(item.barcode, `${path}.barcode`) }),
    ...(item.imageUrl === undefined
      ? {}
      : { imageUrl: requiredString(item.imageUrl, `${path}.imageUrl`) }),
  };
}

function validateTripItem(value: unknown, path: string): TripItem {
  const item = asRecord(value, path);
  const basketItem = validateBasketItem(item, path);
  const subtotal = centsToMoney(
    moneyToCents(item.subtotal as number, `${path}.subtotal`),
  );
  const expectedSubtotal = calculateLineSubtotal(
    basketItem.price,
    basketItem.quantity,
  );
  if (moneyToCents(subtotal) !== moneyToCents(expectedSubtotal)) {
    fail(`${path}.subtotal`, "does not equal price multiplied by quantity");
  }
  return { ...basketItem, subtotal };
}

export function validateTrip(value: unknown, path = "trip"): Trip {
  const trip = asRecord(value, path);
  if (!Array.isArray(trip.items)) fail(`${path}.items`, "must be an array");
  const items = trip.items.map((item, index) =>
    validateTripItem(item, `${path}.items[${index}]`),
  );
  const total = centsToMoney(moneyToCents(trip.total as number, `${path}.total`));
  if (moneyToCents(total) !== moneyToCents(calculateBasketTotal(items))) {
    fail(`${path}.total`, "does not equal the sum of its item subtotals");
  }
  return {
    id: requiredString(trip.id, `${path}.id`),
    date: requiredDate(trip.date, `${path}.date`),
    time: requiredString(trip.time, `${path}.time`),
    store: requiredString(trip.store, `${path}.store`),
    storeIcon: requiredString(trip.storeIcon, `${path}.storeIcon`),
    currency: requiredString(trip.currency, `${path}.currency`),
    total,
    items,
  };
}

export function validatePriceHistoryEntry(
  value: unknown,
  path = "priceHistory entry",
): PriceHistoryEntry {
  const entry = asRecord(value, path);
  return {
    lastPrice: centsToMoney(
      moneyToCents(entry.lastPrice as number, `${path}.lastPrice`),
    ),
    lastStore: requiredString(entry.lastStore, `${path}.lastStore`),
    lastDate: requiredDate(entry.lastDate, `${path}.lastDate`),
    ...(entry.currency === undefined
      ? {}
      : { currency: requiredString(entry.currency, `${path}.currency`) }),
  };
}

export function validateBasketBackup(data: unknown): ValidatedBasketBackup {
  const backup = asRecord(data, "backup");
  if (backup.version !== undefined && backup.version !== 1) {
    fail("backup.version", "must be the supported version 1");
  }
  if (
    backup.exportedAt !== undefined &&
    (typeof backup.exportedAt !== "string" ||
      !Number.isFinite(Date.parse(backup.exportedAt)))
  ) {
    fail("backup.exportedAt", "must be a valid date");
  }
  if (backup.trips === undefined && backup.priceHistory === undefined) {
    fail("backup", "must contain trips or priceHistory");
  }

  let trips: Trip[] | undefined;
  if (backup.trips !== undefined) {
    if (!Array.isArray(backup.trips)) fail("backup.trips", "must be an array");
    trips = backup.trips.map((trip, index) =>
      validateTrip(trip, `backup.trips[${index}]`),
    );
    const ids = new Set<string>();
    for (const trip of trips) {
      if (ids.has(trip.id)) fail("backup.trips", `contains duplicate id "${trip.id}"`);
      ids.add(trip.id);
    }
  }

  let priceHistory: Record<string, PriceHistoryEntry> | undefined;
  if (backup.priceHistory !== undefined) {
    const history = asRecord(backup.priceHistory, "backup.priceHistory");
    priceHistory = {};
    for (const [barcode, entry] of Object.entries(history)) {
      requiredString(barcode, "backup.priceHistory barcode");
      priceHistory[barcode] = validatePriceHistoryEntry(
        entry,
        `backup.priceHistory["${barcode}"]`,
      );
    }
  }
  return { trips, priceHistory };
}

export function mergeValidatedBackup(
  currentTrips: readonly Trip[],
  currentPriceHistory: Readonly<Record<string, PriceHistoryEntry>>,
  backup: ValidatedBasketBackup,
): { trips: Trip[]; priceHistory: Record<string, PriceHistoryEntry> } {
  const existingIds = new Set(currentTrips.map((trip) => trip.id));
  return {
    trips: [
      ...currentTrips,
      ...(backup.trips ?? []).filter((trip) => !existingIds.has(trip.id)),
    ],
    priceHistory: {
      ...currentPriceHistory,
      ...(backup.priceHistory ?? {}),
    },
  };
}