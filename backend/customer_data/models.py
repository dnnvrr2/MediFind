import uuid
from django.conf import settings
from django.db import models

def prescription_upload_path(instance, filename):
    suffix = filename.rsplit(".", 1)[-1].lower()[:8]
    return f"prescriptions/{instance.owner_id}/{uuid.uuid4().hex}.{suffix}"

class CustomerOrder(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="customer_orders")
    external_id = models.CharField(max_length=80)
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=("owner", "external_id"), name="unique_customer_order_external_id")]
        ordering = ("-created_at",)

class CustomerPrescription(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="customer_prescriptions")
    external_id = models.CharField(max_length=80)
    data = models.JSONField(default=dict)
    file = models.FileField(upload_to=prescription_upload_path, blank=True)
    original_filename = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=("owner", "external_id"), name="unique_customer_prescription_external_id")]
        ordering = ("-created_at",)
