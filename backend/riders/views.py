from datetime import timedelta
from pathlib import Path
import secrets

from django.contrib.auth import authenticate
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from customer_data.models import CustomerOrder
from .models import DeliveryEvent, DeliveryIssue, RiderDelivery, RiderProfile, customer_confirmation_code
from .serializers import IssueSerializer, RiderDeliverySerializer, RiderSerializer


class RiderLoginThrottle(AnonRateThrottle):
    scope = "login"


def rider_for(request):
    if not request.user.is_authenticated:
        return None
    try:
        profile = request.user.rider_profile
    except RiderProfile.DoesNotExist:
        return None
    return profile if profile.approved and request.user.is_active else None


def request_flag(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "yes"}


class RiderPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return rider_for(request) is not None


class RiderLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RiderLoginThrottle]

    def post(self, request):
        user = authenticate(request, email=str(request.data.get("email", "")).strip().lower(), password=request.data.get("password", ""))
        try:
            profile = user.rider_profile if user else None
        except RiderProfile.DoesNotExist:
            profile = None
        if not user or not user.is_active or not profile or not profile.approved:
            return Response({"detail": "Rider sign-in failed or this rider account is not approved."}, status=status.HTTP_401_UNAUTHORIZED)
        token = RefreshToken.for_user(user)
        return Response({"rider": RiderSerializer(profile).data, "access": str(token.access_token), "refresh": str(token)})


class RiderMeView(APIView):
    permission_classes = [permissions.IsAuthenticated, RiderPermission]

    def get(self, request):
        return Response(RiderSerializer(rider_for(request)).data)

    def patch(self, request):
        profile = rider_for(request)
        if "available" in request.data:
            value = request.data["available"]
            if not isinstance(value, bool):
                return Response({"detail": "Availability must be true or false."}, status=status.HTTP_400_BAD_REQUEST)
            profile.available = value
            profile.save(update_fields=["available"])
        return Response(RiderSerializer(profile).data)


class RiderDeliveryListView(APIView):
    permission_classes = [permissions.IsAuthenticated, RiderPermission]

    def get(self, request):
        qs = RiderDelivery.objects.filter(rider=rider_for(request)).select_related("order").prefetch_related("events")
        bucket = request.query_params.get("bucket")
        if bucket == "active":
            qs = qs.exclude(status__in=["delivered", "returned", "declined", "cancelled"])
        elif bucket == "history":
            qs = qs.filter(status__in=["delivered", "unsuccessful", "returning", "returned", "declined", "cancelled"])
        return Response(RiderDeliverySerializer(qs, many=True).data)


class RiderDeliveryActionView(APIView):
    permission_classes = [permissions.IsAuthenticated, RiderPermission]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "rider_action"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    transitions = {
        "offered": {"accepted", "declined"}, "accepted": {"at_pharmacy"}, "at_pharmacy": {"picked_up"},
        "picked_up": {"out_for_delivery"}, "out_for_delivery": {"delivered", "unsuccessful"},
        "unsuccessful": {"accepted", "returning"}, "returning": {"returned"},
    }

    @transaction.atomic
    def post(self, request, pk):
        delivery = get_object_or_404(RiderDelivery.objects.select_for_update().select_related("order"), pk=pk, rider=rider_for(request))
        target = str(request.data.get("status", ""))
        if target not in self.transitions.get(delivery.status, set()):
            return Response({"detail": f"Cannot change a {delivery.get_status_display()} delivery to that status."}, status=status.HTTP_400_BAD_REQUEST)
        note = str(request.data.get("note", ""))[:500]
        if target == "unsuccessful" and not note.strip():
            return Response({"detail": "Add a brief reason before marking delivery unsuccessful."}, status=status.HTTP_400_BAD_REQUEST)
        if target == "delivered":
            if delivery.confirmation_locked_until and delivery.confirmation_locked_until > timezone.now():
                return Response({"detail": "Too many incorrect codes. Ask dispatch to unlock delivery confirmation."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            supplied = str(request.data.get("confirmation_code", ""))
            supplied_is_valid = len(supplied) == 6 and supplied.isascii() and supplied.isdigit()
            if not supplied_is_valid or not secrets.compare_digest(supplied, customer_confirmation_code(delivery)):
                delivery.confirmation_attempts += 1
                if delivery.confirmation_attempts >= 5:
                    delivery.confirmation_locked_until = timezone.now() + timedelta(minutes=15)
                delivery.save(update_fields=("confirmation_attempts", "confirmation_locked_until", "updated_at"))
                return Response({"detail": "The customer confirmation code is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
            delivery.confirmation_attempts = 0
            delivery.confirmation_locked_until = None
            upload = request.FILES.get("proof")
            if not upload:
                return Response({"detail": "Add a proof-of-delivery photo before completing delivery."}, status=status.HTTP_400_BAD_REQUEST)
            ext = Path(upload.name).suffix.lower()
            if ext not in {".jpg", ".jpeg", ".png"} or upload.size > 8 * 1024 * 1024:
                return Response({"detail": "Use a JPG or PNG photo up to 8 MB."}, status=status.HTTP_400_BAD_REQUEST)
            header = upload.read(8)
            upload.seek(0)
            if not (header.startswith(b"\xff\xd8\xff") or header.startswith(b"\x89PNG\r\n\x1a\n")):
                return Response({"detail": "The photo contents do not match its file type."}, status=status.HTTP_400_BAD_REQUEST)
            cash_confirmed = request_flag(request.data.get("cash_collected", False))
            if delivery.payment_method.lower() in {"cod", "cash_on_delivery"} and not cash_confirmed:
                return Response({"detail": "Confirm that the cash due was collected before completing delivery."}, status=status.HTTP_400_BAD_REQUEST)
            delivery.proof = upload
            delivery.cash_collected = delivery.payment_method.lower() not in {"cod", "cash_on_delivery"} or cash_confirmed
            delivery.completed_at = timezone.now()
        from .services import transition_delivery
        delivery = transition_delivery(delivery, request.user, target, note, confirmation_verified=target == "delivered", proof=request.FILES.get("proof"), cash_collected=delivery.cash_collected)
        return Response(RiderDeliverySerializer(delivery).data)


class RiderIssueView(APIView):
    permission_classes = [permissions.IsAuthenticated, RiderPermission]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "rider_issue"
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, pk):
        delivery = get_object_or_404(RiderDelivery.objects.select_for_update(), pk=pk, rider=rider_for(request))
        if delivery.status not in {"accepted", "at_pharmacy", "picked_up", "out_for_delivery"}:
            return Response({"detail": "Issues can only be reported on an active delivery."}, status=status.HTTP_400_BAD_REQUEST)
        upload = request.FILES.get("photo")
        if upload:
            ext = Path(upload.name).suffix.lower()
            if ext not in {".jpg", ".jpeg", ".png"} or upload.size > 8 * 1024 * 1024:
                return Response({"detail": "Use a JPG or PNG photo up to 8 MB."}, status=status.HTTP_400_BAD_REQUEST)
            header = upload.read(8)
            upload.seek(0)
            if not (header.startswith(b"\xff\xd8\xff") or header.startswith(b"\x89PNG\r\n\x1a\n")):
                return Response({"detail": "The photo contents do not match its file type."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = IssueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        issue = serializer.save(delivery=delivery, rider=rider_for(request), **({"photo": upload} if upload else {}))
        from .services import transition_delivery
        delivery = transition_delivery(delivery, request.user, "unsuccessful", f"Issue reported: {issue.get_reason_display()} - {issue.details[:350]}")
        return Response({"issue": serializer.data, "delivery": RiderDeliverySerializer(delivery).data}, status=status.HTTP_201_CREATED)


class CustomerDeliveryCodeView(APIView):
    """Customer retrieves their code using their order's external reference."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "delivery_code"

    def get(self, request, order_id):
        order = get_object_or_404(CustomerOrder, external_id=order_id, owner=request.user)
        delivery = order.rider_deliveries.filter(status="out_for_delivery").order_by("-created_at").first()
        if not delivery:
            return Response({"detail": "No active delivery is out for delivery."}, status=409)
        if delivery.status != "out_for_delivery":
            return Response({"detail": "The delivery confirmation code is available when your order is out for delivery."}, status=status.HTTP_409_CONFLICT)
        response = Response({"code": customer_confirmation_code(delivery), "delivery_status": delivery.status})
        response["Cache-Control"] = "no-store, private"
        return response
