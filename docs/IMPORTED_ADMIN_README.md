# MediFind Admin Preview

> Upstream reference snapshot. Paths, access instructions, and behavior below describe the imported project. See [ADMIN_INTEGRATION.md](ADMIN_INTEGRATION.md) for the current integrated app and staff access requirements.

The admin UI is in `frontend/src/app/admin/index.tsx`. Open `/admin` (web: `http://localhost:8081/admin`) to access it. Expo Router automatically handles this route. The existing customer app remains at `/`.

## On Windows

1. In VS Code, open the `MediFind-main` folder (not its parent `MediFind.system`).
2. Run `cd frontend` in PowerShell.
3. Run `npm ci` (once) and then `npx expo start`.
4. Press `w` for a browser preview, or use a compatible Android development build / Expo Go. Visit the `/admin` route. Alternatively run `npx expo start --web`.

If your terminal is currently at `C:\Users\...\MediFind.system`, first run `cd .\MediFind-main\frontend` to avoid the `package.json does not exist` error.

## Screens

- Dashboard: sample overview, activity, navigation.
- Pharmacy Approval: filtering by review status, live search, and application list.
- Application Details: pharmacy data, placeholder document names, notes, approve/request info/reject, validation for negative actions.
- Medicine Catalog: pending and approved lists, search, request details, approve/reject, add demo medicine.
- Profile: demo administrator placeholder and customer preview return.

**Important:** All admin entries and baseline numbers are demo data. Changes persist only while the admin route remains mounted; they are not saved to a database. Document buttons are placeholders. This is not a verified medical or regulatory approval workflow. To make it production-ready, add authenticated admin API endpoints, document storage, audit logs, server-side authorization, and DB integration.
