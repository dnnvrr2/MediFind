from pathlib import Path
import json
from django.http import FileResponse
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
    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        external_id = str(payload.get("external_id", "")).strip()
        if not external_id:
            raise ValidationError({"external_id": "This field is required."})
        obj, created = CustomerOrder.objects.update_or_create(owner=request.user, external_id=external_id, defaults={"data": payload.get("data", {})})
        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class PrescriptionListCreateView(OwnerCollectionMixin, generics.ListCreateAPIView):
    model = CustomerPrescription
    serializer_class = CustomerPrescriptionSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    def create(self, request, *args, **kwargs):
        external_id = str(request.data.get("external_id", "")).strip()
        if not external_id:
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
        obj.data = raw_data
        if upload:
            if obj.file:
                obj.file.delete(save=False)
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
