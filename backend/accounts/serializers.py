import re

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import Customer

MOBILE_NUMBER_ERRORS = {
    "required": "Enter your mobile number.",
    "blank": "Enter your mobile number.",
    "null": "Enter your mobile number.",
    "invalid": "Invalid number",
    "max_length": "Invalid number",
}


def validate_mobile_number(value):
    compact = re.sub(r"[\s().-]", "", value)
    if not re.fullmatch(r"(?:09|\+639)[0-9]{9}", compact):
        raise serializers.ValidationError("Invalid number")


def full_name_from_parts(first_name, last_name):
    errors = {}
    if not first_name:
        errors["first_name"] = "Enter your first name."
    if not last_name:
        errors["last_name"] = "Enter your last name."
    if errors:
        raise serializers.ValidationError(errors)

    full_name = f"{first_name} {last_name}"
    if len(full_name) > 120:
        raise serializers.ValidationError({"last_name": "Use 120 characters or fewer for your full name."})
    return full_name


class CustomerSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(max_length=120, required=False)
    last_name = serializers.CharField(max_length=120, required=False)
    phone = serializers.CharField(max_length=24, required=False, validators=[validate_mobile_number], error_messages=MOBILE_NUMBER_ERRORS)
    pharmacy_status = serializers.SerializerMethodField()
    is_rider = serializers.SerializerMethodField()

    def get_pharmacy_status(self, obj):
        membership = obj.pharmacy_member if hasattr(obj, "pharmacy_member") else None
        return membership.pharmacy.status if membership and membership.active and membership.pharmacy.status != "Archived" else None

    def get_is_rider(self, obj):
        rider = obj.rider_profile if hasattr(obj, "rider_profile") else None
        return bool(rider and rider.approved)

    class Meta:
        model = Customer
        fields = ("id", "email", "full_name", "first_name", "last_name", "phone", "is_staff", "pharmacy_status", "is_rider")
        read_only_fields = ("id", "email", "is_staff", "pharmacy_status", "is_rider")

    def validate(self, attrs):
        if "first_name" in attrs or "last_name" in attrs:
            attrs["full_name"] = full_name_from_parts(attrs.get("first_name"), attrs.get("last_name"))
        return attrs

    def update(self, instance, validated_data):
        full_name = validated_data.get("full_name", instance.full_name)
        if "first_name" not in validated_data and full_name != instance.full_name:
            first_name = instance.first_name
            if first_name and (full_name == first_name or full_name.startswith(first_name + " ")):
                last_name = full_name[len(first_name):].strip()
            else:
                first_name, _, last_name = full_name.partition(" ")
            validated_data.update(first_name=first_name, last_name=last_name.strip())
        return super().update(instance, validated_data)

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    first_name = serializers.CharField(max_length=120, required=False)
    last_name = serializers.CharField(max_length=120, required=False)
    full_name = serializers.CharField(max_length=120, required=False)
    phone = serializers.CharField(max_length=24, validators=[validate_mobile_number], error_messages=MOBILE_NUMBER_ERRORS)

    class Meta:
        model = Customer
        fields = ("email", "password", "first_name", "last_name", "full_name", "phone")

    def validate_email(self, value):
        normalized = Customer.objects.normalize_email(value).lower()
        if Customer.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate(self, attrs):
        first_name = attrs.get("first_name")
        last_name = attrs.get("last_name")
        if first_name or last_name or "full_name" not in attrs:
            full_name = full_name_from_parts(first_name, last_name)
        else:
            full_name = attrs["full_name"]
            first_name, _, last_name = full_name.partition(" ")

        candidate = Customer(email=attrs["email"], full_name=full_name, first_name=first_name, last_name=last_name)
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        attrs.update(full_name=full_name, first_name=first_name, last_name=last_name.strip())
        return attrs
    def create(self, validated_data):
        password = validated_data.pop("password")
        return Customer.objects.create_user(password=password, **validated_data)
