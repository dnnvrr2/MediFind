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


class PharmacySerializer(serializers.ModelSerializer):
    documents = DocumentSerializer(many=True, read_only=True)
    history = EventSerializer(many=True, read_only=True)
    point = serializers.SerializerMethodField()

    def get_point(self, obj):
        if not obj.location_verified or obj.latitude is None or obj.longitude is None:
            return None
        return {"lat": float(obj.latitude), "lon": float(obj.longitude)}

    class Meta:
        model = PharmacyApplication
        fields = ("id", "name", "address", "applicant", "email", "phone", "status", "notes", "version", "created_at", "documents", "history", "point", "contact_numbers", "hours", "opening_schedule")
        read_only_fields = fields


class MedicineSerializer(serializers.ModelSerializer):
    pharmacy = serializers.CharField(source="pharmacy.name", read_only=True)
    pharmacy_id = serializers.UUIDField(read_only=True)
    history = EventSerializer(many=True, read_only=True)

    class Meta:
        model = MedicineRequest
        fields = ("id", "name", "description", "generic", "strength", "form", "unit", "prescription", "pharmacy", "pharmacy_id", "status", "notes", "version", "created_at", "history")
        read_only_fields = fields


class CreateMedicineSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    description = serializers.CharField(max_length=150, required=False)
    generic = serializers.CharField(max_length=150)
    strength = serializers.CharField(max_length=100)
    form = serializers.CharField(max_length=80)
    unit = serializers.CharField(max_length=40)
    prescription = serializers.BooleanField(default=True)
    pharmacy_id = serializers.UUIDField()


class DecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("Approved", "Rejected", "Needs Info"))
    notes = serializers.CharField(max_length=1000, allow_blank=True, default="")
    version = serializers.IntegerField(min_value=1)

    def validate(self, data):
        if data["status"] != "Approved" and not data["notes"].strip():
            raise serializers.ValidationError("A reason is required for rejection or requests for information.")
        return data
