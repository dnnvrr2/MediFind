from rest_framework import serializers
from .models import DeliveryEvent, DeliveryIssue, RiderDelivery


class RiderSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField(source="user.email")
    full_name = serializers.CharField(source="user.full_name")
    phone = serializers.CharField(source="user.phone")
    vehicle = serializers.CharField()
    available = serializers.BooleanField()


class DeliveryEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryEvent
        fields = ("status", "note", "created_at")


class RiderDeliverySerializer(serializers.ModelSerializer):
    order_reference = serializers.CharField(source="order.external_id", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    proof_uploaded = serializers.SerializerMethodField()
    events = DeliveryEventSerializer(many=True, read_only=True)

    class Meta:
        model = RiderDelivery
        fields = ("id", "order_reference", "status", "status_label", "customer_name", "customer_phone", "delivery_address", "pharmacy_name", "pharmacy_address", "payment_method", "amount_due", "cash_collected", "proof_uploaded", "notes", "events", "created_at", "updated_at")

    def get_proof_uploaded(self, obj):
        return bool(obj.proof)


class IssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryIssue
        fields = ("id", "reason", "details", "created_at")
        read_only_fields = ("id", "created_at")
