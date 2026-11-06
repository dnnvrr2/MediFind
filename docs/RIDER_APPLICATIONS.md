# Rider applications

From Profile, choose **Apply as rider**. Sign in or create an account, then submit your full name, mobile number, vehicle, optional plate number, and service area. The application remains Pending until staff review it. Use **Refresh status** to retrieve the latest decision. Rejected applicants can correct their details and resubmit; earlier submissions and decisions remain in the application history.

Staff use **Administration > Riders** to search applications, filter by status, open details, and approve or reject. A rejection requires notes. The confirmation step saves the reviewer, decision, timestamp, and history event. Version checks reject stale decisions. Only approval creates or enables the rider profile, initially offline. Approved riders can open their dashboard and enable availability.

The application records onboarding details; it does not independently verify driving credentials or create a POS/map integration. Existing approved riders keep access without submitting a new application.

## Endpoints

- `GET /api/rider/application/`: signed-in user's application and approval flag.
- `POST /api/rider/application/`: first submission or resubmission after rejection.
- `GET /api/rider/applications/`: staff-only application list.
- `POST /api/rider/applications/<id>/review/`: staff-only decision with `status`, `notes`, and current `version`.

Apply backend migrations before serving this feature. The frontend route is `/rider/apply`; review is `/admin?tab=riders`.
