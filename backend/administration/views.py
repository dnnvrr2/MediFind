from django.db import models, transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from pathlib import Path
from rest_framework import serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import MedicineRequest, PharmacyApplication, PharmacyDocument, ReviewEvent
from .serializers import DecisionSerializer, MedicineSerializer, PharmacySerializer


class Conflict(APIException):
    status_code = 409
    default_detail = "This record changed. Refresh before reviewing it again."


class StaffView(APIView):
    permission_classes = (IsAdminUser,)


class PharmaciesView(StaffView):
    def get(self, request):
        records = PharmacyApplication.objects.exclude(status="Archived").prefetch_related("documents", "history")
        return Response(PharmacySerializer(records, many=True).data)

class PharmacyRemoveView(StaffView):
    class Input(serializers.Serializer):
        version = serializers.IntegerField(min_value=1)

    def delete(self, request, pk):
        payload = self.Input(data=request.data)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            pharmacy = get_object_or_404(PharmacyApplication.objects.select_for_update().exclude(status="Archived"), pk=pk)
            if pharmacy.version != payload.validated_data["version"]:
                raise Conflict()
            previous = pharmacy.status
            now = timezone.now()
            changed = PharmacyApplication.objects.filter(pk=pk, version=pharmacy.version, status__in=["Draft", "Pending", "Needs Info", "Approved", "Rejected"]).update(status="Archived", version=pharmacy.version + 1, updated_at=now)
            if not changed:
                raise Conflict()
            MedicineRequest.objects.filter(pharmacy=pharmacy).exclude(status="Archived").update(status="Archived", version=models.F("version") + 1, updated_at=now)
            ReviewEvent.objects.create(pharmacy=pharmacy, actor=request.user, actor_email=request.user.email, previous_status=previous, status="Archived", notes="Pharmacy removed by staff.")
        return Response(status=204)


class MedicinesView(StaffView):
    def get(self, request):
        records = MedicineRequest.objects.exclude(status="Archived").exclude(pharmacy__status="Archived").select_related("pharmacy").prefetch_related("history")
        return Response(MedicineSerializer(records, many=True).data)



class ReviewView(StaffView):
    kind = "pharmacy"

    def post(self, request, pk):
        payload = DecisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        decision = payload.validated_data
        is_pharmacy = self.kind == "pharmacy"
        model = PharmacyApplication if is_pharmacy else MedicineRequest
        with transaction.atomic():
            record = get_object_or_404(model.objects.select_for_update().exclude(status="Archived"), pk=pk)
            if record.version != decision["version"]:
                raise Conflict()
            if record.status not in ("Pending", "Needs Info"):
                raise Conflict("This record has already received a final decision.")
            if not is_pharmacy and decision["status"] == "Needs Info":
                raise ValidationError("Medicine requests can be approved or rejected.")
            if decision["status"] == "Approved":
                if is_pharmacy:
                    documents = list(record.documents.all())
                    if not {"FDA", "Business", "Pharmacist"}.issubset({document.kind for document in documents}):
                        raise ValidationError("Attach the FDA license, business permit, and pharmacist credentials before approval.")
                    if any(not document.file or not document.file.storage.exists(document.file.name) for document in documents):
                        raise ValidationError("A supporting document is missing from storage. Restore it before approval.")
                if not is_pharmacy and not all((record.generic, record.strength, record.form, record.unit)):
                    raise ValidationError("Generic name, strength, form, and unit are required before approval.")
                if not is_pharmacy and record.pharmacy.status != "Approved":
                    raise ValidationError("The pharmacy must be approved before its medicine requests.")
            previous = record.status
            # The version predicate also prevents concurrent writes on SQLite, where row locks are unavailable.
            changed = model.objects.filter(pk=pk, version=decision["version"]).update(status=decision["status"], notes=decision["notes"], version=record.version + 1, updated_at=timezone.now())
            if not changed:
                raise Conflict()
            ReviewEvent.objects.create(**{self.kind: record}, actor=request.user, actor_email=request.user.email, previous_status=previous, status=decision["status"], notes=decision["notes"])
            record.refresh_from_db()
            serializer = PharmacySerializer if is_pharmacy else MedicineSerializer
            return Response(serializer(record).data)


class PharmacyLocationView(StaffView):
    class Input(serializers.Serializer):
        latitude = serializers.DecimalField(max_digits=9, decimal_places=6, min_value=-90, max_value=90)
        longitude = serializers.DecimalField(max_digits=10, decimal_places=6, min_value=-180, max_value=180)

    def post(self, request, pk):
        payload = self.Input(data=request.data)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            pharmacy = get_object_or_404(PharmacyApplication.objects.select_for_update().exclude(status="Archived"), pk=pk)
            pharmacy.latitude = payload.validated_data["latitude"]
            pharmacy.longitude = payload.validated_data["longitude"]
            pharmacy.location_verified = True
            pharmacy.version += 1
            pharmacy.save(update_fields=("latitude", "longitude", "location_verified", "version", "updated_at"))
            ReviewEvent.objects.create(pharmacy=pharmacy, actor=request.user, actor_email=request.user.email, previous_status=pharmacy.status, status=pharmacy.status, notes="Branch map coordinates verified by staff.")
            pharmacy.refresh_from_db()
            return Response(PharmacySerializer(pharmacy).data)


class MedicineReviewView(ReviewView):
    kind = "medicine"


class DocumentView(StaffView):
    def get(self, request, pk):
        document = get_object_or_404(PharmacyDocument.objects.exclude(application__status="Archived"), pk=pk)
        if not document.file:
            raise Http404
        try:
            stream = document.file.open("rb")
        except FileNotFoundError:
            raise Http404
        response = FileResponse(stream, as_attachment=True, filename=f"{document.kind}{Path(document.file.name).suffix}")
        response["Cache-Control"] = "private, no-store"
        return response
