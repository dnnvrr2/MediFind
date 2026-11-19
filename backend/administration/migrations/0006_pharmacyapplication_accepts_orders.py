from django.db import migrations, models


def preserve_existing_order_setting(apps, schema_editor):
    PharmacyApplication = apps.get_model("administration", "PharmacyApplication")
    PharmacyApplication.objects.all().update(accepts_orders=models.F("is_open"))


class Migration(migrations.Migration):

    dependencies = [
        ("administration", "0005_archived_catalog_entries"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacyapplication",
            name="accepts_orders",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(preserve_existing_order_setting, migrations.RunPython.noop),
    ]
