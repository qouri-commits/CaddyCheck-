import assert from "node:assert/strict";
import test from "node:test";

import {
  escapeReceiptHtml,
  isValidGtin,
  normalizeBarcode,
  parseLocalizedDecimal,
  parsePositivePrice,
  parsePositiveQuantity,
  summarizeTripsByCurrency,
} from "../utils/shoppingReceipt.ts";

test("parses Arabic, Persian, comma, and grouped decimal input", () => {
  assert.equal(parseLocalizedDecimal("١٢٫٥٠"), 12.5);
  assert.equal(parseLocalizedDecimal("۱۲,۵"), 12.5);
  assert.equal(parseLocalizedDecimal("1.234,50"), 1234.5);
  assert.equal(parseLocalizedDecimal("1,234.50"), 1234.5);
  assert.equal(parsePositivePrice("-2"), null);
  assert.equal(parsePositivePrice("12abc"), null);
  assert.equal(parsePositivePrice("1.234"), null);
  assert.equal(parsePositivePrice("1000001"), null);
  assert.equal(parsePositivePrice("١٠٫٥٠"), 10.5);
});

test("accepts only bounded positive whole quantities", () => {
  assert.equal(parsePositiveQuantity("٣"), 3);
  assert.equal(parsePositiveQuantity("1.5"), null);
  assert.equal(parsePositiveQuantity("0"), null);
  assert.equal(parsePositiveQuantity("10000"), null);
});

test("normalizes and validates GTIN check digits", () => {
  assert.equal(normalizeBarcode(" ٤٠٠-٦٣٨١ ٣٣٣٩٣١ "), "4006381333931");
  assert.equal(isValidGtin("4006381333931"), true);
  assert.equal(isValidGtin("4006381333932"), false);
  assert.equal(isValidGtin("not-a-barcode"), false);
});

test("escapes receipt HTML content", () => {
  assert.equal(
    escapeReceiptHtml(`<img src=x onerror="bad()"> Tom & Jerry's`),
    "&lt;img src=x onerror=&quot;bad()&quot;&gt; Tom &amp; Jerry&#39;s"
  );
});

test("keeps currency totals and averages separate", () => {
  assert.deepEqual(
    summarizeTripsByCurrency([
      { total: 10, currency: "EUR" },
      { total: 20, currency: "EUR" },
      { total: 100, currency: "MAD" },
    ]),
    [
      { currency: "EUR", total: 30, average: 15, tripCount: 2 },
      { currency: "MAD", total: 100, average: 100, tripCount: 1 },
    ]
  );
});