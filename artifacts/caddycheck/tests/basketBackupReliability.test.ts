import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBasketTotal,
  calculateLineSubtotal,
  mergeValidatedBackup,
  validateBasketBackup,
} from "../utils/basketBackupReliability";
import type { Trip } from "../types";

const trip: Trip = {
  id: "trip-1",
  date: "2026-09-19",
  time: "10:30",
  store: "Market",
  storeIcon: "cart",
  total: 0.3,
  currency: "MAD",
  items: [
    {
      id: "item-1",
      name: "Item",
      price: 0.1,
      quantity: 3,
      subtotal: 0.3,
    },
  ],
};

test("money calculations use integer cents", () => {
  assert.equal(calculateLineSubtotal(0.1, 3), 0.3);
  assert.equal(
    calculateBasketTotal([
      { price: 0.1, quantity: 1 },
      { price: 0.2, quantity: 1 },
    ]),
    0.3,
  );
});

test("quantities and monetary precision are rejected", () => {
  assert.throws(() => calculateLineSubtotal(1, 1.5), /positive whole number/);
  assert.throws(() => calculateLineSubtotal(Number.NaN, 1), /finite/);
  assert.throws(() => calculateLineSubtotal(1.001, 1), /two decimal places/);
});

test("valid backup preserves trip currency and normalizes money", () => {
  const validated = validateBasketBackup({
    version: 1,
    exportedAt: "2026-09-19T10:30:00.000Z",
    trips: [trip],
    priceHistory: {
      "123": {
        lastPrice: 12.5,
        lastStore: "Market",
        lastDate: "2026-09-19T10:30:00.000Z",
        currency: "MAD",
      },
    },
  });
  assert.equal(validated.trips?.[0].currency, "MAD");
  assert.equal(validated.trips?.[0].total, 0.3);
  assert.equal(validated.priceHistory?.["123"].currency, "MAD");
});

test("legacy price history without currency remains importable", () => {
  const validated = validateBasketBackup({
    priceHistory: {
      "123": {
        lastPrice: 12.5,
        lastStore: "Market",
        lastDate: "2026-09-19T10:30:00.000Z",
      },
    },
  });
  assert.equal(validated.priceHistory?.["123"].currency, undefined);
  assert.throws(
    () =>
      validateBasketBackup({
        priceHistory: {
          "123": {
            lastPrice: 12.5,
            lastStore: "Market",
            lastDate: "2026-09-19T10:30:00.000Z",
            currency: "",
          },
        },
      }),
    /priceHistory\["123"\]\.currency/,
  );
});

test("malformed backup is rejected as a whole with an actionable path", () => {
  assert.throws(
    () =>
      validateBasketBackup({
        trips: [
          trip,
          {
            ...trip,
            id: "trip-2",
            items: [{ ...trip.items[0], quantity: 0 }],
          },
        ],
        priceHistory: {},
      }),
    /backup\.trips\[1\]\.items\[0\]\.quantity/,
  );
  assert.throws(
    () => validateBasketBackup({ trips: [{ ...trip, total: 99 }] }),
    /backup\.trips\[0\]\.total/,
  );
  assert.throws(() => validateBasketBackup({ arbitrary: true }), /must contain/);
});

test("merge keeps existing trips and deterministically imports new data", () => {
  const imported = validateBasketBackup({
    trips: [trip, { ...trip, id: "trip-2", currency: "EUR" }],
    priceHistory: {},
  });
  const merged = mergeValidatedBackup([trip], {}, imported);
  assert.deepEqual(merged.trips.map(({ id }) => id), ["trip-1", "trip-2"]);
  assert.equal(merged.trips[1].currency, "EUR");
});