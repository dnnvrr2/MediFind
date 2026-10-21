from django.contrib import admin
from administration.admin import ReadOnlyAdmin
from .models import PharmacyMember, Inventory, PrescriptionReview, PharmacyOrder, PharmacyAudit, PharmacyInvitation

@admin.register(PharmacyMember)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "pharmacy", "role", "verified_pharmacist", "active")
    list_filter = ("role", "verified_pharmacist", "active")
    search_fields = ("user__email", "pharmacy__name")
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        PharmacyAudit.objects.create(pharmacy=obj.pharmacy, actor=request.user, action="Membership verified or updated", target=str(obj.user_id), note=f"Role: {obj.role}; verified pharmacist: {obj.verified_pharmacist}; active: {obj.active}")

for model in (Inventory, PrescriptionReview, PharmacyOrder, PharmacyAudit, PharmacyInvitation):
    admin.site.register(model, ReadOnlyAdmin)
