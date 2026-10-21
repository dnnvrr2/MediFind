from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import Customer

class CustomerSerializer(serializers.ModelSerializer):
    pharmacy_status = serializers.SerializerMethodField()
    is_rider = serializers.SerializerMethodField()

    def get_pharmacy_status(self, obj):
        membership = obj.pharmacy_member if hasattr(obj, "pharmacy_member") else None
        return membership.pharmacy.status if membership and membership.active else None

    def get_is_rider(self, obj):
        rider = obj.rider_profile if hasattr(obj, "rider_profile") else None
        return bool(rider and rider.approved)

    class Meta:
        model = Customer
        fields = ("id", "email", "full_name", "phone", "is_staff", "pharmacy_status", "is_rider")
        read_only_fields = ("id", "email", "is_staff", "pharmacy_status", "is_rider")

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    class Meta:
        model = Customer
        fields = ("email", "password", "full_name", "phone")
    def validate_email(self, value):
        normalized = Customer.objects.normalize_email(value).lower()
        if Customer.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized
    def validate_password(self, value):
        candidate = Customer(email=self.initial_data.get("email", ""), full_name=self.initial_data.get("full_name", ""))
        try:
            password_validation.validate_password(value, candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value
    def create(self, validated_data):
        password = validated_data.pop("password")
        return Customer.objects.create_user(password=password, **validated_data)
