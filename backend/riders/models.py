import hashlib
import hmac
import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


def proof_upload_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower()[:8]
    return f"delivery-proofs/{instance.pk}/{uuid.uuid4().hex}.{ext}"


def issue_upload_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower()[:8]
    return f"delivery-issues/{instance.delivery_id}/{uuid.uuid4().hex}.{ext}"


class RiderProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="rider_profile")
    approved = models.BooleanField(default=False)
    available = models.BooleanField(default=False)
    vehicle = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Rider: {self.user.full_name or self.user.email}"


class RiderDelivery(models.Model):
    class Status(models.TextChoices):
        OFFERED = "offered", "Offered"
        ACCEPTED = "accepted", "Accepted"
        AT_PHARMACY = "at_pharmacy", "At pharmacy"
        PICKED_UP = "picked_up", "Picked up"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        DELIVERED = "delivered", "Delivered"
        UNSUCCESSFUL = "unsuccessful", "Unsuccessful"
        RETURNING = "returning", "Returning to pharmacy"
        RETURNED = "returned", "Returned"
        DECLINED = "declined", "Declined"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rider = models.ForeignKey(RiderProfile, on_delete=models.PROTECT, related_name="deliveries")
    order = models.ForeignKey("customer_data.CustomerOrder", on_delete=models.PROTECT, related_name="rider_deliveries")
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OFFERED)
    customer_name = models.CharField(max_length=160)
    customer_phone = models.CharField(max_length=32)
    delivery_address = models.JSONField(default=dict)
    pharmacy_name = models.CharField(max_length=160)
    pharmacy_address = models.CharField(max_length=500, blank=True)
    payment_method = models.CharField(max_length=32, default="prepaid")
    amount_due = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    cash_collected = models.BooleanField(default=False)
    confirmation_attempts = models.PositiveSmallIntegerField(default=0)
    confirmation_locked_until = models.DateTimeField(null=True, blank=True)
    proof = models.ImageField(upload_to=proof_upload_path, blank=True)
    notes = models.TextField(blank=True, max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.order.external_id} · {self.get_status_display()}"


class DeliveryEvent(models.Model):
    delivery = models.ForeignKey(RiderDelivery, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=24, choices=RiderDelivery.Status.choices)
    note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)


class DeliveryIssue(models.Model):
    class Reason(models.TextChoices):
        UNREACHABLE = "unreachable", "Customer unreachable"
        ADDRESS = "address", "Incorrect or incomplete address"
        DECLINED = "declined", "Customer declined delivery"
        OTHER = "other", "Other"

    delivery = models.ForeignKey(RiderDelivery, on_delete=models.CASCADE, related_name="issues")
    rider = models.ForeignKey(RiderProfile, on_delete=models.PROTECT, related_name="issues")
    reason = models.CharField(max_length=20, choices=Reason.choices)
    details = models.TextField(max_length=1000)
    photo = models.ImageField(upload_to=issue_upload_path, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)


def customer_confirmation_code(delivery):
    """Stable six digit code; reveal it only from the order owner's authenticated endpoint."""
    message = f"rider-delivery:{delivery.pk}:{delivery.order.owner_id}".encode()
    digest = hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()
    return f"{int(digest[:12], 16) % 1000000:06d}"
