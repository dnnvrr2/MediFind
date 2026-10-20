from django.contrib import admin
from .models import MedicineRequest, PharmacyApplication, PharmacyDocument, ReviewEvent


class DocumentInline(admin.TabularInline):
    model = PharmacyDocument
    extra = 0

    def has_add_permission(self, request, obj=None):
        return obj is None or obj.status in ("Pending", "Needs Info")

    def has_change_permission(self, request, obj=None):
        return obj is None or obj.status in ("Pending", "Needs Info")

    def has_delete_permission(self, request, obj=None):
        return obj is None or obj.status in ("Pending", "Needs Info")


@admin.register(PharmacyApplication)
class PharmacyAdmin(admin.ModelAdmin):
    list_display = ("name", "applicant", "status", "created_at")
    search_fields = ("name", "address", "email")
    list_filter = ("status",)
    inlines = (DocumentInline,)
    readonly_fields = ("status", "notes", "version", "created_at", "updated_at")

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.status in ("Approved", "Rejected"):
            return tuple(field.name for field in self.model._meta.fields if field.name not in ("latitude", "longitude", "location_verified"))
        return self.readonly_fields

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if change:
            obj.version += 1
        super().save_model(request, obj, form, change)
        ReviewEvent.objects.create(pharmacy=obj, actor=request.user, actor_email=request.user.email, previous_status=obj.status if change else "", status=obj.status, notes="Application details or documents updated." if change else "Application created.")


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MedicineRequest)
class MedicineAdmin(ReadOnlyAdmin):
    list_display = ("name", "description", "pharmacy", "status", "created_at")
    search_fields = ("name", "pharmacy__name")
    list_filter = ("status",)


@admin.register(ReviewEvent)
class HistoryAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "actor_email", "pharmacy", "medicine", "previous_status", "status")
    list_filter = ("status",)
