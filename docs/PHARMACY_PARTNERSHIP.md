# Pharmacy partnerships

Guest Home has a Partner with us link to `/partnership`. Account shows Partner with MediFind, My pharmacy application, or Pharmacy dashboard according to membership status. Customers, branch owners, employees, riders, and administrators use the shared sign-in page.

## Application

Sign in and choose Start application. The `/partner` application presents branch details and FDA, business, and pharmacist document selectors immediately. Select PDF, PNG, or JPEG files up to 10 MB each. Files remain selected locally until Save changes or Submit application uploads them. Save changes is directly above Submit application.

A draft needs branch name, address, representative, and email. Phone and opening hours must be supplied before submission. Contacts support up to five mobile numbers. Each uses 09 followed by nine digits, or +63 followed by ten digits starting with 9; duplicate numbers in different formats are rejected. The opening-hours editor provides day presets, selectable opening days, AM/PM time pickers, per-day hours, and 24-hour opening. Overnight closing is shown as the following day. Existing text hours remain intact until the owner chooses to replace them with a structured schedule. Submit saves current edits, uploads selected files, then submits the application. After a partial upload failure, successfully uploaded files remain saved and the remaining selected files can be retried. Pending applications show submitted details, private documents, status, and review history. Needs Info and Rejected applications can be updated and resubmitted. Approval unlocks branch operations.

## Staff invitations

Approved branch owners use Pharmacy Profile > Invite staff to invite an email as Staff or Pharmacist. Invitations are visible in the recipient's Partner with MediFind page after sign-in, expire after seven days, and can be cancelled by the owner. Invitations do not send email. Creation returns a random one-time code to the owner only; the owner shares it directly with the confirmed employee. The recipient must explicitly accept with both the invited account email and that code. The backend stores only a digest; codes are not returned by invitation lists. Renewing rotates the code, and accepting consumes it. Invitations created before this change must be renewed. Existing pharmacy memberships cannot be replaced through invitations.

Invitation acceptance never enables pharmacist verification. Authorized administration staff must verify pharmacist credentials using Django admin > Pharmacy members before clinical review becomes available.

## Backend

Run `python manage.py migrate` to install the pharmacy invitation table. New endpoints:

- `GET /api/pharmacy/invitations/`: current account's valid incoming invitations.
- `GET /api/pharmacy/invitations/?scope=sent`: owner's active outgoing invitations.
- `POST /api/pharmacy/invitations/`: owner creates or renews an invitation with email and role.
- `POST /api/pharmacy/invitations/<uuid>/accept/`: invited account accepts.
- `POST /api/pharmacy/invitations/<uuid>/cancel/`: owner cancels.

All invitation operations require authentication. Inviting and cancelling require an approved branch owner. Acceptance requires a valid, unexpired invitation, approved branch, matching recipient email, the correct owner-supplied code, and no existing pharmacy membership.
