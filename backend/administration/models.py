import uuid
from pathlib import Path
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models.functions import Lower


class ReviewStatus(models.TextChoices):
    DRAFT = "Draft"
    PENDING = "Pending"
    NEEDS_INFO = "Needs Info"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class PharmacyApplication(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=500)
    applicant = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=24, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(-90), MaxValueValidator(90)])
    longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(-180), MaxValueValidator(180)])
    location_verified = models.BooleanField(default=False, help_text="Staff must verify that the coordinates identify this branch.")
    hours = models.CharField(max_length=150, blank=True)
    is_open = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=ReviewStatus.choices, default=ReviewStatus.PENDING, editable=False)
    notes = models.TextField(blank=True, editable=False)
    version = models.PositiveIntegerField(default=1, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.name


def document_path(instance, filename):
    return f"pharmacy-applications/{instance.application_id}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


def validate_document(value):
    if value.size > 10 * 1024 * 1024:
        raise ValidationError("Documents must be at most 10 MB.")
    position = value.tell()
    header = value.read(8)
    value.seek(position)
    suffix = Path(value.name).suffix.lower()
    signatures = {".pdf": header.startswith(b"%PDF-"), ".png": header.startswith(b"\x89PNG\r\n\x1a\n"), ".jpg": header.startswith(b"\xff\xd8\xff"), ".jpeg": header.startswith(b"\xff\xd8\xff")}
    if not signatures.get(suffix):
        raise ValidationError("Upload a valid PDF, PNG, or JPEG document.")


class PharmacyDocument(models.Model):
    class Kind(models.TextChoices):
        FDA = "FDA", "FDA license"
        BUSINESS = "Business", "Business permit"
        PHARMACIST = "Pharmacist", "Pharmacist credentials"

    application = models.ForeignKey(PharmacyApplication, on_delete=models.PROTECT, related_name="documents")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    file = models.FileField(upload_to=document_path, validators=[validate_document])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("application", "kind"), name="one_pharmacy_document_per_kind")]


class MedicineRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    description = models.CharField(max_length=150, help_text="Strength and dosage form")
    generic = models.CharField(max_length=150, blank=True)
    strength = models.CharField(max_length=100, blank=True)
    form = models.CharField(max_length=80, blank=True)
    unit = models.CharField(max_length=40, default="unit")
    prescription = models.BooleanField(default=True)
    pharmacy = models.ForeignKey(PharmacyApplication, on_delete=models.PROTECT, related_name="medicine_requests")
    status = models.CharField(max_length=16, choices=[(v, v) for v in ("Pending", "Approved", "Rejected")], default="Pending", editable=False)
    notes = models.TextField(blank=True, editable=False)
    version = models.PositiveIntegerField(default=1, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(Lower("name"), Lower("description"), "pharmacy", name="unique_pharmacy_medicine_request")]

    def __str__(self):
        return self.name


class ReviewEvent(models.Model):
    pharmacy = models.ForeignKey(PharmacyApplication, null=True, blank=True, on_delete=models.PROTECT, related_name="history")
    medicine = models.ForeignKey(MedicineRequest, null=True, blank=True, on_delete=models.PROTECT, related_name="history")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    actor_email = models.EmailField()
    previous_status = models.CharField(max_length=16, blank=True)
    status = models.CharField(max_length=16)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [models.CheckConstraint(condition=(models.Q(pharmacy__isnull=False, medicine__isnull=True) | models.Q(pharmacy__isnull=True, medicine__isnull=False)), name="review_event_single_target")]
