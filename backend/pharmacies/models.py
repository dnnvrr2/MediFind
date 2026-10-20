from django.conf import settings
from django.db import models


class PharmacyMember(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="pharmacy_member")
    pharmacy = models.ForeignKey("administration.PharmacyApplication", on_delete=models.PROTECT, related_name="members")
    role = models.CharField(max_length=16, choices=[("owner", "Owner"), ("pharmacist", "Pharmacist"), ("staff", "Staff")], default="staff")
    verified_pharmacist = models.BooleanField(default=False, help_text="Authorized staff must verify credentials before enabling prescription review.")
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.email} - {self.pharmacy.name}"


class Inventory(models.Model):
    medicine = models.OneToOneField("administration.MedicineRequest", on_delete=models.PROTECT, related_name="inventory")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    reserved = models.PositiveIntegerField(default=0, editable=False)
    low_stock = models.PositiveIntegerField(default=10)
    available = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(stock__gte=models.F("reserved")), name="inventory_covers_reservations"), models.CheckConstraint(condition=models.Q(price__gte=0), name="inventory_nonnegative_price")]


class PrescriptionReview(models.Model):
    prescription = models.OneToOneField("customer_data.CustomerPrescription", on_delete=models.PROTECT, related_name="pharmacy_review")
    pharmacy = models.ForeignKey("administration.PharmacyApplication", on_delete=models.PROTECT)
    revision = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=30, default="pending")
    approved = models.JSONField(default=list)
    note = models.TextField(blank=True)
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    reviewed_at = models.DateTimeField(null=True)
    version = models.PositiveIntegerField(default=1)


class PharmacyOrder(models.Model):
    order = models.OneToOneField("customer_data.CustomerOrder", on_delete=models.PROTECT, related_name="pharmacy_order")
    pharmacy = models.ForeignKey("administration.PharmacyApplication", on_delete=models.PROTECT)
    version = models.PositiveIntegerField(default=1)
    reservation = models.CharField(max_length=16, default="none")
    created_at = models.DateTimeField(auto_now_add=True)


class OrderAllocation(models.Model):
    order = models.ForeignKey(PharmacyOrder, on_delete=models.PROTECT, related_name="allocations")
    inventory = models.ForeignKey(Inventory, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    prescription = models.ForeignKey(PrescriptionReview, null=True, blank=True, on_delete=models.PROTECT)
    prescription_revision = models.PositiveIntegerField(null=True)


class PharmacyAudit(models.Model):
    pharmacy = models.ForeignKey("administration.PharmacyApplication", on_delete=models.PROTECT, related_name="activity")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    payload = models.JSONField(default=dict, blank=True)
    action = models.CharField(max_length=80)
    target = models.CharField(max_length=100, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
