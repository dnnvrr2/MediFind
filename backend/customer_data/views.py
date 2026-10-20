from pathlib import Path
import json
from django.http import FileResponse
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import CustomerOrder, CustomerPrescription
from .serializers import CustomerOrderSerializer, CustomerPrescriptionSerializer

class OwnerCollectionMixin:
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return self.model.objects.filter(owner=self.request.user)

class OrderListCreateView(OwnerCollectionMixin, generics.ListCreateAPIView):
    model = CustomerOrder
    serializer_class = CustomerOrderSerializer
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        from riders.models import RiderDelivery
        rows = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        delivery_ids = {row.get("external_id"): row for row in rows}
        deliveries = RiderDelivery.objects.filter(order__owner=request.user).exclude(status__in=["offered", "declined", "cancelled"])
        aliases = {"accepted": "confirmed", "at_pharmacy": "preparing", "picked_up": "preparing", "out_for_delivery": "out_for_delivery", "delivered": "delivered", "unsuccessful": "delivery_failed", "returning": "delivery_failed", "returned": "delivery_failed"}
        customer_notes = {"accepted": "A rider accepted the assignment.", "at_pharmacy": "The rider arrived at the pharmacy.", "picked_up": "The sealed order was picked up.", "out_for_delivery": "The order is out for delivery.", "delivered": "The rider marked the order delivered.", "unsuccessful": "Delivery could not be completed. Dispatch will follow up.", "returning": "The order is being returned to the pharmacy.", "returned": "The order was returned to the pharmacy."}
        for delivery in deliveries:
            row = delivery_ids.get(delivery.order.external_id)
            if not row or not isinstance(row.get("data"), dict) or row["data"].get("managed"):
                continue
            data = dict(row["data"])
            data["status"] = aliases.get(delivery.status, data.get("status"))
            if not isinstance(data.get("events"), list):
                data["events"] = []
            data["events"] = list(data["events"]) + [{"status": aliases.get(event.status, data["status"]), "at": int(event.created_at.timestamp() * 1000), "note": customer_notes.get(event.status, "Delivery status updated.")} for event in delivery.events.all()]
            row["data"] = data
        return response
    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        external_id = str(payload.get("external_id", "")).strip()
        if not external_id or len(external_id) > 80:
            raise ValidationError({"external_id": "This field is required."})
        from pharmacies.models import PharmacyOrder
        from pharmacies.services import create_order, order_action
        submitted = payload.get("data", {})
        if not isinstance(submitted, dict):
            raise ValidationError("Expected order details.")
        existing = CustomerOrder.objects.filter(owner=request.user, external_id=external_id).first()
        managed = PharmacyOrder.objects.filter(order=existing).first() if existing else None
        if managed:
            if submitted.get("status") == "cancelled" and existing.data.get("status") != "cancelled":
                order_action(managed, request.user, "cancelled", "Cancelled by customer.")
                existing.refresh_from_db()
            return Response(self.get_serializer(existing).data)
        managed_order = create_order(request.user, external_id, submitted)
        if managed_order:
            return Response(self.get_serializer(managed_order).data, status=201)
        if not isinstance(submitted, dict):
            raise ValidationError("Expected order details.")
        submitted.pop("managed", None)
        obj, created = CustomerOrder.objects.update_or_create(owner=request.user, external_id=external_id, defaults={"data": submitted})
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class PrescriptionListCreateView(OwnerCollectionMixin, generics.ListCreateAPIView):
    model = CustomerPrescription
    serializer_class = CustomerPrescriptionSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        external_id = str(request.data.get("external_id", "")).strip()
        if not external_id or len(external_id) > 80:
            raise ValidationError({"external_id": "This field is required."})
        upload = request.FILES.get("file")
        if upload:
            if upload.size > 10 * 1024 * 1024:
                raise ValidationError({"file": "Files must be 10 MB or smaller."})
            ext = Path(upload.name).suffix.lower()
            if ext not in {".jpg", ".jpeg", ".png", ".pdf"}:
                raise ValidationError({"file": "Use a JPG, PNG, or PDF file."})
            signatures = {".jpg": (b"\xff\xd8\xff",), ".jpeg": (b"\xff\xd8\xff",), ".png": (b"\x89PNG\r\n\x1a\n",), ".pdf": (b"%PDF-",)}
            head = upload.read(8)
            upload.seek(0)
            if not any(head.startswith(signature) for signature in signatures[ext]):
                raise ValidationError({"file": "The file contents do not match its extension."})
        raw_data = request.data.get("data", {})
        if isinstance(raw_data, str):
            try:
                raw_data = json.loads(raw_data)
            except json.JSONDecodeError:
                raise ValidationError({"data": "Expected a JSON object."})
        if not isinstance(raw_data, dict):
            raise ValidationError({"data": "Expected a JSON object."})
        obj, created = CustomerPrescription.objects.get_or_create(owner=request.user, external_id=external_id)
        from pharmacies.services import save_prescription
        obj.data = save_prescription(obj, raw_data, upload, request.user)
        if upload:
            obj.file = upload
            obj.original_filename = Path(upload.name).name[:255]
        obj.save()
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class PrescriptionFileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, pk):
        record = get_object_or_404(CustomerPrescription, pk=pk, owner=request.user)
        if not record.file:
            return Response({"detail": "No file is attached."}, status=status.HTTP_404_NOT_FOUND)
        content_type = "application/pdf" if record.file.name.lower().endswith(".pdf") else "image/jpeg" if record.file.name.lower().endswith((".jpg", ".jpeg")) else "image/png"
        return FileResponse(record.file.open("rb"), as_attachment=True, filename=record.original_filename or "prescription", content_type=content_type)
