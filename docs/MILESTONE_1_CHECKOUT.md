# Milestone 1: checkout and addresses

Implemented October 20, 2026 in the existing Expo customer app.

## Working flow

Cart -> Proceed to checkout -> pickup/delivery and recipient details -> add/edit delivery address when needed -> Review checkout.

- The cart's selected pharmacy, exact medicine strengths/forms, sales units, quantities, and unit prices carry into checkout. No duplicate sample order data is introduced.
- Pickup has a zero fee and Pay at Pharmacy. Delivery has a clearly labelled flat sample fee of PHP 50 and Cash on Delivery. No card or online-payment fields are presented.
- Full name and a valid Philippine mobile number are required for both methods. Local 09, +639, and 639 formats are accepted, including common visual separators.
- Delivery requires house/building and street, barangay, city/municipality, and province. Postal code is optional but must be four digits if supplied.
- Address edits are isolated until Save. Cancel preserves the previous saved address. An address saved here is only a checkout-session value, not a persistent account address book.
- Contact, address, and fulfillment selections survive internal navigation, editing the cart, and switching between pickup and delivery. New cart quantities recalculate the summary. Browser refresh/app restart clears all session-only state.
- Review shows the same recipient, pharmacy, medicine lines, address or pickup location, payment, fee, and total. Back returns to details without losing the draft. Order submission is explicitly unavailable in this milestone.
- Empty or invalid carts cannot reach review. Checkout rechecks single-pharmacy ownership, item existence, stock bounds, duplicate entries, and prescription restrictions against the sample catalog.

## Validation

- TypeScript check passed.
- All 9 domain/behavior tests passed: 4 existing cart/search tests plus 5 checkout tests.
- Final production web export passed.
- Final Android JavaScript/Hermes export passed. This is not an APK/device test.
- Browser: empty checkout guard; missing name/phone and invalid phone focus/validation; incomplete address rejection; address Save/Edit/Cancel; pickup/delivery switching; review and Back; cart edit and return with preserved draft.
- Five PHP 5 tablets: pickup PHP 25, delivery PHP 75. After increasing to six tablets, subtotal became PHP 30 and delivery total PHP 80.
- Desktop and 390 px / 320 px phone browser layouts checked. No horizontal page overflow at 320 px. Physical Android/iOS keyboards, screen readers, and larger system font settings still need device testing.

## Scope and next milestone

No real orders, stock reservations, payment collection, address verification, or delivery-coverage checks occur. No backend or persistent storage has been added. The delivery fee is an example rather than a verified price. Prescription-only checkout remains blocked.

Next milestone: simulated order submission and consistent confirmation, order history/details, delivery versus pickup progress, cancellation confirmation/outcomes, and failure/rejection states. Keep these visibly simulated until backend integration.

Screenshots in docs: checkout-review-desktop.png and checkout-review-mobile.png.
