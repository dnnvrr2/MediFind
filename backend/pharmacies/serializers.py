from rest_framework import serializers
from administration.models import PharmacyApplication, MedicineRequest
from administration.serializers import DocumentSerializer, EventSerializer
from .models import Inventory, PharmacyAudit


class ApplicationInput(serializers.ModelSerializer):
    class Meta:
        model = PharmacyApplication
        fields = ("name", "address", "applicant", "email", "phone", "hours")


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


def application_data(app):
    return {"id": str(app.pk), "name": app.name, "address": app.address, "applicant": app.applicant, "email": app.email, "phone": app.phone, "hours": app.hours, "is_open": app.is_open, "point": {"lat": float(app.latitude), "lon": float(app.longitude)} if app.location_verified and app.latitude is not None and app.longitude is not None else None, "status": app.status, "notes": app.notes, "version": app.version, "documents": DocumentSerializer(app.documents.all(), many=True).data, "history": EventSerializer(app.history.all(), many=True).data}


def audit_data(rows):
    return [{"id": row.pk, "action": row.action, "target": row.target, "note": row.note, "actor": row.actor.full_name or row.actor.email, "created_at": row.created_at} for row in rows]
