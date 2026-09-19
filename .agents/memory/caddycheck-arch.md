---
name: CaddyCheck Architecture & Key Decisions
description: Key technical decisions, fixes applied, and conventions for the CaddyCheck Expo app
---

## Stack
Expo SDK 54, expo-router v6, TypeScript strict, AsyncStorage, pnpm monorepo (artifacts/caddycheck)

## Theme / Dark Mode
- Theme ("system"|"light"|"dark") stored in LanguageContext, persisted to `caddycheck_theme`
- useColors() reads theme from LanguageContext (not useColorScheme directly)
- constants/colors.ts has both `light` and `dark` palettes

## Currencies
- CURRENCY_SYMBOLS map in LanguageContext: MAD, USD, EUR, GBP, TND, DZD, SAR, AED
- Settings shows 6 chips: MAD, TND, DZD, EUR, GBP, USD
- Always use currencySymbol from useLanguage(), never t("currency") for amounts

## Key Bugs Fixed
- AddProductModal used t("currency") for price display → fixed to currencySymbol
- Delete All Data only cleared AsyncStorage, not React state → clearAll() in BasketContext clears both
- dataSharing toggle was not persisted → saved to caddycheck_data_sharing
- PDF export hardcoded Arabic headers → now language-aware via t("pdfProduct") etc.
- scan.tsx product name always Arabic-first → pickProductName(p, lang) helper respects current language

## Features Added
- Dark mode toggle in Settings (Appearance section with 3 chips)
- Shopping stats card in Archive (total spent, avg/trip, top store)
- WhatsApp share button (Archive per-trip + Compare screen); falls back to Share.share()
- storeIcon from trip data shown in TripRow (was always generic storefront-outline)
- trip.currency shown in TripRow (shows currency at time of purchase, not current currency)

## AsyncStorage Keys
app_language, user_language, app_currency, caddycheck_currency, caddycheck_theme,
caddycheck_budget, caddycheck_basket, caddycheck_trips, caddycheck_price_history,
caddycheck_product_cache, onboarded, caddycheck_data_sharing, user_stores

## EAS Build
- Account: yakt, project ID: 90240960-24c1-4103-bab3-c1269d6a9ce1
- EAS CLI install: npm install -g eas-cli --registry https://registry.npmjs.org (Replit proxy blocks default registry)
- EXPO_TOKEN set as Replit secret

## Expo SDK alignment
- Keep Expo modules on the SDK 54-compatible versions reported by `expo install --check`; SDK 55 module versions can pass TypeScript while breaking native compatibility.
- The project should not keep `eas-cli` as a local dependency; the GitHub workflow can install its own CLI when explicitly used.
