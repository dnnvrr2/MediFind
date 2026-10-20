# Milestone 4 — Customer profile screens

## Implemented

- Profile navigation on desktop and mobile, replacing the standalone pharmacy navigation tab. Pharmacy lists/details remain reachable from Home and medicine search.
- Signed-out profile with sign-in and create-profile paths, while keeping session orders and prescriptions accessible.
- Profile summary and edit form for name, email, and Philippine mobile number.
- Demo sign-in and registration forms with email and phone validation, password length and confirmation checks, and clear preview boundaries. Password values are held only in each form and discarded immediately when the session profile is created.
- Password-reset confirmation flow that explicitly says no email is sent and no password changes.
- Profile session state remains in memory and clears on reload/restart.

## Boundaries

These screens do not create, authenticate, or store real accounts. Any valid email plus an eight-character password can start a local demo session; no password is kept. Registration creates only a temporary profile in app memory. Password reset only shows the confirmation UI. No form data is sent to a server. Account persistence, secure password handling, and real reset email delivery require the backend/authentication milestone.

## Verification

- `npm run typecheck`
- Web and Android Expo exports
- The profile routes are added to the typed router after restarting Expo.

The next milestone is connecting these screens to Django/PostgreSQL authentication and persistent customer profiles, then using authenticated ownership for orders and prescription history.
