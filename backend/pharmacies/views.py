import copy
from pathlib import Path
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from administration.models import PharmacyApplication, PharmacyDocument, MedicineRequest, ReviewEvent, validate_document
from administration.serializers import MedicineSerializer
from administration.views import Conflict
from riders.models import RiderProfile, RiderDelivery, DeliveryEvent
from .models import PharmacyMember, Inventory, PrescriptionReview, PharmacyOrder
from .serializers import ApplicationInput, MedicineInput, InventoryInput, DecisionInput, application_data, audit_data
from .services import member_for, audit, public_id, medicine_data, pharmacy_data, inventory_rows, inventory_lookup, integer, order_action


class PharmacyView(APIView):
    permission_classes = (IsAuthenticated,)


class MeView(PharmacyView):
    def get(self, request):
        member = PharmacyMember.objects.select_related("pharmacy").filter(user=request.user, active=True).first()
        if not member:
            return Response({"application": None, "role": None, "can_review": False})
        return Response({"application": application_data(member.pharmacy), "role": member.role, "can_review": member.verified_pharmacist and member.pharmacy.status == "Approved"})

    @transaction.atomic
    def post(self, request):
        if PharmacyMember.objects.filter(user=request.user).exists():
            raise Conflict("This account is already linked to a pharmacy.")
        payload = ApplicationInput(data=request.data)
        payload.is_valid(raise_exception=True)
        app = payload.save(status="Draft", is_open=False)
        PharmacyMember.objects.create(user=request.user, pharmacy=app, role="owner")
        ReviewEvent.objects.create(pharmacy=app, actor=request.user, actor_email=request.user.email, status="Draft", notes="Application draft created.")
        return Response(application_data(app), status=201)

    @transaction.atomic
    def patch(self, request):
        member = member_for(request.user, approved=False)
        if member.role != "owner":
            raise PermissionDenied("Only the pharmacy owner may edit branch details.")
        app = PharmacyApplication.objects.select_for_update().get(pk=member.pharmacy_id)
        if app.status == "Pending":
            raise Conflict("Wait for the application review before editing.")
        payload = ApplicationInput(app, data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        if app.status == "Approved" and any(key not in ("phone", "hours") for key in payload.validated_data):
            raise ValidationError("Approved registration details require staff review. You can update phone and opening hours.")
        payload.save(version=app.version + 1)
        audit(app, request.user, "Branch details updated")
        return Response(application_data(app))


class SubmitApplicationView(PharmacyView):
    @transaction.atomic
    def post(self, request):
        member = member_for(request.user, approved=False)
        if member.role != "owner":
            raise PermissionDenied("Only the owner may submit this application.")
        app = PharmacyApplication.objects.select_for_update().get(pk=member.pharmacy_id)
        if app.status not in ("Draft", "Needs Info", "Rejected"):
            raise Conflict("This application is already submitted or approved.")
        kinds = set(app.documents.values_list("kind", flat=True))
        if not {"FDA", "Business", "Pharmacist"}.issubset(kinds):
            raise ValidationError("Attach all three required documents before submission.")
        before = app.status
        app.status = "Pending"
        app.version += 1
        app.save()
        ReviewEvent.objects.create(pharmacy=app, actor=request.user, actor_email=request.user.email, previous_status=before, status="Pending", notes="Application submitted for review.")
        return Response(application_data(app))


class UploadDocumentView(PharmacyView):
    @transaction.atomic
    def post(self, request):
        member = member_for(request.user, approved=False)
        app = PharmacyApplication.objects.select_for_update().get(pk=member.pharmacy_id)
        if member.role != "owner" or app.status not in ("Draft", "Needs Info", "Rejected"):
            raise PermissionDenied("Documents can only be updated by the owner before resubmission.")
        kind = request.data.get("kind")
        upload = request.FILES.get("file")
        if kind not in ("FDA", "Business", "Pharmacist") or not upload:
            raise ValidationError("Choose a document type and file.")
        try:
            validate_document(upload)
        except DjangoValidationError as error:
            raise ValidationError(error.messages)
        PharmacyDocument.objects.update_or_create(application=app, kind=kind, defaults={"file": upload})
        app.version += 1
        app.save(update_fields=["version", "updated_at"])
        audit(app, request.user, "Document uploaded", kind)
        return Response(application_data(app))


class OpenView(PharmacyView):
    def post(self, request):
        member = member_for(request.user)
        if member.role not in ("owner", "pharmacist"):
            raise PermissionDenied("Only an owner or pharmacist can change opening status.")
        value = request.data.get("is_open")
        if not isinstance(value, bool):
            raise ValidationError("Opening status must be true or false.")
        member.pharmacy.is_open = value
        member.pharmacy.save(update_fields=["is_open", "updated_at"])
        audit(member.pharmacy, request.user, "Opened" if value else "Closed")
        return Response(application_data(member.pharmacy))


class MedicinesView(PharmacyView):
    def get(self, request):
        member = member_for(request.user)
        records = MedicineRequest.objects.filter(pharmacy=member.pharmacy).prefetch_related("history").select_related("pharmacy")
        rows = []
        for m in records:
            data = dict(MedicineSerializer(m).data)
            inventory = Inventory.objects.filter(medicine=m).first()
            data.update({"catalog_id": public_id(m), "generic": m.generic, "strength": m.strength, "form": m.form, "unit": m.unit, "prescription": m.prescription, "inventory": None if not inventory else {"price": str(inventory.price), "stock": inventory.stock, "reserved": inventory.reserved, "available": inventory.available, "low_stock": inventory.low_stock, "version": inventory.version}})
            rows.append(data)
        return Response(rows)

    @transaction.atomic
    def post(self, request):
        member = member_for(request.user)
        payload = MedicineInput(data=request.data)
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        description = (values["strength"] + " - " + values["form"])[:150]
        medicine_id = request.data.get("id")
        if medicine_id:
            m = get_object_or_404(MedicineRequest.objects.select_for_update(), pk=medicine_id, pharmacy=member.pharmacy)
            if m.status == "Approved":
                raise Conflict("Approved product details cannot be changed. Request another formulation instead.")
            for key, value in values.items():
                setattr(m, key, value)
            previous = m.status
            m.status = "Pending"
            m.description = description
            m.notes = ""
            m.version += 1
            try:
                with transaction.atomic():
                    m.save()
            except IntegrityError:
                raise Conflict("This medicine request already exists.")
        else:
            previous = ""
            try:
                with transaction.atomic():
                    m = MedicineRequest.objects.create(pharmacy=member.pharmacy, description=description, **values)
            except IntegrityError:
                raise Conflict("This medicine request already exists.")
        ReviewEvent.objects.create(medicine=m, actor=request.user, actor_email=request.user.email, previous_status=previous, status="Pending", notes="Submitted by pharmacy.")
        audit(member.pharmacy, request.user, "Medicine requested", m.pk)
        return Response(MedicineSerializer(m).data, status=201)


class InventoryView(PharmacyView):
    @transaction.atomic
    def post(self, request, pk):
        member = member_for(request.user)
        medicine = get_object_or_404(MedicineRequest.objects.select_for_update(), pk=pk, pharmacy=member.pharmacy, status="Approved")
        payload = InventoryInput(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        row = Inventory.objects.select_for_update().filter(medicine=medicine).first()
        version = data.pop("version")
        if (row.version if row else 0) != version:
            raise Conflict()
        if row and data["stock"] < row.reserved:
            raise ValidationError("Stock cannot be lower than the reserved quantity.")
        if row:
            for key, value in data.items():
                setattr(row, key, value)
            row.version += 1
            row.save()
        else:
            row = Inventory.objects.create(medicine=medicine, **data)
        audit(member.pharmacy, request.user, "Inventory updated", medicine.pk)
        return Response({"version": row.version})


class PrescriptionListView(PharmacyView):
    def get(self, request):
        member = member_for(request.user)
        rows = PrescriptionReview.objects.filter(pharmacy=member.pharmacy).exclude(status="draft").select_related("prescription", "prescription__owner", "reviewer")
        return Response([{"id": row.pk, "reference": row.prescription.external_id, "customer": row.prescription.owner.full_name, "status": row.status, "requested": row.prescription.data.get("requested", []) if member.verified_pharmacist else [], "approved": row.approved if member.verified_pharmacist else [], "note": row.note, "version": row.version, "revision": row.revision, "file_name": row.prescription.original_filename, "reviewer": row.reviewer.full_name if row.reviewer else "", "reviewed_at": row.reviewed_at} for row in rows])


class PrescriptionDecisionView(PharmacyView):
    @transaction.atomic
    def post(self, request, pk):
        member = member_for(request.user)
        if not member.verified_pharmacist:
            raise PermissionDenied("Prescription decisions require a verified pharmacist account.")
        row = get_object_or_404(PrescriptionReview.objects.select_for_update(), pk=pk, pharmacy=member.pharmacy)
        payload = DecisionInput(data=request.data)
        payload.is_valid(raise_exception=True)
        decision = payload.validated_data
        if row.version != decision["version"] or row.status != "pending":
            raise Conflict("This prescription has changed or has already been reviewed.")
        outcome = decision["status"]
        if outcome not in ("approved", "partially_approved", "rejected", "needs_clearer_photo"):
            raise ValidationError("Choose a prescription review outcome.")
        if outcome != "approved" and not decision["note"].strip():
            raise ValidationError("Enter a review reason.")
        lines = decision["approved"] if outcome in ("approved", "partially_approved") else []
        offers = inventory_lookup(member.pharmacy)
        seen = set()
        if outcome in ("approved", "partially_approved") and not lines:
            raise ValidationError("Identify at least one medicine and approved quantity.")
        for item in lines:
            mid = item.get("medicineId")
            qty = integer(item.get("quantity"), "Approved quantity", 100)
            inventory = offers.get(mid)
            if mid in seen or not inventory or not inventory.available or qty > inventory.stock - inventory.reserved:
                raise ValidationError("Approved medicines must be distinct, listed, and in stock.")
            seen.add(mid)
        if not row.prescription.file or not row.prescription.file.storage.exists(row.prescription.file.name):
            raise ValidationError("The prescription file is missing. Request a replacement.")
        lines = [{"medicineId": line["medicineId"], "quantity": line["quantity"]} for line in lines]
        row.status, row.approved, row.note, row.reviewer, row.reviewed_at = outcome, lines, decision["note"], request.user, timezone.now()
        row.version += 1
        row.save()
        record = row.prescription
        record.data = {**record.data, "status": outcome, "approved": lines, "note": row.note, "managed": True, "updatedAt": int(timezone.now().timestamp() * 1000)}
        record.save(update_fields=["data", "updated_at"])
        audit(member.pharmacy, request.user, "Prescription " + outcome, record.external_id, row.note, {"revision": row.revision, "approved": lines, "file": record.file.name})
        return Response({"status": row.status})


class PrescriptionFileView(PharmacyView):
    def get(self, request, pk):
        member = member_for(request.user)
        if not member.verified_pharmacist:
            raise PermissionDenied("Only verified pharmacists can open prescription files.")
        row = get_object_or_404(PrescriptionReview.objects.exclude(status="draft"), pk=pk, pharmacy=member.pharmacy)
        record = row.prescription
        try:
            file = record.file.open("rb")
        except (FileNotFoundError, ValueError):
            raise Http404
        response = FileResponse(file, as_attachment=True, filename=record.original_filename)
        response["Cache-Control"] = "private, no-store"
        return response


def order_data(row):
    delivery = row.order.rider_deliveries.order_by("-created_at").first()
    return {"id": row.pk, "version": row.version, "reservation": row.reservation, "data": row.order.data, "rider": None if not delivery else {"name": delivery.rider.user.full_name, "status": delivery.status, "id": str(delivery.pk)}}


class OrdersView(PharmacyView):
    def get(self, request):
        member = member_for(request.user)
        rows = PharmacyOrder.objects.filter(pharmacy=member.pharmacy).select_related("order")
        return Response([order_data(row) for row in rows.order_by("-created_at")])


class OrderActionView(PharmacyView):
    def post(self, request, pk):
        member = member_for(request.user)
        row = get_object_or_404(PharmacyOrder, pk=pk, pharmacy=member.pharmacy)
        payload = DecisionInput(data=request.data)
        payload.is_valid(raise_exception=True)
        decision = payload.validated_data
        if decision["status"] == "cancelled":
            raise ValidationError("Use rejection for pharmacy-declined orders.")
        row = order_action(row, request.user, decision["status"], decision["note"], decision["version"])
        return Response(order_data(row))


class RidersView(PharmacyView):
    def get(self, request):
        member_for(request.user)
        rows = RiderProfile.objects.filter(approved=True, available=True, user__is_active=True).select_related("user")
        return Response([{"id": row.pk, "name": row.user.full_name, "vehicle": row.vehicle} for row in rows])


class HandoffView(PharmacyView):
    @transaction.atomic
    def post(self, request, pk):
        member = member_for(request.user)
        row = get_object_or_404(PharmacyOrder.objects.select_for_update(), pk=pk, pharmacy=member.pharmacy)
        if request.data.get("version") != row.version:
            raise Conflict()
        order = row.order
        if order.data.get("method") != "delivery" or order.data.get("status") != "ready_for_collection":
            raise Conflict("Only a delivery order ready for collection can be assigned.")
        if order.rider_deliveries.exclude(status__in=["declined", "cancelled"]).exists():
            raise Conflict("This order already has an active or completed rider assignment.")
        rider = get_object_or_404(RiderProfile, pk=request.data.get("rider_id"), approved=True, available=True, user__is_active=True)
        data = order.data
        delivery = RiderDelivery.objects.create(order=order, rider=rider, customer_name=data["recipient"]["name"], customer_phone=data["recipient"]["phone"], delivery_address=data["address"], pharmacy_name=member.pharmacy.name, pharmacy_address=member.pharmacy.address, payment_method="cod", amount_due=data["total"])
        DeliveryEvent.objects.create(delivery=delivery, actor=request.user, status="offered", note="Assigned by pharmacy for sealed package collection.")
        row.version += 1
        row.save(update_fields=["version"])
        audit(member.pharmacy, request.user, "Rider assigned", order.external_id, rider.user.full_name)
        return Response(order_data(row))


class ActivityView(PharmacyView):
    def get(self, request):
        member = member_for(request.user, approved=False)
        rows = audit_data(member.pharmacy.activity.select_related("actor")[:50])
        if not member.verified_pharmacist:
            for row in rows:
                if row["action"].startswith("Prescription"):
                    row["note"] = ""
        return Response(rows)


class PublicCatalogView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    def get(self, request):
        rows = Inventory.objects.filter(medicine__status="Approved", medicine__pharmacy__status="Approved").select_related("medicine", "medicine__pharmacy")
        medicines, pharmacies, offers = {}, {}, []
        for row in rows:
            m, p = row.medicine, row.medicine.pharmacy
            if not m.strength or not m.form or not m.generic:
                continue
            mid = public_id(m)
            medicines[mid], pharmacies[str(p.pk)] = medicine_data(m), pharmacy_data(p)
            offers.append({"medicineId": mid, "pharmacyId": str(p.pk), "price": float(row.price), "stock": row.stock - row.reserved if row.available and p.is_open else 0})
        return Response({"medicines": list(medicines.values()), "pharmacies": list(pharmacies.values()), "offers": offers})


class TeamView(PharmacyView):
    def get(self, request):
        member = member_for(request.user, approved=False)
        rows = PharmacyMember.objects.filter(pharmacy=member.pharmacy).select_related("user") if member.role == "owner" else PharmacyMember.objects.filter(pk=member.pk).select_related("user")
        return Response([{"id": row.pk, "name": row.user.full_name, "email": row.user.email, "role": row.role, "verified_pharmacist": row.verified_pharmacist, "active": row.active} for row in rows])


class OwnDocumentView(PharmacyView):
    def get(self, request, pk):
        member = member_for(request.user, approved=False)
        record = get_object_or_404(PharmacyDocument, pk=pk, application=member.pharmacy)
        try:
            file = record.file.open("rb")
        except (FileNotFoundError, ValueError):
            raise Http404
        response = FileResponse(file, as_attachment=True, filename=record.get_kind_display() + Path(record.file.name).suffix)
        response["Cache-Control"] = "private, no-store"
        return response
