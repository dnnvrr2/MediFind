from rest_framework import serializers
from .models import CustomerOrder, CustomerPrescription

class CustomerOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerOrder
        fields = ("id", "external_id", "data", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

class CustomerPrescriptionSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    class Meta:
        model = CustomerPrescription
        fields = ("id", "external_id", "data", "original_filename", "file_url", "created_at", "updated_at")
        read_only_fields = ("id", "original_filename", "file_url", "created_at", "updated_at")
    def get_file_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(f"/api/customer/prescriptions/{obj.pk}/file/") if obj.file and request else None
