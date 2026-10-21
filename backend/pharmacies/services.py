import copy
import hashlib
import json
import uuid
from decimal import Decimal
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from administration.models import PharmacyApplication, MedicineRequest
from administration.views import Conflict
from customer_data.models import CustomerOrder, CustomerPrescription
from .models import PharmacyMember, Inventory, PrescriptionReview, PharmacyOrder, OrderAllocation, PharmacyAudit


def member_for(user, approved=True):
    member = PharmacyMember.objects.select_related("pharmacy", "user").filter(user=user, active=True).first()
    if not member or (approved and member.pharmacy.status != "Approved"):
        raise PermissionDenied("An approved pharmacy membership is required.")
    return member


def audit(pharmacy, user, action, target="", note="", payload=None):
    PharmacyAudit.objects.create(pharmacy=pharmacy, actor=user, action=action, target=str(target), note=note, payload=payload or {})


def public_id(medicine):
    key = "|".join(str(getattr(medicine, k)).strip().casefold() for k in ("name", "generic", "strength", "form", "unit", "prescription"))
    return "catalog-" + hashlib.sha256(key.encode()).hexdigest()[:32]


def medicine_data(m):
    return {"id": public_id(m), "name": m.name, "generic": m.generic, "strength": m.strength, "form": m.form, "unit": m.unit, "prescription": m.prescription, "category": "Pharmacy catalog", "description": "Confirm suitability and directions with your pharmacist.", "live": True}


def pharmacy_data(p):
    return {"id": str(p.pk), "name": p.name, "address": p.address, "phone": p.phone, "contactNumbers": p.contact_numbers or ([p.phone] if p.phone else []), "hours": p.hours or "Confirm hours with the pharmacy", "live": True, "isOpen": p.is_open, "point": {"lat": float(p.latitude), "lon": float(p.longitude)} if p.location_verified and p.latitude is not None and p.longitude is not None else None}


def inventory_rows(pharmacy, lock=False):
    query = Inventory.objects.filter(medicine__pharmacy=pharmacy, medicine__status="Approved").select_related("medicine")
    return query.select_for_update() if lock else query


def inventory_lookup(pharmacy, lock=False):
    return {public_id(row.medicine): row for row in inventory_rows(pharmacy, lock)}


def is_live_id(value):
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def live_pharmacy(value):
    if not is_live_id(value):
        return None
    pharmacy = PharmacyApplication.objects.filter(pk=value, status="Approved").first()
    if not pharmacy:
        raise ValidationError("This pharmacy is not approved or is no longer available.")
    return pharmacy


def integer(value, label, maximum=1000000):
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= maximum:
        raise ValidationError(f"{label} must be a positive whole number up to {maximum}.")
    return value


def save_prescription(record, data, upload, user):
    existing = PrescriptionReview.objects.select_for_update().filter(prescription=record).first()
    pharmacy = live_pharmacy(data.get("pharmacyId"))
    if not pharmacy and not existing:
        data.pop("managed", None)
        return data
    if existing and not pharmacy:
        raise ValidationError("Replace the file and retain the assigned pharmacy to begin another review.")
    revision = integer(data.get("revision", 1), "Revision")
    if existing and revision < existing.revision:
        raise Conflict("Refresh this prescription before editing it.")
    if existing and existing.pharmacy_id != pharmacy.pk:
        raise ValidationError("Submit a separate prescription to change pharmacies.")
    if existing and revision == existing.revision and existing.status != "draft":
        # A customer may retry a sync; server review outcomes must survive it.
        if upload and record.file:
            raise ValidationError("Replace the prescription to change its file.")
        return copy.deepcopy(record.data)
    if existing and revision not in (existing.revision, existing.revision + 1):
        raise ValidationError("The next file revision must follow the current revision.")
    if existing and revision > existing.revision and not upload:
        raise ValidationError("Attach a replacement file for the new revision.")
    state = data.get("status")
    if state not in ("draft", "pending"):
        raise ValidationError("Only the assigned pharmacist can set a prescription decision.")
    if not upload and not record.file:
        raise ValidationError("Attach a prescription file before submitting.")
    data = {**data, "approved": [], "note": "", "managed": True}
    if state == "pending":
        data.setdefault("requested", [])
        if not isinstance(data.get("requested", []), list) or not 0 <= len(data["requested"]) <= 100 or any(not isinstance(line, dict) for line in data["requested"]):
            raise ValidationError("Use a valid list of requested medicines.")
        available = inventory_lookup(pharmacy)
        ids = set()
        for line in data["requested"]:
            mid = line.get("medicineId")
            if mid in ids or mid not in available:
                raise ValidationError("Choose distinct medicines listed by this pharmacy.")
            ids.add(mid)
            integer(line.get("quantity"), "Requested quantity", 100)
    review, _ = PrescriptionReview.objects.update_or_create(prescription=record, defaults={"pharmacy": pharmacy, "revision": revision, "status": state, "approved": [], "note": "", "reviewer": None, "reviewed_at": None, "version": (existing.version + 1) if existing else 1})
    audit(pharmacy, user, "Prescription submitted" if state == "pending" else "Prescription replaced", record.external_id)
    return data


def order_intent(data):
    """Compare customer intent, ignoring computed prices and server status history."""
    try:
        lines = [{"medicine": line["medicine"]["id"], "quantity": line["quantity"], "approval": {key: line.get("approval", {}).get(key) for key in ("prescriptionId", "revision")} if line.get("approval") else None} for line in data["lines"]]
        return {"pharmacy": data["pharmacy"]["id"], "method": data["method"], "recipient": {key: str(data.get("recipient", {}).get(key, "")).strip() for key in ("name", "phone")}, "address": {key: str((data.get("address") or {}).get(key, "")).strip() for key in ("street", "barangay", "city", "province", "postalCode")} if data["method"] == "delivery" else None, "lines": sorted(lines, key=lambda line: line["medicine"])}
    except (TypeError, KeyError, AttributeError):
        raise ValidationError("Complete order details are required.")


def ensure_same_order(existing, submitted):
    if order_intent(existing.data) != order_intent(submitted):
        raise Conflict("This checkout reference was already used for different details. Start a new checkout.")
    return existing


def create_order(user, external_id, submitted):
    if not isinstance(submitted, dict):
        raise ValidationError("Expected order details.")
    if not isinstance(submitted.get("pharmacy"), dict):
        raise ValidationError("Choose a pharmacy.")
    pharmacy = live_pharmacy(submitted["pharmacy"].get("id"))
    if not pharmacy:
        if any(str((line.get("medicine") or {}).get("id", "")).startswith("catalog-") for line in submitted.get("lines", []) if isinstance(line, dict)):
            raise ValidationError("Pharmacy catalog items require their approved pharmacy.")
        return None
    with transaction.atomic():
        user.__class__.objects.select_for_update().get(pk=user.pk)
        pharmacy = PharmacyApplication.objects.select_for_update().get(pk=pharmacy.pk)
        submission_key = submitted.get("submissionKey")
        if not isinstance(submission_key, str) or not 1 <= len(submission_key) <= 120:
            raise ValidationError("A valid order submission key is required.")
        existing = CustomerOrder.objects.filter(owner=user, submission_key=submission_key).first() or CustomerOrder.objects.filter(owner=user, external_id=external_id).first()
        if existing:
            return ensure_same_order(existing, submitted)
        if pharmacy.status != "Approved" or not pharmacy.is_open:
            raise ValidationError("This pharmacy is currently closed to orders.")
        offers = inventory_lookup(pharmacy, lock=True)
        lines = submitted.get("lines")
        if not isinstance(lines, list) or not 1 <= len(lines) <= 100:
            raise ValidationError("Choose between 1 and 100 medicine lines.")
        method = submitted.get("method")
        if method not in ("pickup", "delivery"):
            raise ValidationError("Choose pickup or delivery.")
        recipient = submitted.get("recipient", {})
        if not isinstance(recipient, dict) or not str(recipient.get("name", "")).strip() or not str(recipient.get("phone", "")).strip():
            raise ValidationError("Recipient name and phone are required.")
        address = submitted.get("address")
        if method == "delivery" and (not isinstance(address, dict) or any(not str(address.get(key, "")).strip() for key in ("street", "barangay", "city"))):
            raise ValidationError("A complete delivery address is required.")
        normalized, allocations, seen = [], [], set()
        total = Decimal("0")
        for line in lines:
            if not isinstance(line, dict) or not isinstance(line.get("medicine"), dict):
                raise ValidationError("Invalid medicine line.")
            mid = (line.get("medicine") or {}).get("id")
            row = offers.get(mid)
            qty = integer(line.get("quantity"), "Quantity", 100)
            if mid in seen or not row or not row.available or qty > row.stock - row.reserved:
                raise ValidationError("A medicine is unavailable or does not have enough stock.")
            seen.add(mid)
            rx = None
            revision = None
            approval = line.get("approval")
            if row.medicine.prescription or approval:
                if not isinstance(approval, dict):
                    raise ValidationError("Pharmacist approval is required for this medicine.")
                rx = PrescriptionReview.objects.select_for_update().filter(prescription__owner=user, prescription__external_id=approval.get("prescriptionId"), pharmacy=pharmacy, status__in=["approved", "partially_approved"]).first()
                if not rx or rx.revision != approval.get("revision"):
                    raise ValidationError("This prescription approval is missing or outdated.")
                granted = next((item["quantity"] for item in rx.approved if item["medicineId"] == mid), 0)
                consumed = OrderAllocation.objects.filter(prescription=rx, prescription_revision=rx.revision, inventory=row).aggregate(total=Sum("quantity"))["total"] or 0
                if qty > granted - consumed:
                    raise ValidationError("This quantity exceeds the remaining pharmacist approval.")
                revision = rx.revision
            cost = row.price * qty
            total += cost
            normalized.append({"medicine": medicine_data(row.medicine), "quantity": qty, "unitPrice": float(row.price), "subtotal": float(cost), **({"approval": {"prescriptionId": rx.prescription.external_id, "revision": rx.revision, "pharmacyId": str(pharmacy.pk), "medicineId": mid, "quantity": qty, "reviewedAt": int(rx.reviewed_at.timestamp() * 1000)}} if rx else {})})
            allocations.append((row, qty, rx, revision))
        at = int(timezone.now().timestamp() * 1000)
        # Delivery fee stays explicitly a local prototype estimate.
        fee = Decimal("50") if method == "delivery" else Decimal("0")
        data = {"id": external_id, "submissionKey": submitted.get("submissionKey", external_id), "managed": True, "createdAt": at, "updatedAt": at, "status": "awaiting_confirmation", "method": method, "pharmacy": pharmacy_data(pharmacy), "lines": normalized, "recipient": recipient, "address": address if method == "delivery" else None, "subtotal": float(total), "deliveryFee": float(fee), "total": float(total + fee), "payment": "Cash on delivery" if method == "delivery" else "Pay at pickup", "events": [{"status": "awaiting_confirmation", "at": at, "note": "Submitted to the pharmacy."}]}
        order = CustomerOrder.objects.create(owner=user, external_id=external_id, submission_key=submission_key, data=data)
        managed = PharmacyOrder.objects.create(order=order, pharmacy=pharmacy)
        for row, qty, rx, revision in allocations:
            OrderAllocation.objects.create(order=managed, inventory=row, quantity=qty, price=row.price, prescription=rx, prescription_revision=revision)
        audit(pharmacy, user, "Order submitted", external_id)
        return order


def release_or_consume(managed, consume=False):
    if managed.reservation != "held":
        return
    for line in managed.allocations.select_related("inventory").order_by("inventory_id"):
        updates = {"reserved": F("reserved") - line.quantity, "version": F("version") + 1}
        if consume:
            updates["stock"] = F("stock") - line.quantity
        Inventory.objects.filter(pk=line.inventory_id).update(**updates)
    managed.reservation = "consumed" if consume else "released"


def order_action(managed, user, status, note="", version=None):
    with transaction.atomic():
        managed = PharmacyOrder.objects.select_for_update().select_related("order", "pharmacy").get(pk=managed.pk)
        if version is not None and managed.version != version:
            raise Conflict()
        data = copy.deepcopy(managed.order.data)
        previous = data.get("status")
        transitions = {"awaiting_confirmation": {"confirmed", "rejected", "cancelled"}, "confirmed": {"preparing"}, "preparing": {"ready_for_pickup"} if data.get("method") == "pickup" else {"ready_for_collection"}, "ready_for_pickup": {"collected"}}
        if status not in transitions.get(previous, set()):
            raise Conflict("This action is not available for the current order status.")
        if status in ("rejected", "cancelled") and not note.strip():
            raise ValidationError("Enter a reason.")
        if status == "confirmed":
            for line in managed.allocations.select_related("inventory").order_by("inventory_id"):
                inventory = Inventory.objects.select_for_update().get(pk=line.inventory_id)
                if not inventory.available or inventory.stock - inventory.reserved < line.quantity:
                    raise ValidationError("Insufficient available stock. Update inventory or reject the order.")
                Inventory.objects.filter(pk=inventory.pk).update(reserved=F("reserved") + line.quantity, version=F("version") + 1)
            managed.reservation = "held"
        if status in ("rejected", "cancelled"):
            release_or_consume(managed)
        if status == "collected":
            release_or_consume(managed, consume=True)
        at = int(timezone.now().timestamp() * 1000)
        data["status"] = status
        data["updatedAt"] = at
        data.setdefault("events", []).append({"status": status, "at": at, "note": note.strip() or "Pharmacy updated the order."})
        managed.order.data = data
        managed.order.save(update_fields=["data", "updated_at"])
        managed.version += 1
        managed.save(update_fields=["version", "reservation"])
        audit(managed.pharmacy, user, "Order " + status, managed.order.external_id, note)
        return managed


def assign_rider(order, rider, actor, expected_version=None):
    from riders.models import RiderDelivery, RiderProfile, DeliveryEvent
    with transaction.atomic():
        managed = PharmacyOrder.objects.select_for_update().select_related("order", "pharmacy").filter(order=order).first()
        if not managed:
            raise ValidationError("Only pharmacy-managed orders can be dispatched. Sample orders are previews.")
        if expected_version is not None and managed.version != expected_version:
            raise Conflict()
        data = managed.order.data
        if managed.pharmacy.status != "Approved" or data.get("method") != "delivery" or data.get("status") != "ready_for_collection" or managed.reservation != "held":
            raise Conflict("The pharmacy must accept, reserve, prepare, and mark this order ready before dispatch.")
        if order.rider_deliveries.exclude(status__in=("declined", "cancelled")).exists():
            raise Conflict("This order already has an active or completed rider assignment.")
        rider = RiderProfile.objects.select_for_update().select_related("user").get(pk=rider.pk)
        if not rider.approved or not rider.available or not rider.user.is_active:
            raise ValidationError("Choose an available approved rider.")
        delivery = RiderDelivery.objects.create(order=order, rider=rider, customer_name=data["recipient"]["name"], customer_phone=data["recipient"]["phone"], delivery_address=data["address"], pharmacy_name=managed.pharmacy.name, pharmacy_address=managed.pharmacy.address, payment_method="cod", amount_due=data["total"])
        DeliveryEvent.objects.create(delivery=delivery, actor=actor, status="offered", note="Assigned for sealed package collection.")
        managed.version += 1
        managed.save(update_fields=["version"])
        audit(managed.pharmacy, actor, "Rider assigned", order.external_id, rider.user.full_name)
        return managed


def rider_updated(delivery, actor):
    with transaction.atomic():
        managed = PharmacyOrder.objects.select_for_update().select_related("order").filter(order=delivery.order).first()
        if not managed:
            return
        data = copy.deepcopy(managed.order.data)
        if data.get("status") in ("cancelled", "rejected", "collected", "delivered", "returned"):
            raise Conflict("This order has already closed. Its delivery cannot be advanced.")
        statuses = {"offered": "ready_for_collection", "declined": "ready_for_collection", "cancelled": "ready_for_collection", "accepted": "ready_for_collection", "at_pharmacy": "ready_for_collection", "picked_up": "rider_collected", "out_for_delivery": "out_for_delivery", "delivered": "delivered", "unsuccessful": "delivery_issue", "returning": "returning", "returned": "returned"}
        state = statuses.get(delivery.status)
        if delivery.status in ("accepted", "at_pharmacy") and data.get("status") in ("delivery_issue", "delivery_retry"):
            state = "delivery_retry"
        if state:
            data["status"] = state
            data["updatedAt"] = int(timezone.now().timestamp() * 1000)
            data.setdefault("events", []).append({"status": state, "at": data["updatedAt"], "note": "Rider status: " + delivery.get_status_display()})
            managed.order.data = data
            managed.order.save(update_fields=["data", "updated_at"])
        if delivery.status in ("delivered", "returned"):
            # Returned medicine must be inspected before it can be manually restocked.
            release_or_consume(managed, consume=True)
        managed.version += 1
        managed.save(update_fields=["version", "reservation"])
        audit(managed.pharmacy, actor, "Rider " + delivery.status, managed.order.external_id)
