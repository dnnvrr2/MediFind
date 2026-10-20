import django.core.validators
import django.db.models.deletion
import riders.models
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("customer_data", "0001_initial"),
    ]
    operations = [
        migrations.CreateModel(
            name="RiderProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("approved", models.BooleanField(default=False)),
                ("available", models.BooleanField(default=False)),
                ("vehicle", models.CharField(blank=True, max_length=80)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="rider_profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="RiderDelivery",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("offered", "Offered"), ("accepted", "Accepted"), ("at_pharmacy", "At pharmacy"), ("picked_up", "Picked up"), ("out_for_delivery", "Out for delivery"), ("delivered", "Delivered"), ("unsuccessful", "Unsuccessful"), ("returning", "Returning to pharmacy"), ("returned", "Returned"), ("declined", "Declined"), ("cancelled", "Cancelled")], default="offered", max_length=24)),
                ("customer_name", models.CharField(max_length=160)),
                ("customer_phone", models.CharField(max_length=32)),
                ("delivery_address", models.JSONField(default=dict)),
                ("pharmacy_name", models.CharField(max_length=160)),
                ("pharmacy_address", models.CharField(blank=True, max_length=500)),
                ("payment_method", models.CharField(default="prepaid", max_length=32)),
                ("amount_due", models.DecimalField(decimal_places=2, default=0, max_digits=10, validators=[django.core.validators.MinValueValidator(0)])),
                ("cash_collected", models.BooleanField(default=False)),
                ("confirmation_attempts", models.PositiveSmallIntegerField(default=0)),
                ("confirmation_locked_until", models.DateTimeField(blank=True, null=True)),
                ("proof", models.ImageField(blank=True, upload_to=riders.models.proof_upload_path)),
                ("notes", models.TextField(blank=True, max_length=1000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="rider_deliveries", to="customer_data.customerorder")),
                ("rider", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="deliveries", to="riders.riderprofile")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="DeliveryEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("offered", "Offered"), ("accepted", "Accepted"), ("at_pharmacy", "At pharmacy"), ("picked_up", "Picked up"), ("out_for_delivery", "Out for delivery"), ("delivered", "Delivered"), ("unsuccessful", "Unsuccessful"), ("returning", "Returning to pharmacy"), ("returned", "Returned"), ("declined", "Declined"), ("cancelled", "Cancelled")], max_length=24)),
                ("note", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ("delivery", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="riders.riderdelivery")),
            ],
            options={"ordering": ("created_at",)},
        ),
        migrations.CreateModel(
            name="DeliveryIssue",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.CharField(choices=[("unreachable", "Customer unreachable"), ("address", "Incorrect or incomplete address"), ("declined", "Customer declined delivery"), ("other", "Other")], max_length=20)),
                ("details", models.TextField(max_length=1000)),
                ("photo", models.ImageField(blank=True, upload_to=riders.models.issue_upload_path)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("delivery", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="issues", to="riders.riderdelivery")),
                ("rider", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="issues", to="riders.riderprofile")),
            ],
        ),
    ]
