# Online Medicine Search and Ordering System

## Customer preview — first milestone

The Expo frontend runs on Android/iOS and in desktop/mobile browsers. It follows the customer sample screens with a teal theme, responsive cards, explicit pharmacy selection, unit prices, and one pharmacy per cart.

### Run

- Double-click `Start Customer Website.cmd` to open the browser version.
- Double-click `Start Mobile App.cmd` to start Expo for testing on a phone. The phone and computer should use the same Wi-Fi network. Use an Expo Go version compatible with the installed Expo SDK, or a development build.
- From `frontend/`: `npm run web` or `npm start`.
- Dependencies are installed. On another computer, install Node.js 24 LTS and run `npm ci` inside `frontend/` first.

### Implemented

- Home with medicine search and quick searches.
- Search by name, generic, strength, and form, with OTC/prescription filters and a no-results state.
- Medicine details, with exact strength, form, and sales unit.
- Pharmacy availability with explicit selection, stock, unit price, quantity, and subtotal.
- Pharmacy list and details with medicine listings.
- Shopping cart with quantities, removal, subtotal, stock limits, and confirmed replacement when switching pharmacy.
- Checkout with pickup/delivery, recipient validation, editable delivery address, fees, payment labels, and a review step.
- Demo order submission and confirmation, Current/Previous order lists, stored order details, separate pickup/delivery tracking, confirmed cancellation, and simulated rejection/delivery failure with reasons.
- Prescription history and local JPG/PNG/PDF file selection with image preview, full-size inspection, local PDF opening, file replacement, and a mobile camera option.
- Sample request items are selected manually and clearly separated from uploaded files. Pharmacy availability is shown per item with estimated totals and partial stock.
- Pending review and simulated approved, partially approved, rejected, and clearer-photo states with reasons. Approved medicine, quantity, pharmacy, and file version are checked in the cart and checkout; orders keep the review reference.
- Home, Prescriptions, Cart, Orders, and Profile navigation on mobile and desktop. Pharmacy browsing remains available from Home and medicine search.
- Profile overview, edit profile, demo sign-in, demo registration, and password-reset confirmation screens.
- Responsive desktop navigation and mobile bottom navigation.
- Unknown medicine/pharmacy/page fallbacks.

### Preview boundaries

All pharmacies, stock, classifications, hours, and prices are sample data, not verified live listings. No real orders, payments, authentication, location lookup, clinical dosing advice, or backend connections are implemented. Prescription files remain only in the app session and mobile OS cache; they are not transmitted. Simulated review buttons never represent pharmacist or medical approval. A real pharmacist must verify every prescription and item before fulfillment. Cart, checkout draft, and demo-order state are in memory and clear on browser refresh or app restart. The shared data lives in `frontend/src/data/catalog.ts`.

### Structure

```
frontend/
  src/
    app/           # Expo Router screens and navigation
    components/    # Shared controls and visual styles
    data/          # Typed sample catalog
    domain/        # Stock and cart rules
    state/         # Session state for cart, checkout, orders, and prescriptions
  tests/           # Search, cart, checkout, order, and prescription checks
backend/           # Reserved for Django API
database/          # Reserved for database planning/data
docs/
sample_screens/    # Original design references
```

Django's own migrations will live with its apps when backend implementation starts. The earlier empty backend route/controller folders are placeholders, not the final Django layout.

### Validate

In `frontend/`:

```
npm test
npm run typecheck
npm run build:web
```

Prescription flow implementation is in `docs/MILESTONE_3_PRESCRIPTIONS.md`. AI recognition is excluded. Checkout and simulated orders are complete for this preview; see docs/MILESTONE_1_CHECKOUT.md and docs/MILESTONE_2_ORDERS.md. The next milestone is customer account/profile screens and persistent sessions, followed by the Django/PostgreSQL backend.


## Customer design update

The existing customer screens now use locally bundled Inter fonts, the custom SVG icons, a compact search-focused Home, and medicine/pharmacy rows with separators. See docs/DESIGN_UPDATE.md for the changes, validation, and device-testing limits. Edit icons in frontend/assets/svg and run node scripts/sync-icons.mjs from frontend to refresh the registry.
