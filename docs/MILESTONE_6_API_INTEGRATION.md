# Milestone 6: Customer API integration

The Expo customer app now uses the Django API for account registration, sign-in, profile updates, and customer-owned order/prescription records. Order history and prescription metadata reload after sign-in. Prescription files upload to the backend's private storage endpoint. The simulated review/status actions remain preview-only.

## Configure the API URL

Copy `frontend.env.example` to `frontend/.env.local` and set `EXPO_PUBLIC_API_URL`.

- Browser on this computer: `http://127.0.0.1:8000`
- Expo Go on a phone: `http://<computer-LAN-IP>:8000` (phone and computer must share Wi-Fi; allow the port in the local firewall)

Restart Expo after changing the environment file. Start Django on `0.0.0.0:8000`. When using a phone, also add the computer LAN IP to backend `DJANGO_ALLOWED_HOSTS`; add the browser page origin to `CORS_ALLOWED_ORIGINS` when opening the website from the phone.

Auth tokens stay in application memory for the current app session. Closing or reloading the app signs the customer out; signing in again reloads saved account data. Password reset remains a preview screen because the backend has no configured email delivery.

These endpoints save previews only; they do not confirm stock, submit a real order, accept payment, or provide pharmacist review. Review simulation controls should not be used to make clinical decisions.
