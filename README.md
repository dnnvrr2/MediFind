# Online Medicine Search and Ordering System

## MediFind

MediFind connects customers, pharmacies, staff, and riders. The Expo frontend runs on Android, iOS, and the web.

### Run

- In the primary Desktop checkout, double-click `Start MediFind Local.cmd` to start both servers. The backend uses port 8001 and the frontend uses port 8081; `frontend/.env` sets `EXPO_PUBLIC_API_PORT=8001` for direct Expo commands as well. Native development still detects the computer's LAN address automatically. Restart Expo after changing API configuration.
- Double-click `Start Customer Website.cmd` to open the browser version.
- Double-click `Start Mobile App.cmd` to start Expo for testing on a phone. The phone and computer should use the same Wi-Fi network. Use an Expo Go version compatible with the installed Expo SDK, or a development build.
- From `frontend/`: `npm run web` or `npm start`.
- Dependencies are installed. On another computer, install Node.js 24 LTS and run `npm ci` inside `frontend/` first.

### Implemented

Pharmacy inventory supports owner-configured Manual updates and CSV imports. Open **Inventory → Stock settings** to configure the method, download a template, and preview imports before applying them. See [Stock updates](docs/STOCK_UPDATES.md) for matching rules and reservation protection.

- Home with medicine search and participating pharmacies.
- Search by name, generic, strength, and form, with OTC/prescription filters and a no-results state.
- Medicine details, with exact strength, form, and sales unit.
- Pharmacy availability with explicit selection, stock, unit price, quantity, and subtotal.
- Pharmacy list and details with medicine listings.
- Shopping cart with quantities, removal, subtotal, stock limits, and confirmed replacement when switching pharmacy.
- Checkout with pickup/delivery, recipient validation, editable delivery address, fees, payment labels, and a review step.
- Pharmacy order submission, pickup and delivery tracking, and cancellation before pharmacy acceptance.
- Private prescription uploads, pharmacist review, and ordering of approved items.
- Account registration, sign-in, profile editing, and password resets.
- Rider applications, staff approval, and delivery dispatch.

The catalog comes from approved pharmacy records and inventory in PostgreSQL. Each signed-in account's cart is saved on the current device. Checkout details are kept for the current session. Payment is collected at pickup or delivery.

### Structure

```
frontend/
  src/
    app/           # Expo Router screens and navigation
    components/    # Shared controls and visual styles
    data/          # Pharmacy catalog
    domain/        # Stock and cart rules
    state/         # Session state for cart, checkout, orders, and prescriptions
  tests/           # Search, cart, checkout, order, and prescription checks
backend/           # Django API, account/order data, rider authorization and dispatch
database/          # Reserved for database planning/data
docs/
sample_screens/    # Original design references
```

Backend setup and API notes are in `backend/README.md`; rider workflow instructions are in `docs/RIDER_PORTAL.md`.

### Validate

In `frontend/`:

```
npm test
npm run typecheck
npm run build:web
```

See the backend API notes for current ordering and prescription behavior.


## Customer design update

The existing customer screens now use locally bundled Inter fonts, the custom SVG icons, a compact search-focused Home, and medicine/pharmacy rows with separators. See docs/DESIGN_UPDATE.md for the changes, validation, and device-testing limits. Edit icons in frontend/assets/svg and run node scripts/sync-icons.mjs from frontend to refresh the registry.

## Rider portal

Riders sign in at `/rider/login`. Staff approve rider applications, and dispatch assigns riders after the pharmacy confirms the order is ready. See [Rider portal](docs/RIDER_PORTAL.md) for the delivery workflow.
