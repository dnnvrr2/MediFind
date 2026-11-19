from pathlib import Path
from rest_framework import serializers
from .models import MedicineRequest, PharmacyApplication, PharmacyDocument, ReviewEvent


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewEvent
        fields = ("id", "actor_email", "previous_status", "status", "notes", "created_at")


class DocumentSerializer(serializers.ModelSerializer):
    file_name = serializers.SerializerMethodField()

    def get_file_name(self, obj):
        return obj.get_kind_display() + Path(obj.file.name).suffix.lower()

    name = serializers.CharField(source="get_kind_display")

    class Meta:
        model = PharmacyDocument
        fields = ("id", "kind", "name", "created_at", "file_name")


def branch_point(app):
    if app.latitude is None or app.longitude is None:
        return None
    return {"lat": float(app.latitude), "lon": float(app.longitude)}


class PharmacySerializer(serializers.ModelSerializer):
    documents = DocumentSerializer(many=True, read_only=True)
    history = EventSerializer(many=True, read_only=True)
    point = serializers.SerializerMethodField()
    submitted_point = serializers.SerializerMethodField()

    def get_point(self, obj):
        return branch_point(obj) if obj.location_verified else None

    def get_submitted_point(self, obj):
        return branch_point(obj)

    class Meta:
        model = PharmacyApplication
        fields = ("id", "name", "address", "applicant", "email", "phone", "status", "notes", "version", "created_at", "documents", "history", "point", "submitted_point", "contact_numbers", "hours", "opening_schedule")
        read_only_fields = fields


class MedicineSerializer(serializers.ModelSerializer):
    pharmacy = serializers.CharField(source="pharmacy.name", read_only=True)
    pharmacy_id = serializers.UUIDField(read_only=True)
    history = EventSerializer(many=True, read_only=True)

    class Meta:
        model = MedicineRequest
        fields = ("id", "name", "description", "generic", "strength", "form", "unit", "prescription", "pharmacy", "pharmacy_id", "status", "notes", "version", "created_at", "history")
        read_only_fields = fields


class DecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("Approved", "Rejected", "Needs Info"))
    notes = serializers.CharField(max_length=1000, allow_blank=True, default="")
    version = serializers.IntegerField(min_value=1)

    def validate(self, data):
        if data["status"] != "Approved" and not data["notes"].strip():
            raise serializers.ValidationError("A reason is required for rejection or requests for information.")
        return data
