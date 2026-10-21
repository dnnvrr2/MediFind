# Screen and workflow conflict review

Reviewed 21 October 2026 against the current local working tree, including unpushed changes.

Scope: guest browsing and account entry; customer catalog, cart, checkout, orders, tracking, prescriptions and profile; pharmacy onboarding, documents, contacts, opening hours, inventory, reviews, orders, invitations and profile; staff review screens and Django dispatch; rider dashboard, assignments, delivery details, issues and profile; shared navigation, authentication and state providers. This is a source and workflow review with automated checks and isolated API reproductions. Desktop and native screens were not exhaustively inspected visually.

P1 means a blocker or material data/access risk. P2 means a workflow or consistency defect. Reproductions used disposable in-memory/test databases, not the user's saved accounts and orders.

## Remediation implemented locally

All 14 findings below have corresponding fixes in the current working tree. The original findings are retained as the audit history.

| Finding | Resolution |
| --- | --- |
| 1 | Private providers remount per account/session generation; late API responses are rejected. |
| 2 | Expo Crypto UUID per checkout attempt; frontend and backend reject mismatched key reuse. |
| 3 | Cart and prescription detail handle missing catalog records without dereferencing them. |
| 4 | Admin and pharmacy use the same readiness/reservation-checked assignment service and saved amount due. |
| 5 | Status edits are read-only in Django admin; explicit dispatch actions and rider updates use validated shared transitions. |
| 6 | Public authentication omits bearer headers, server public auth views ignore old tokens, renewals are shared, and expiry clears profile state. |
| 7 | Invitation acceptance requires a random owner-supplied code as well as matching email; codes rotate and are consumed. |
| 8 | Guarded order refresh lives in the shared provider, including the list and tracking screens. |
| 9 | Pharmacy details derive the current row from its selected ID. |
| 10 | Pending prescription records override polling until acknowledgement; failed saves retain files/edits and offer Retry sync. |
| 11 | Shared information pages retain the signed-in role's navigation. |
| 12 | Delivery issue, retry, collection, return-in-progress, and completed return have explicit states shared across portals. |
| 13 | Approved pharmacy directory entries are loaded independently of inventory. |
| 14 | Managed prescription badges and submit labels use pharmacist wording; sample controls retain demo labels. |

Additional fix: Django's template directory now includes `backend/templates`, so dispatch renders both validation errors and its custom form.

Validation after remediation: 59 frontend tests and 24 backend tests passed; TypeScript and web export passed. Tests cover rotating-token races, stale-account responses, unsynced record merges, replayed order keys, dispatch readiness, code/proof/cash delivery completion, stock consumed once, admin status controls, empty pharmacy listings, invitation renewal/consumption, and emailed reset links. No existing managed orders or rider assignments were present in the local database when checked; no order-history repair was needed. Native screens have not received exhaustive manual visual testing.

Pending local files remain in memory until saved; a full browser refresh/app restart or sign-out still discards unsaved files. The sync error message states this explicitly. Invitation codes are shared manually by the owner; no email is automatically sent.

## P1 findings

### 1. Account changes retain another account's cart and recipient/address draft

Evidence: `frontend/src/state/cart.tsx:5`, `frontend/src/state/checkout.tsx:8`, and provider placement at `frontend/src/app/_layout.tsx:88`.

Trigger: account A adds items and enters a recipient/address, signs out, then account B signs in in the same app instance. Neither provider observes account changes or clears its state, and both remain mounted outside ProfileProvider. B can see A's cart and contact/address details and place an order with them. Fix by scoping private drafts to account identity and clearing them on account changes, with an explicit policy for transferring a guest cart.

Also audit pending asynchronous mutations: `frontend/src/state/orders.tsx:64` has no account-generation guard, so a refresh begun for A can commit its response after B signs in. Initial account-loading effects do not clear old records before a replacement fetch succeeds.

### 2. Checkout uses a React UI identifier as an order idempotency key

Evidence: `frontend/src/app/checkout.tsx:20`, `backend/pharmacies/services.py:131`.

`useId()` is a component/accessibility identifier, not a durable unique order-attempt identifier. It can repeat when a fresh app instance recreates the same component tree. The backend returns the existing order for a repeated key without comparing the new cart. The checkout then clears the cart and opens that old order.

Isolated reproduction: a first order for quantity 1 and a second request for quantity 7 with the same submission key return the same old order and quantity 1. Use a generated UUID per checkout attempt, stable only across retries for that attempt, and reject reuse with different order contents.

### 3. Live catalog changes can crash Cart and approved Prescription details

Evidence: `frontend/src/app/cart.tsx:25`, `frontend/src/app/prescriptions/[id].tsx:86`, and replacement of live catalog entries in `frontend/src/data/catalog.ts`.

Both screens assert that a medicine/offer exists and immediately read its fields. Live inventory/product entries can disappear, and prescription data can restore before the live catalog finishes loading. Cart can throw while reading the missing medicine/offer; prescription details can throw while reading `m.id`. The checkout domain's unavailable-item check does not protect Cart's separate render loop. Show loading/unavailable states, retain useful record snapshots, and allow removal of unavailable cart entries.

### 4. Old staff dispatch bypasses pharmacy acceptance and stock reservation

Evidence: `backend/customer_data/admin.py:28`, `backend/customer_data/admin.py:37`, `backend/customer_data/admin.py:63`.

The Django dispatch screen accepts any delivery order with recipient/address and a readiness checkbox. It does not enforce the managed order's status or use the pharmacy handoff service. An awaiting-confirmation or cancelled managed order can be assigned outside the pharmacy workflow.

Isolated reproduction: dispatch assigned a rider with HTTP 302 while the managed order was `awaiting_confirmation` and its reservation was `none`. Use a single managed dispatch service and require confirmed reserved stock and the ready-for-collection state.

### 5. Admin rider updates bypass customer order and stock synchronization

Evidence: `backend/riders/admin.py:49`, `backend/riders/admin.py:59`, `backend/riders/admin.py:70`; compare `backend/pharmacies/services.py:236`.

The rider API calls `rider_updated`, but admin saves and retry/return actions do not. Staff can mark a delivery complete while the customer still sees an earlier status and inventory remains reserved.

Isolated reproduction: rider delivery became `delivered`, customer order remained `confirmed`, reservation remained `held`, and one inventory unit stayed reserved. Route admin changes through the same validated transitions and synchronization as the rider API.

### 6. An expired session can block correct credentials; concurrent renewals can clear the session

Evidence: `frontend/src/api/client.ts:72`, `frontend/src/api/client.ts:76`, `frontend/src/api/client.ts:84`.

Every request attaches the current bearer token, including login, registration and password-reset calls. An expired bearer can be rejected before an AllowAny view handles valid credentials. The login call disables retry, so it does not recover.

Isolated reproduction: the same credentials returned HTTP 200 with no bearer and HTTP 401 with an expired bearer. The client also refreshes independently for each simultaneous 401 while refresh-token rotation/blacklisting is enabled, allowing a failed competing renewal to clear a session that another request renewed. Keep public authentication requests free of old bearer headers and share one refresh promise per session generation. Notify the profile provider when a session expires.

### 7. Invitation acceptance assumes email ownership that registration has not verified

Evidence: `backend/accounts/views.py:34`, `backend/pharmacies/views.py` in `InvitationAcceptView`.

Registration immediately creates an account and issues tokens without confirming the mailbox. Invitation acceptance checks only whether that account's email string matches the invitation. A person who registers an invited but unregistered email address can therefore accept staff membership without proving ownership of that mailbox. Pharmacist clinical verification remains blocked, but ordinary staff access is still granted. Require verified email ownership or an invitation secret delivered to and confirmed by the recipient before granting membership.

## P2 findings

### 8. Customer order tracking can stop updating

Evidence: `frontend/src/app/orders/[id]/tracking.tsx:16`; polling is installed in the separate details screen at `frontend/src/app/orders/[id]/index.tsx:17`. The Orders list also has no refresh trigger.

Tracking reads provider state without fetching or polling. Leaving the details route removes its interval, so tracking and the order list can keep an old status while pharmacy/rider updates continue. Fetch on focus or maintain guarded polling in the provider/shared order hook.

### 9. Pharmacy order details hold a stale snapshot despite polling

Evidence: `frontend/src/features/pharmacy.tsx:93`, `frontend/src/features/pharmacy.tsx:144`.

Opening a row copies the whole object into `orderEdit`. Polling replaces `orders` but never updates that copy. A rider can decline or an order can advance while details still show the old assignment/version. Reassignment may stay hidden and actions can fail with 409 until the user leaves and reopens the order. Store the selected ID and derive its current row; retain unsaved notes separately.

### 10. Prescription polling can discard unsynced local edits or uploads

Evidence: `frontend/src/state/prescriptions.tsx:43`, `frontend/src/state/prescriptions.tsx:50`, and `refresh` in the same file.

Commits update local state before the asynchronous upload/save succeeds. A failed write only produces a message; no durable pending-write retry is retained. Once writing finishes, the next successful poll replaces local records with server records and clears the message. A newly selected draft can disappear, or a submitted request can revert to the server's old draft. Track dirty records and pending uploads until acknowledgement; merge polling results without discarding unsynced work and provide Retry.

### 11. Help, Privacy, Terms and public pages can switch staff back to customer navigation

Evidence: `frontend/src/app/_layout.tsx:26`, `frontend/src/app/_layout.tsx:46`.

Portal mode is inferred only from the current path. An admin, pharmacist or rider opening a shared information route sees customer navigation, although clicking the logo returns to the account's portal. Keep a consistent account/portal context for shared routes, with explicit customer browsing when desired.

### 12. Failed delivery and retry states disagree across screens

Evidence: `backend/pharmacies/services.py:242`, `frontend/src/domain/orders.ts:33`, `backend/riders/admin.py:59`.

A temporary unsuccessful delivery becomes terminal `delivery_failed` for the customer and pharmacy, even though dispatch can still retry or return it and the reservation is held. Admin retry does not restore the customer status, and the mapping has no accepted/at-pharmacy retry state. Customer Previous orders and pharmacy Closed filters can therefore contain an active delivery. Introduce consistent issue/retry/return states and reserve terminal failure for a completed resolution.

### 13. Approved pharmacies with no inventory disappear from the public directory

Evidence: `backend/pharmacies/views.py:331`, `backend/pharmacies/views.py:338`.

Public pharmacies are built only while iterating qualifying inventory. An approved branch with no inventory entry, or without complete medicine metadata, is absent from the pharmacy directory and the prescription pharmacy picker. Load approved branch listings independently and show their inventory separately, including an empty inventory state.

### 14. Live workflows retain labels saying their review/order is a simulation

Evidence: prescription draft submit text in `frontend/src/app/prescriptions/[id].tsx`, approval badges in `frontend/src/app/cart.tsx` and `frontend/src/app/checkout.tsx`, and shared Help/Privacy/Terms copy in `frontend/src/components/public-information.tsx`.

A live pharmacy prescription uses a Submit for demo review label; live approved items still carry Demo Rx review in cart/checkout. Some help text describes all reviews/orders as simulated although approved pharmacies receive actual local backend submissions. Select wording from the managed/live state consistently so customers understand which actions contact a pharmacy.

## Validation

- Frontend suite: 48/48 passing. These are mostly domain checks and do not cover the account-transition, catalog-removal, polling, and admin integration conflicts above.
- Backend full suite: 13/15 passed. The owner-scoping test submits an old minimal order payload without a pharmacy and now receives 400. Its fixture must be updated before it can exercise owner isolation.
- The password-reset test generates a fresh time-based token after requesting the email and compares it literally with the emailed token. The second token can fall in a later second; the assertion failed in the full and targeted run. An isolated check using the actual emailed token successfully reset the password with HTTP 200. This failure is in the test's token assumption, not evidence that actual reset links are broken.
- Reproduced repeated-key old-order return, dispatch before acceptance/reservation, admin delivery/order/stock divergence, and expired-bearer login rejection in disposable in-memory databases.
- No product code or saved user data was changed during this review. This report is the only new repository artifact from the review.

## Suggested repair sequence

1. Isolate account data, secure invitation acceptance, and make session renewal/public authentication safe.
2. Replace checkout submission keys and unify managed dispatch/status/stock transitions.
3. Guard missing live catalog records and preserve pending prescription writes.
4. Move order refresh to shared hooks/providers and derive selected pharmacy details from current records.
5. Align shared navigation, directory population, failed-delivery states and live/sample labels.
