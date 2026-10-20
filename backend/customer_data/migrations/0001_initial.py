import customer_data.models
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name="CustomerOrder", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("external_id", models.CharField(max_length=80)), ("data", models.JSONField()),
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="customer_orders", to=settings.AUTH_USER_MODEL)),
        ], options={"ordering": ("-created_at",)}),
        migrations.CreateModel(name="CustomerPrescription", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("external_id", models.CharField(max_length=80)), ("data", models.JSONField(default=dict)),
            ("file", models.FileField(blank=True, upload_to=customer_data.models.prescription_upload_path)),
            ("original_filename", models.CharField(blank=True, max_length=255)),
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="customer_prescriptions", to=settings.AUTH_USER_MODEL)),
        ], options={"ordering": ("-created_at",)}),
        migrations.AddConstraint(model_name="customerorder", constraint=models.UniqueConstraint(fields=("owner", "external_id"), name="unique_customer_order_external_id")),
        migrations.AddConstraint(model_name="customerprescription", constraint=models.UniqueConstraint(fields=("owner", "external_id"), name="unique_customer_prescription_external_id")),
    ]
