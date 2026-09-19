# CaddyCheck — Gumroad upload checklist

## Product setup

- Product type: Digital product
- Product name: CaddyCheck — Smart Shopping Calculator & Live Basket Sharing
- Suggested launch price: 4.99 USD
- Currency: USD
- Product visibility: Public
- File delivery: Upload the final Android APK
- Suggested APK filename: `CaddyCheck-1.0.1.apk`

## Files to upload

Upload these files as a ZIP or as separate files:

1. `CaddyCheck-1.0.1.apk`
2. `CaddyCheck-Quick-Start-AR.md` or a PDF version of the Arabic guide
3. `CaddyCheck-Quick-Start-EN.md` or a PDF version of the English guide
4. `CaddyCheck-Release-Notes.md`

The APK is not included in this repository package until an Android production build has been generated. Do not publish the Gumroad product with a placeholder or source-code file in place of the APK.

## Gumroad description fields

- Copy the Arabic product copy from `GUMROAD_LISTING_AR.md` when selling to Arabic-speaking customers.
- Copy the English section from the same file for an English listing.
- Use the first paragraph as the short description.
- Use the feature list and full description as the product body.
- Add the keywords at the bottom as product tags where supported.

## Recommended product images

Prepare 4–6 screenshots:

1. Empty basket with the main add button.
2. Basket with products, quantities, total, and budget progress.
3. Barcode scan screen.
4. Live sharing screen showing the session code.
5. Receipt comparison screen.
6. Archive or price comparison screen.

Use screenshots that do not show real names, phone numbers, session codes, or private shopping information.

## Before publishing

- Install the APK on at least one physical Android device.
- Test barcode permission and manual product entry.
- Test adding products, editing values, and removing products.
- Test live sharing with two devices or two app instances.
- Test a reminder from the viewer and completion by the shopper.
- Test receipt comparison and saving a trip.
- Test backup export and restore.
- Confirm the API health endpoint is available:
  `https://global-shopping-calculator--specialmen100.replit.app/api/healthz`
- Confirm the production APK uses the production API, not a `replit.dev` development URL.
- Confirm the version is 1.0.1 and Android version code is 2.

## Buyer message after purchase

Thank you for purchasing CaddyCheck.

Download the APK and the quick-start guide from this purchase. Install the APK on Android, open the app, choose your language, and follow the onboarding steps.

Barcode scanning needs camera permission. Product lookup and live basket sharing need an internet connection.

For support, send the app version, Android device model, Android version, and a short description of the issue. Do not send passwords, payment details, or live session codes.

## Refund policy text

Because this is a digital APK download, refunds are handled according to the seller’s Gumroad policy and applicable local law. If the file is corrupted or cannot be installed, contact support with the device model and Android version so the issue can be investigated.

## Important ownership and support note

The product includes the Android application build and user-facing guides. It does not include ownership of the CaddyCheck brand, the Replit workspace, the production API infrastructure, OpenFoodFacts, Google Play publishing rights, or third-party service accounts unless a separate written agreement says otherwise.
