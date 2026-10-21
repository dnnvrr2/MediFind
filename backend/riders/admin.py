from django.contrib import admin, messages
from django.http import FileResponse, Http404
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html
from .models import DeliveryEvent, DeliveryIssue, RiderDelivery, RiderProfile


@admin.register(RiderProfile)
class RiderProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "approved", "available", "vehicle")
    list_filter = ("approved", "available")
    search_fields = ("user__email", "user__full_name")


@admin.register(RiderDelivery)
class RiderDeliveryAdmin(admin.ModelAdmin):
    list_display = ("order", "rider", "status", "pharmacy_name", "created_at")
    list_filter = ("status", "payment_method", "created_at")
    search_fields = ("order__external_id", "customer_name", "rider__user__email")
    readonly_fields = ("id", "order", "rider", "status", "customer_name", "customer_phone", "delivery_address", "pharmacy_name", "pharmacy_address", "payment_method", "amount_due", "cash_collected", "created_at", "updated_at", "completed_at", "proof_link")
    fields = ("id", "order", "rider", "status", "customer_name", "customer_phone", "delivery_address", "pharmacy_name", "pharmacy_address", "payment_method", "amount_due", "cash_collected", "confirmation_attempts", "confirmation_locked_until", "proof_link", "notes", "created_at", "updated_at", "completed_at")
    actions = ("resolve_as_retry", "resolve_as_return", "cancel_assignment")

    def get_urls(self):
        return [path("<uuid:pk>/proof/", self.admin_site.admin_view(self.proof_view), name="riders_riderdelivery_proof")] + super().get_urls()

    def proof_link(self, obj):
        if not obj or not obj.proof:
            return "No proof photo uploaded"
        return format_html('<a href="{}">Open private proof photo</a>', reverse("admin:riders_riderdelivery_proof", args=(obj.pk,)))
    proof_link.short_description = "Proof of delivery"

    def proof_view(self, request, pk):
        delivery = RiderDelivery.objects.filter(pk=pk).first()
        if not delivery or not self.has_view_permission(request, delivery) or not delivery.proof:
            raise Http404
        return self._private_image_response(delivery.proof)

    @staticmethod
    def _private_image_response(file_field):
        content_type = "image/png" if file_field.name.lower().endswith(".png") else "image/jpeg"
        response = FileResponse(file_field.open("rb"), content_type=content_type)
        response["Cache-Control"] = "no-store, private"
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Disposition"] = "inline"
        return response

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        from django.core.exceptions import ValidationError
        previous = RiderDelivery.objects.get(pk=obj.pk)
        if obj.status != previous.status:
            raise ValidationError("Use dispatch actions or the rider portal for status updates.")
        # Only notes and confirmation-lock controls can be edited here.
        RiderDelivery.objects.filter(pk=obj.pk).update(notes=obj.notes, confirmation_attempts=obj.confirmation_attempts, confirmation_locked_until=obj.confirmation_locked_until)

    def _resolve(self, request, queryset, target, note):
        from .services import transition_delivery
        from rest_framework.exceptions import APIException
        count = 0
        for delivery in queryset:
            try:
                transition_delivery(delivery, request.user, target, note, dispatch=True)
                count += 1
            except APIException as error:
                self.message_user(request, f"{delivery.order.external_id}: {error.detail}", messages.ERROR)
        self.message_user(request, f"{count} assignment(s) updated.", messages.SUCCESS)

    @admin.action(description="Resolve unsuccessful delivery: retry")
    def resolve_as_retry(self, request, queryset):
        self._resolve(request, queryset.filter(status="unsuccessful"), "accepted", "Dispatch approved a retry.")

    @admin.action(description="Resolve unsuccessful delivery: return to pharmacy")
    def resolve_as_return(self, request, queryset):
        self._resolve(request, queryset.filter(status="unsuccessful"), "returning", "Dispatch instructed return to pharmacy.")

    @admin.action(description="Cancel rider assignment before pickup")
    def cancel_assignment(self, request, queryset):
        self._resolve(request, queryset, "cancelled", "Dispatch cancelled the rider assignment.")


@admin.register(DeliveryIssue)
class DeliveryIssueAdmin(admin.ModelAdmin):
    list_display = ("delivery", "rider", "reason", "created_at", "resolved_at")
    list_filter = ("reason", "resolved_at")
    readonly_fields = ("delivery", "rider", "reason", "details", "photo_link", "created_at")
    list_editable = ("resolved_at",)
    actions = ("mark_resolved",)

    def get_urls(self):
        return [path("<int:pk>/photo/", self.admin_site.admin_view(self.photo_view), name="riders_deliveryissue_photo")] + super().get_urls()

    def photo_link(self, obj):
        if not obj or not obj.photo:
            return "No issue photo attached"
        return format_html('<a href="{}">Open private issue photo</a>', reverse("admin:riders_deliveryissue_photo", args=(obj.pk,)))
    photo_link.short_description = "Issue photo"

    def photo_view(self, request, pk):
        issue = DeliveryIssue.objects.filter(pk=pk).first()
        if not issue or not self.has_view_permission(request, issue) or not issue.photo:
            raise Http404
        return RiderDeliveryAdmin._private_image_response(issue.photo)

    @admin.action(description="Mark selected issues resolved")
    def mark_resolved(self, request, queryset):
        queryset.filter(resolved_at__isnull=True).update(resolved_at=timezone.now())


@admin.register(DeliveryEvent)
class DeliveryEventAdmin(admin.ModelAdmin):
    list_display = ("delivery", "status", "actor", "created_at")
    readonly_fields = ("delivery", "status", "actor", "note", "created_at")

    def has_add_permission(self, request):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.has_perm("riders.view_deliveryevent")

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
