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
    readonly_fields = ("id", "created_at", "updated_at", "completed_at", "proof_link")
    fields = ("id", "order", "rider", "status", "customer_name", "customer_phone", "delivery_address", "pharmacy_name", "pharmacy_address", "payment_method", "amount_due", "cash_collected", "confirmation_attempts", "confirmation_locked_until", "proof_link", "notes", "created_at", "updated_at", "completed_at")
    actions = ("resolve_as_retry", "resolve_as_return")

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

    def save_model(self, request, obj, form, change):
        old_status = RiderDelivery.objects.filter(pk=obj.pk).values_list("status", flat=True).first() if change else None
        super().save_model(request, obj, form, change)
        if obj.status in {"delivered", "returned", "cancelled"} and not obj.completed_at:
            obj.completed_at = timezone.now()
            obj.save(update_fields=("completed_at",))
        if old_status != obj.status:
            DeliveryEvent.objects.create(delivery=obj, actor=request.user, status=obj.status, note="Status updated by dispatch.")

    @admin.action(description="Resolve unsuccessful delivery: retry")
    def resolve_as_retry(self, request, queryset):
        count = 0
        for delivery in queryset.filter(status="unsuccessful"):
            delivery.status = "accepted"
            delivery.save(update_fields=("status", "updated_at"))
            DeliveryEvent.objects.create(delivery=delivery, actor=request.user, status="accepted", note="Dispatch approved a retry.")
            delivery.issues.filter(resolved_at__isnull=True).update(resolved_at=timezone.now())
            count += 1
        self.message_user(request, f"{count} delivery offer(s) returned to the rider for retry.", messages.SUCCESS)

    @admin.action(description="Resolve unsuccessful delivery: return to pharmacy")
    def resolve_as_return(self, request, queryset):
        count = 0
        for delivery in queryset.filter(status="unsuccessful"):
            delivery.status = "returning"
            delivery.save(update_fields=("status", "updated_at"))
            DeliveryEvent.objects.create(delivery=delivery, actor=request.user, status="returning", note="Dispatch instructed rider to return package to the pharmacy.")
            delivery.issues.filter(resolved_at__isnull=True).update(resolved_at=timezone.now())
            count += 1
        self.message_user(request, f"{count} rider(s) instructed to return the package.", messages.SUCCESS)


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
