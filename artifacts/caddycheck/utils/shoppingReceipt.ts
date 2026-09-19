const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeLocalizedDigits(value: string): string {
  return Array.from(value, (character) => {
    const arabicIndex = ARABIC_DIGITS.indexOf(character);
    if (arabicIndex >= 0) return String(arabicIndex);
    const persianIndex = PERSIAN_DIGITS.indexOf(character);
    return persianIndex >= 0 ? String(persianIndex) : character;
  }).join("");
}

export function parseLocalizedDecimal(value: string): number | null {
  let normalized = normalizeLocalizedDigits(value)
    .trim()
    .replace(/[\s\u00A0\u202F]/g, "")
    .replace(/٬/g, "")
    .replace(/٫/g, ".");

  if (!normalized || /^[+-]/.test(normalized)) return null;

  const commaCount = (normalized.match(/,/g) ?? []).length;
  const dotCount = (normalized.match(/\./g) ?? []).length;
  if (commaCount && dotCount) {
    const decimalSeparator = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized.split(groupingSeparator).join("");
    normalized = normalized.replace(decimalSeparator, ".");
  } else if (commaCount === 1) {
    normalized = normalized.replace(",", ".");
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePositivePrice(value: string): number | null {
  const parsed = parseLocalizedDecimal(value);
  return parsed !== null && parsed > 0 && parsed <= 1000000 &&
    Math.abs(parsed * 100 - Math.round(parsed * 100)) < 0.000001 ? parsed : null;
}

export function parsePositiveQuantity(value: string): number | null {
  const normalized = normalizeLocalizedDigits(value).trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 9999 ? parsed : null;
}

export function normalizeBarcode(value: string): string {
  return normalizeLocalizedDigits(value).trim().replace(/[\s-]/g, "");
}

export function isValidGtin(value: string): boolean {
  const barcode = normalizeBarcode(value);
  if (!/^\d+$/.test(barcode) || ![8, 12, 13, 14].includes(barcode.length)) return false;
  const digits = barcode.split("").map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

export function escapeReceiptHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CurrencySummary {
  currency: string;
  total: number;
  average: number;
  tripCount: number;
}

export function summarizeTripsByCurrency(
  trips: ReadonlyArray<{ total: number; currency: string }>
): CurrencySummary[] {
  const groups = new Map<string, { total: number; tripCount: number }>();
  for (const trip of trips) {
    if (!Number.isFinite(trip.total)) continue;
    const currency = trip.currency.trim() || "—";
    const current = groups.get(currency) ?? { total: 0, tripCount: 0 };
    current.total += trip.total;
    current.tripCount += 1;
    groups.set(currency, current);
  }
  return Array.from(groups, ([currency, group]) => ({
    currency,
    total: group.total,
    average: group.total / group.tripCount,
    tripCount: group.tripCount,
  })).sort((a, b) => a.currency.localeCompare(b.currency));
}