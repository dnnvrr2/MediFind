from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from decimal import Decimal, InvalidOperation
from django.shortcuts import redirect, render
from django.urls import path

from riders.models import DeliveryEvent, RiderDelivery, RiderProfile
from .models import CustomerOrder, CustomerPrescription


@admin.register(CustomerOrder)
class CustomerOrderAdmin(admin.ModelAdmin):
    list_display = ("external_id", "owner", "order_status", "created_at")
    search_fields = ("external_id", "owner__email")
    readonly_fields = ("owner", "external_id", "data", "created_at", "updated_at")
    change_list_template = "admin/customer_data/customerorder/change_list.html"

    def order_status(self, obj):
        return obj.data.get("status", "Unknown")
    order_status.short_description = "Customer preview status"

    def get_urls(self):
        return [path("dispatch/", self.admin_site.admin_view(self.dispatch_view), name="customer_data_customerorder_dispatch")] + super().get_urls()

    def dispatch_view(self, request):
        if not request.user.has_perm("riders.add_riderdelivery") or not self.has_view_or_change_permission(request):
            raise PermissionDenied
        orders = CustomerOrder.objects.filter(pharmacy_order__reservation="held", data__status="ready_for_collection", data__method="delivery").order_by("-created_at")[:250]
        riders = RiderProfile.objects.filter(approved=True, available=True, user__is_active=True).select_related("user")
        if request.method == "POST":
            order = CustomerOrder.objects.filter(pk=request.POST.get("order_id")).first()
            rider = riders.filter(pk=request.POST.get("rider_id")).first()
            if not order or not self.has_view_or_change_permission(request, order) or not rider:
                messages.error(request, "Select an eligible order and an approved rider.")
            elif not request.POST.get("verified_ready"):
                messages.error(request, "Confirm the sealed package is ready.")
            else:
                from pharmacies.services import assign_rider
                from rest_framework.exceptions import APIException
                try:
                    assign_rider(order, rider, request.user)
                except APIException as error:
                    messages.error(request, str(error.detail))
                else:
                    messages.success(request, f"Order {order.external_id} assigned to {rider.user.full_name or rider.user.email}.")
                    return redirect("admin:customer_data_customerorder_dispatch")
        context = {**self.admin_site.each_context(request), "title": "Dispatch a delivery", "orders": orders, "riders": riders}
        return render(request, "admin/customer_data/customerorder/dispatch.html", context)


admin.site.register(CustomerPrescription)
