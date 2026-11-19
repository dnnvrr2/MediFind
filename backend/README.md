# Milestone 5: Customer API foundation

This milestone adds the Django API foundation for persistent customer accounts, profiles, orders, and prescription submissions. Every customer record is scoped to the authenticated account. Prescription files are stored outside public static/media URLs and are served through an authenticated endpoint.

## Start locally

1. Create a virtual environment in `backend` and install `-r requirements.txt`.
2. Create a PostgreSQL login and a database owned by that login. Copy `.env.example` to `.env` and set `DJANGO_SECRET_KEY`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT`. Environment variables set by the host take precedence over this file.
3. Run `python manage.py migrate` and `python manage.py runserver 0.0.0.0:8001`.

PostgreSQL is required. Do not use the development secret key or DEBUG mode in production.

For tests, create a separate database owned by the same login, set its name in `DB_TEST_NAME`, and run `python manage.py test --keepdb`. Django applies test migrations to that database and reuses it for later runs.

## API

- `POST /api/auth/register/` — `{email,password,first_name,last_name,phone}`
- `POST /api/auth/token/` — `{email,password}`; returns access and refresh tokens
- `POST /api/auth/token/refresh/` — refresh JWT
- `POST /api/auth/logout/` — `{refresh}`; blacklist refresh token
- `GET/PATCH /api/auth/me/` — authenticated profile
- `GET/POST /api/customer/orders/` — list/create customer order snapshots
- `GET/POST /api/customer/prescriptions/` — list/create metadata and private file
- `GET /api/customer/prescriptions/{id}/file/` — authenticated private download

Orders and prescriptions are scoped to the authenticated customer. Order submission requires an approved pharmacy and a unique submission key. The pharmacy reserves stock after accepting an order, and prescription decisions come from the assigned pharmacist.

Configure `CORS_ALLOWED_ORIGINS` as a comma-separated list of exact origins for browser development. For Expo Go over LAN, native development derives the API host from Expo's host address when `EXPO_PUBLIC_API_URL` is unset. Run Django on `0.0.0.0:8001`, add the computer's Wi-Fi IP to `DJANGO_ALLOWED_HOSTS`, and keep both devices on the same network. An explicit `EXPO_PUBLIC_API_URL` overrides detection (useful for tunnels and separate API hosts). Add each browser origin/port, including 8082 when used, to `CORS_ALLOWED_ORIGINS`. Do not use wildcard origins with credentials in production. The app keeps access tokens in memory and stores refresh tokens in OS secure storage on native or tab-scoped session storage on web. In local DEBUG mode, reset email is printed in the backend console; configure SMTP environment variables for actual email delivery. Set FRONTEND_BASE_URL to the app public URL before sending real email.

Rider assignments, authorization, status events, and the manual dispatch workflow are documented in `../docs/RIDER_PORTAL.md`.

Persistent staff pharmacy applications, private documents, medicine catalog reviews, and review history are documented in `../docs/ADMIN_INTEGRATION.md`. Run `python manage.py migrate` to install the new administration tables.
