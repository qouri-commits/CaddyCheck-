# CaddyCheck — Privacy release readiness

**Status: NOT READY FOR STORE SUBMISSION**

This checklist records verified behavior and unresolved release facts. It is not legal approval.

## Verified from current source

- Core shopping data and preferences use local AsyncStorage.
- A barcode is sent to `world.openfoodfacts.org` only after an explicit scan/manual lookup that needs a network lookup. The request identifies `CaddyCheck/1.0`.
- Live sharing is opt-in. It sends the entered host name, currency, basket names/prices/quantities/barcodes/image links, and reminders to the configured CaddyCheck API.
- Shared sessions are database-backed, readable by anyone with the six-character code, expire 12 hours after creation/latest basket update, and can be deleted by the host token.
- The reviewed client has no advertising SDK or arbitrary analytics upload. Recheck the exact signed release and dependency manifest.
- Exported JSON includes saved trips, price history, export time, and schema version. Import merges supported trips/history.
- “Delete shopping data” uses the existing core clear operation. It clears basket, trips, price history, product cache, budget, store history/custom stores, and local session details, and attempts to delete an active hosted session. It keeps language, currency, region, theme, onboarding, and tips preferences.

## Blocking facts — publisher must provide/verify

- [x] Publisher display name supplied by the user: **Vanitas**. Confirm any additional legal-entity details required for store registration separately.
- [x] Privacy/support contact supplied by the user: **yanvanitas@gmail.com**. Mailbox ownership/delivery and continued monitoring have not been independently tested.
- [x] Draft last updated: **19 September 2026**; becomes effective on final publication.
- [ ] Final legally reviewed Arabic and English policy text (and French if distributed where required).
- [ ] Public HTTPS privacy-policy URL, accessible without login and verified from target countries.
  - Prepared route: `/privacy.html` (also `/privacy` on the production server). The deployment URL was verified through deployment information, but the new page is not published yet. Do not submit a draft or an unverified URL to the store.
- [ ] Identity, privacy terms, processing locations, and retention/backups of the production API, database, hosting, and logging providers.
- [ ] Production API hostname and HTTPS/TLS behavior in the exact signed build.
- [ ] Whether platform/cloud device backups copy AsyncStorage and what user controls apply.
- [ ] OpenFoodFacts terms/privacy policy reviewed and linked in the final policy.
- [ ] Google Play Data safety and Apple privacy answers reconciled with the exact release binary and server behavior.
- [ ] Child-directed audience decision, age rating, target countries, and jurisdiction-specific legal review.
- [ ] Confirm server log configuration in production and document IP/user-agent retention, access, and deletion handling.
- [ ] End-to-end deletion test, including the offline-server case and natural 12-hour session expiry.

## Required release checks

- [ ] Replace every `[MISSING ...]` field in both privacy drafts.
- [ ] Ensure in-app wording and store disclosures match the deployed release.
- [ ] Test privacy/help and onboarding with screen readers in Arabic RTL, French, and English.
- [ ] Test backup cancellation, malformed/unsupported schema, oversized file, unreadable file, repeated taps, successful merge, and export failure on Android/iOS/web.
- [ ] Re-audit dependencies and all network requests after the release bundle is frozen.

Do not mark the app store-ready until every blocking fact and required release check is resolved.