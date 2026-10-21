from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import RiderDelivery, DeliveryEvent

TRANSITIONS = {
    "offered": {"accepted", "declined", "cancelled"}, "accepted": {"at_pharmacy", "cancelled", "unsuccessful"},
    "at_pharmacy": {"picked_up", "cancelled", "unsuccessful"}, "picked_up": {"out_for_delivery", "unsuccessful"},
    "out_for_delivery": {"delivered", "unsuccessful"}, "unsuccessful": {"accepted", "returning"}, "returning": {"returned"},
}


@transaction.atomic
def transition_delivery(delivery, actor, target, note="", dispatch=False, confirmation_verified=False, proof=None, cash_collected=None):
    row = RiderDelivery.objects.select_for_update().select_related("order", "rider").get(pk=delivery.pk)
    if dispatch:
        if not actor.is_staff:
            raise PermissionDenied("Dispatch access is required.")
        if target not in ("accepted", "returning", "cancelled"):
            raise ValidationError("Complete pickup and delivery through the assigned rider account.")
    elif row.rider.user_id != actor.pk:
        raise PermissionDenied("Only the assigned rider can update this delivery.")
    elif row.status == "unsuccessful" or target == "cancelled":
        raise PermissionDenied("Dispatch must approve retries, returns, or assignment cancellation.")
    if target not in TRANSITIONS.get(row.status, set()):
        raise ValidationError("This action is not available for the delivery's current status.")
    if target == "unsuccessful" and not note.strip():
        raise ValidationError("Enter the delivery issue.")
    if target == "delivered":
        if not confirmation_verified or not proof:
            raise ValidationError("Customer confirmation and delivery proof are required.")
        if row.payment_method in ("cod", "cash_on_delivery") and not cash_collected:
            raise ValidationError("Confirm cash collection before completion.")
        row.proof = proof
        row.cash_collected = bool(cash_collected) or row.payment_method not in ("cod", "cash_on_delivery")
        row.confirmation_attempts = 0
        row.confirmation_locked_until = None
    row.status = target
    row.notes = note.strip() or row.notes
    if target in ("delivered", "returned", "cancelled"):
        row.completed_at = timezone.now()
    row.save()
    DeliveryEvent.objects.create(delivery=row, actor=actor, status=target, note=note[:500])
    from pharmacies.services import rider_updated
    rider_updated(row, actor)
    if dispatch and target in ("accepted", "returning"):
        row.issues.filter(resolved_at__isnull=True).update(resolved_at=timezone.now())
    return row
