# Milestone 3 — Prescription preview

Implemented in the Expo customer app for mobile and desktop web.

## Customer flow

- Open Prescriptions from navigation, Home, or a prescription-only medicine.
- Select one JPG, PNG, or PDF up to 10 MB. On mobile, the customer may use the device camera. Image files show a preview and expandable full-size image; a selected PDF can be opened in the device or browser. Invalid types, unknown or empty sizes, and oversized files leave the existing record unchanged.
- Inspect the document, manually choose sample catalog request items and quantities, then compare per-item sample stock and estimated item totals for each pharmacy. The sample request is not extracted from the file and is not medical guidance.
- Submit a local record for simulated review. A collapsed review preview can simulate fully approved, partially approved, rejected, and clearer-photo-required outcomes. Partial/rejection/clearer-photo outcomes require a reason.
- For approved items, select quantities up to the reviewed amount and add them from the review record. A replaced file increments its version, clears its approval, and invalidates linked cart items. Stale items block quantity edits and checkout; demo orders preserve their original prescription review reference.

## Boundaries

This is a local functional prototype. Nothing is sent to a pharmacy, and the preview makes no medical or pharmacist decisions. It has no OCR/AI extraction, no actual pharmacist-review console, no clinical advice, and no production upload. Session records clear after reload/restart; mobile file selection may leave a copy in the OS-managed application cache. To remove a selected clinical image from that cache, the user can clear the app cache or storage. Sample medicines, prices, and stock are for interface testing only.

## Verification

- `npm run typecheck`
- `npm test` — 26 tests, including file validation, partial stock, approval quantity and pharmacy binding, file replacement invalidation, and order snapshot/use limits.
- `npm run build:web`
- `node node_modules/expo/bin/cli export --platform android --output-dir dist-android`
- Browser exercised file selection, image preview, review submit, partial outcome with reason, approved item selection, checkout and order confirmation; oversized and unsupported replacement files were rejected, and replacement invalidated old cart approval.

Desktop layout: [prescription-desktop.png](prescription-desktop.png).
