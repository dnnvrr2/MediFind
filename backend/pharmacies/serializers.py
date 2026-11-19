from rest_framework import serializers
from administration.models import PharmacyApplication, MedicineRequest
from administration.serializers import DocumentSerializer, EventSerializer, branch_point
from .models import Inventory, PharmacyAudit
from .branch_details import normalize_contact, validate_contacts, validate_schedule, schedule_summary


class OpeningDayInput(serializers.Serializer):
    day = serializers.IntegerField(min_value=0, max_value=6)
    open = serializers.BooleanField()
    opens = serializers.RegexField(r"^([01]\d|2[0-3]):[0-5]\d$")
    closes = serializers.RegexField(r"^([01]\d|2[0-3]):[0-5]\d$")
    allDay = serializers.BooleanField(default=False)


class ApplicationInput(serializers.ModelSerializer):
    contact_numbers = serializers.ListField(child=serializers.CharField(max_length=30), max_length=5, required=False)
    opening_schedule = OpeningDayInput(many=True, required=False)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, min_value=-90, max_value=90, required=False)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=6, min_value=-180, max_value=180, required=False)

    class Meta:
        model = PharmacyApplication
        fields = ("name", "address", "applicant", "email", "phone", "hours", "contact_numbers", "opening_schedule", "latitude", "longitude")

    def validate_contact_numbers(self, values):
        return validate_contacts(values)

    def validate_opening_schedule(self, rows):
        return validate_schedule(rows)

    def validate_phone(self, value):
        return normalize_contact(value) if value.strip() else ""

    def validate(self, data):
        has_pin = "latitude" in data or "longitude" in data
        if has_pin and not all(key in data for key in ("latitude", "longitude", "address")):
            raise serializers.ValidationError({"address": "Confirm both the map pin and the branch address."})
        if self.instance and "address" in data:
            address_changed = data["address"] != self.instance.address
            pin_changed = has_pin and (
                data["latitude"] != self.instance.latitude or data["longitude"] != self.instance.longitude
            )
            if address_changed or pin_changed:
                data["location_verified"] = False
            if address_changed and not has_pin:
                data["latitude"] = data["longitude"] = None
        if "contact_numbers" in data:
            data["phone"] = data["contact_numbers"][0] if data["contact_numbers"] else ""
        elif "phone" in data:
            data["contact_numbers"] = [data["phone"]] if data["phone"] else []
        if "opening_schedule" in data and data["opening_schedule"]:
            data["hours"] = schedule_summary(data["opening_schedule"])
        elif "hours" in data:
            data["opening_schedule"] = []
        return data


class MedicineInput(serializers.ModelSerializer):
    generic = serializers.CharField(max_length=150)
    strength = serializers.CharField(max_length=100)
    form = serializers.CharField(max_length=80)
    unit = serializers.CharField(max_length=40)
    class Meta:
        model = MedicineRequest
        fields = ("name", "generic", "strength", "form", "unit", "prescription")


class InventoryInput(serializers.Serializer):
    version = serializers.IntegerField(min_value=0)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    stock = serializers.IntegerField(min_value=0, max_value=1000000)
    low_stock = serializers.IntegerField(min_value=0, max_value=1000000)
    available = serializers.BooleanField()


class DecisionInput(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)
    status = serializers.CharField(max_length=30)
    note = serializers.CharField(max_length=1000, allow_blank=True, default="")
    approved = serializers.ListField(child=serializers.DictField(), default=list)


class UndoOrderInput(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)
    expected_status = serializers.CharField(max_length=30)


def application_data(app):
    return {"id": str(app.pk), "name": app.name, "address": app.address, "applicant": app.applicant, "email": app.email, "phone": app.phone, "hours": app.hours, "contact_numbers": app.contact_numbers, "opening_schedule": app.opening_schedule, "is_open": app.is_open, "accepts_orders": app.accepts_orders, "point": branch_point(app) if app.location_verified else None, "submitted_point": branch_point(app), "status": app.status, "notes": app.notes, "version": app.version, "documents": DocumentSerializer(app.documents.all(), many=True).data, "history": EventSerializer(app.history.all(), many=True).data}


def audit_data(rows):
    return [{"id": row.pk, "action": row.action, "target": row.target, "note": row.note, "actor": row.actor.full_name or row.actor.email, "created_at": row.created_at} for row in rows]
