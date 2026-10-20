# Milestone 5: Customer API foundation

This milestone adds the Django API foundation for persistent customer accounts, profiles, orders, and prescription submissions. Every customer record is scoped to the authenticated account. Prescription files are stored outside public static/media URLs and are served through an authenticated endpoint.

## Start locally

1. Create a virtual environment in `backend` and install `-r requirements.txt`.
2. Copy `.env.example` to `.env` and fill in a local secret and database values. Django reads this file for local development without overriding environment variables already set by the host.
3. Run `python manage.py migrate` and `python manage.py runserver 0.0.0.0:8000`.

SQLite is used if no PostgreSQL environment variables are set. Set `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` to use PostgreSQL. Do not use the development secret key or DEBUG mode in production.

## API

- `POST /api/auth/register/` — `{email,password,full_name,phone?}`
- `POST /api/auth/token/` — `{email,password}`; returns access and refresh tokens
- `POST /api/auth/token/refresh/` — refresh JWT
- `POST /api/auth/logout/` — `{refresh}`; blacklist refresh token
- `GET/PATCH /api/auth/me/` — authenticated profile
- `GET/POST /api/customer/orders/` — list/create customer order snapshots
- `GET/POST /api/customer/prescriptions/` — list/create metadata and private file
- `GET /api/customer/prescriptions/{id}/file/` — authenticated private download

Client supplied owner IDs are ignored. Records use a per-account external ID to make syncing local preview records idempotent. These endpoints persist sample/preview orders only; they do not reserve stock, collect payment, verify prescriptions, or place real pharmacy orders.

Configure `CORS_ALLOWED_ORIGINS` as a comma-separated list of exact origins for browser development. For Expo Go on a phone, use the computer's LAN IP in `EXPO_PUBLIC_API_URL` and add that IP to `DJANGO_ALLOWED_HOSTS`. Do not use wildcard origins with credentials in production. The app keeps access tokens in memory and stores refresh tokens in OS secure storage on native or tab-scoped session storage on web. In local DEBUG mode, reset email is printed in the backend console; configure SMTP environment variables for actual email delivery. Set FRONTEND_BASE_URL to the app public URL before sending real email.
