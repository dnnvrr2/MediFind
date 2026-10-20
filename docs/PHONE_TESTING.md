# Run MediFind on a phone

1. Keep the phone and computer on the same Wi-Fi network.
2. Double-click `Start MediFind Local.cmd` in the project folder. It opens the API and Expo in separate terminals.
3. Scan Expo's QR code with Expo Go. The app's local API address is configured as `http://192.168.1.5:8000` for this computer's current Wi-Fi address.
4. To open the responsive web app from a phone browser on the same Wi-Fi, visit `http://192.168.1.5:8081`.

If the Wi-Fi address changes, update `EXPO_PUBLIC_API_URL` in `frontend/.env`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `FRONTEND_BASE_URL` in `backend/.env`, then restart both terminals. If another device cannot connect, check that Windows permits Python and Node on the private network. These sample accounts and orders are local development data; ordering remains a preview and does not contact pharmacies.
