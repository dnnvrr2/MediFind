# Customer preview validation

Validated on October 20, 2026.

- `npm test`: 4 passing behavior tests covering search, totals, item merging, stock limits, pharmacy replacement, invalid quantities, and prescription-only restrictions.
- `npm run typecheck`: passed.
- `npm run build:web`: passed after final changes.
- Android JavaScript/Hermes export: passed after final changes. This is a bundle check, not an APK build or physical-device test.
- Browser checks at desktop size and 390 × 844: Home → Search → Medicine → Availability → Cart; five tablets at PHP 5 gave PHP 25; pharmacy switching displayed confirmation and replaced the cart only after confirmation; removing the final item displayed the empty state.
- No-results recovery and prescription filtering worked. Prescription-only availability had no Add to Cart action.
- Out-of-stock pharmacy selection was disabled; selected pharmacy and active navigation exposed their checked/selected accessibility state.
- Pharmacy list and details opened correctly. Fixed active pharmacy navigation for detail screens.

Preview images: `customer-home-mobile.png` and `customer-home-desktop.png` in this folder.

Remaining: checkout and order flow, prescription upload/review, accounts, live data/API, cart persistence, location selection, and physical Android/iOS testing. No actual orders or payments are accepted.
