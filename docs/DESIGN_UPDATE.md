# Customer UI design update

Implemented in the existing Expo customer preview on October 20, 2026.

## Changes

- Bundled Inter Regular, Medium, SemiBold, and Bold TTF files in frontend/assets/fonts, with the original font license. No Google Fonts CDN requests. The app waits for fonts to load and falls back to platform text if loading fails.
- Shared typography maps semantic weights to the actual font files. Screen titles use 24 px; body/input text 16 px; secondary text 14 px; navigation and badges 12 px. Prices use tabular numbers.
- Integrated the original SVG assets through react-native-svg on native and web. Decorative icons are excluded from the accessibility tree; actions retain descriptive labels. The registry can be rebuilt with node scripts/sync-icons.mjs.
- Replaced the promotional Home hero with medicine search, quick searches, a clearly labelled sample area, and direct medicine/pharmacy listings.
- Consolidated medicine and pharmacy listings into rows with separators. Reduced rounding, card repetition, uppercase copy, and decorative color.
- Refined medicine detail hierarchy, pharmacy selection borders/checkmarks, unit prices, stock labels, cart quantities, removal controls, and the empty-cart illustration.
- Desktop Home uses two listing columns; desktop Cart uses an item column and a separate summary. Mobile retains bottom navigation.

## Verification

- TypeScript: passed.
- Existing search/cart behavior tests: 4 passed.
- Production web export: passed; contains exactly four local Inter font assets.
- Android JavaScript/Hermes export: passed with fonts and SVG support. This is not an APK or physical-device test.
- Browser verified all four Inter families loaded and heading computed font was Inter_700Bold.
- Phone layout inspected at 390 px and 320 px. Long compound medicine names and strengths wrapped; cart had no horizontal page overflow.
- Confirmed five PHP 5 tablets produce PHP 25; cancelling a pharmacy switch preserves the cart; confirming it replaces the pharmacy/items; six PHP 5.50 tablets produce PHP 33 and the increase control is disabled at the stock limit.
- Item removal showed the new SVG empty-cart state. Prescription-only listings still had no Add to Cart action. Pharmacy details kept the correct active navigation tab.

## Boundaries

Location selection, verified pharmacy details/live stock timestamps, prescription processing, checkout, accounts, and backend integration remain later functional milestones. No fake distances, live updates, or working location picker were added. Large system font settings and Android/iOS device rendering still require physical-device testing; text scaling has not been disabled.

Screenshots: customer-home-mobile-redesign.png and customer-home-desktop-redesign.png in docs.
