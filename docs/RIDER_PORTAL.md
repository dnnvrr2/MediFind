# Rider portal

The Rider portal adds assigned delivery work to the existing customer preview. It includes a rider dashboard, active assignments, delivery detail and directions, status updates, issue reporting, history, availability, and profile screens. The API checks rider approval and assignment ownership on every rider endpoint. Rider responses contain the sealed-package handoff details and never return order line items or prescription records.

## Local setup

1. Install backend dependencies with `pip install -r backend/requirements.txt` inside the backend virtual environment. Pillow is needed for private proof-of-delivery images.
2. Run `python manage.py migrate` from `backend/` to create rider tables.
3. Create or select a MediFind user in Django admin, then add a Rider profile for that account. Leave `approved` off until the rider is authorized. Set `approved` on and `available` on before assignment.
4. Start the frontend and Django API using the existing local setup instructions.
5. Open `/rider/login` and sign in with that user's email and password.

## Manual dispatch workflow

In Django admin, open Customer orders and choose **Dispatch verified delivery**. Select the delivery order and an approved, available rider. Enter the cash amount only for cash-on-delivery orders, then confirm directly with pharmacy staff that the order is genuine, sealed, and ready. This creates a rider offer. This confirmation is a staff responsibility; the customer preview record alone does not confirm a pharmacy has accepted an order.

Riders can accept or decline an offer, record arrival and pickup, start the delivery, report an issue, or complete handoff. Completion requires the customer's order confirmation code and a JPG/PNG proof photo. Five incorrect codes lock confirmation for 15 minutes; staff can unlock it in the delivery admin record. For COD, the rider must also confirm cash collection. Photos are stored under private media storage and aren't served through a public media URL. Issues move the delivery into an unsuccessful state. Dispatch can resolve an unsuccessful delivery as a retry or return-to-pharmacy from the delivery admin action menu; subsequent status changes are recorded in the event history.

Customers see rider status through their order list/detail refresh. The six-digit confirmation code appears on the customer's order detail only while the assigned delivery is out for delivery, and the authenticated code endpoint verifies order ownership. Rider actions and code retrieval are throttled.

## Current integration limits

Dispatch is manual. The project has no pharmacy inventory/order acceptance API, live rider location, push notification provider, automated route/ETA service, or payment settlement integration. New offers refresh every 20 seconds while the rider dashboard is open. The current catalog and customer order flow remain a preview; staff must verify a real pharmacy handoff and the actual payable COD amount before creating an assignment. This portal is not a substitute for pharmacy or prescription verification.
