# Admin integration and persistent reviews

Imported selectively from https://github.com/fgiannn/MediFInd-Admin_Screens at commit `aa78421057d173c1fb84204d09a1f9ddd26fdfbc`. The upstream README is retained in `IMPORTED_ADMIN_README.md` as a historical snapshot.

## Current implementation

- Admin uses the same MediFind header, desktop/mobile navigation, page width, spacing, typography, cards, fields, buttons, badges, and detail rows as the other portals. Navigation is shared through `frontend/src/components/portal-navigation.tsx`. Admin sections are linked with `/admin?tab=dashboard`, `pharmacies`, `catalog`, or `profile`.
- Staff workspace: `frontend/src/features/admin-workspace.tsx`; route and API staff check: `frontend/src/app/admin/index.tsx`.
- Django `administration` app stores pharmacy applications, private supporting documents, medicine requests, and review history.
- All administration API endpoints require authenticated staff, independently of the frontend route check. Account registration and profile updates cannot grant staff status.
- Dashboard counts, search, status filters, and activity use saved records. There are no seeded sample applications or medicine requests.
- Decisions save reviewer identity, time, previous/new status, and notes in the same transaction. Final decisions cannot be changed through the API or Django admin.
- A version check rejects stale decisions with HTTP 409. The frontend refreshes the records after a conflict. Failed saves retain the entered notes and show the service error.
- Pharmacy approval requires stored FDA, business, and pharmacist documents. Uploads accept PDF/PNG/JPEG signatures and are limited to 10 MB each.
- Medicine requests require an approved pharmacy. Case-insensitive duplicate name/strength-form/pharmacy combinations are blocked by a database constraint.
- Private documents download through the staff-authenticated API on web. Native staff should use the web portal for document downloads.

## Local setup

From the repository's `backend` directory:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py createsuperuser
$env:DJANGO_DEBUG = 'true'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:8081,http://127.0.0.1:8081'
.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

`createsuperuser` is a one-time interactive step if no administrator exists. Choose your own credentials. Existing installations can grant Staff status through an authorized Django administrator. Django admin model permissions are required for non-superusers to create applications and attach documents there.

1. Sign into http://127.0.0.1:8000/admin/ and add a Pharmacy application with its three supporting documents. Application edits and document changes are recorded in history and increment the review version.
2. Start the frontend and open http://localhost:8081/admin. Sign in with the same staff account. Staff also see an Administration link in their customer profile.
3. Review the application and download its documents. Approve, request information, or reject; a reason is required for the latter two actions.
4. Once a pharmacy is approved, add medicine requests from the catalog tab and review them. Decisions survive reloads.

This checkout uses SQLite when no PostgreSQL settings are configured. Its local database and uploads are ignored by Git. Keep documents private in deployment; do not expose `PRIVATE_MEDIA_ROOT` through a public media server. Use the backend environment setup in `backend/README.md` for deployment rather than the local DEBUG command above.

## API

All paths are under `/api/administration/` and use the existing JWT session:

- `GET pharmacies/`: applications with document metadata and review history.
- `POST pharmacies/{id}/review/`: `{status, notes, version}`.
- `GET medicines/`: medicine requests and history.
- `POST medicines/`: `{name, description, pharmacy_id}`; creates a pending request.
- `POST medicines/{id}/review/`: `{status, notes, version}`.
- `GET documents/{id}/`: private attachment download; no public file URL is returned.

Pharmacy decisions: Approved, Rejected, or Needs Info. Medicine decisions: Approved or Rejected. Review events are read-only in Django admin, and no API allows their modification or deletion.

## Preserved work and remaining scope

The guest landing remains at `/`, customer home at `/home`. Existing customer/rider flows, password visibility, OpenStreetMap, CDO location list, and device location selection remain in place.

These are persistent administration records. Pharmacy self-service onboarding, applicant notifications/resubmission, medicine stock/prices, and publishing approved listings into customer search are separate work. The customer catalog still uses its existing sample data. No stock is reserved or order fulfilled by an admin review decision.

The integration remains local and has not been pushed.

## Checks

TypeScript typecheck, Expo web export, Django system/database checks, and migration consistency checks passed. The local database migrations were applied. No automated tests or browser interaction checks were run in this milestone.
