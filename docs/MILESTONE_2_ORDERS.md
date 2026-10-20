# Milestone 2: simulated orders

Completed in the Expo customer preview on October 20, 2026.

## Customer flow

Cart -> checkout details -> checkout review -> Place demo order -> confirmation -> tracking or order details -> My Orders.

The submission revalidates the current cart and recipient/address before creating an order. It stores a separate snapshot of pharmacy, exact medicine name/strength/form, quantity, unit price, recipient, fulfillment address, payment label, subtotal, fee and total. Later changes to the cart, draft address or catalog do not change an existing order. The cart clears only after success; the checkout contact/address draft remains available for the next checkout. A repeated submission key returns the same record, and synchronous guards prevent duplicate taps from creating duplicate orders.

## Screens and behavior

- Confirmation shows the real local demo ID, the same checkout information and total, and links to tracking/details.
- My Orders has Current and Previous tabs. Collected, delivered, cancelled, rejected and delivery-failed records are closed and appear under Previous.
- Order details show stored items, recipient, address/pickup location, fees, payment and status history.
- Tracking separates pickup and delivery timelines. Pickup ends with Ready for pickup -> Collected. Delivery ends with Out for delivery -> Delivered.
- Cancellation requires a confirmation dialog and is available only while awaiting pharmacy confirmation. It records an optional reason and does not overwrite or refill the customer's cart.
- Rejection and delivery-failure outcomes require reasons and show those reasons on tracking and details.
- Explicit, collapsed-by-default Preview status controls simulate pharmacy/rider updates. No timers, background changes, real messages or automatic dispatch are used.
- Invalid transitions are rejected, completed orders cannot restart, and failure/rejection is allowed only at the appropriate stage.
- Back returns active orders to Current and closed orders to Previous. Unknown/missing demo IDs have a session-expiry explanation and My Orders recovery action.
- Four working navigation destinations: Home, Pharmacies, Cart, Orders. Profile and prescription tabs remain later milestones.

## Checks

- All 17 behavior tests passed: 9 existing cart/search/checkout tests and 8 order tests.
- TypeScript passed after refreshing Expo's generated route types.
- Final production web and Android JavaScript/Hermes exports passed. Android export is not an APK or physical-device test.
- Browser: initial empty history, pickup submission, cart clearing, correct confirmation values, cancellation Keep/Confirm, pickup progression to Collected, cancellation disabled after confirmation, delivery dispatch and failure with required reason, pharmacy rejection with reason, correct Previous filtering, stored details, and Back behavior.
- Browser order list checked at 320 px with no horizontal page overflow; history/details also inspected at phone sizes and desktop. Native keyboards, screen readers and physical Android/iOS devices remain untested.

## Demo limitations

Orders and status history exist only in the running app session. Refreshing/restarting clears them. No pharmacy receives an order, no stock is reserved, no rider is dispatched and no payment is collected. Delivery prices remain explicitly sample fees. Server permissions, persistent storage, inventory transactions and live notifications belong to backend integration.

The browser test session includes generated example orders to inspect; the app does not seed fake history on startup.

Screenshots in docs: orders-desktop.png, orders-mobile.png, order-details-mobile.png. Build logs: milestone-2-web-build.log and milestone-2-android-build.log.

Next milestone: prescription history, upload with preview/replace, pharmacy selection and review submission, per-medicine availability, approval/partial/rejected/clearer-photo outcomes, and review of approved quantities before checkout. AI recognition is excluded initially.
