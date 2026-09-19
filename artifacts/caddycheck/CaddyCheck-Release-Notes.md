# CaddyCheck 1.0.1 — Release Notes

## Included in this release

- Faster and more reliable live basket sharing.
- The current basket is sent immediately when a sharing session starts.
- Automatic retry when basket synchronization temporarily fails.
- Protection against older synchronization results overwriting newer changes.
- Safe reminder creation when multiple people add reminders at the same time.
- Session-expiry protection for basket updates and reminders.
- Cleanup of active polling and retry timers when a session ends.
- Web preview startup fallback so the app does not remain on a blank screen while fonts load.
- Clear validation when a product name or valid price is missing.
- Barcode-specific placeholder for manual web entry.
- Timeout protection for OpenFoodFacts product lookup.
- Working JSON backup download on web.
- Arabic, English, and French product-facing text.
- Production Android configuration uses the published CaddyCheck API.

## Known limitations

- Barcode scanning requires camera permission and a compatible Android device.
- Product names and images depend on OpenFoodFacts availability.
- Live sharing requires internet access.
- The app does not process payments or connect to a bank account.
- Shopping prices are entered by the user and are not independently verified.

## Product identity

- App: CaddyCheck
- Android package: `com.caddycheck.app`
- Version: `1.0.1`
- Android version code: `2`
