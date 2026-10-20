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
        orders = CustomerOrder.objects.order_by("-created_at")[:250]
        riders = RiderProfile.objects.filter(approved=True, available=True, user__is_active=True).select_related("user")
        if request.method == "POST":
            order = CustomerOrder.objects.filter(pk=request.POST.get("order_id")).first()
            rider = riders.filter(pk=request.POST.get("rider_id")).first()
            if not order or not self.has_view_or_change_permission(request, order) or not rider:
                messages.error(request, "Select an order and an approved rider.")
            elif order.rider_deliveries.exclude(status__in=["declined", "cancelled", "returned"]).exists():
                messages.error(request, "This order already has an active or completed rider assignment.")
            elif not request.POST.get("verified_ready"):
                messages.error(request, "Confirm you contacted the pharmacy and verified the sealed order is ready.")
            else:
                data = order.data if isinstance(order.data, dict) else {}
                if data.get("method") != "delivery" or not isinstance(data.get("recipient"), dict) or not isinstance(data.get("address"), dict):
                    messages.error(request, "Only delivery orders with complete recipient and address details can be assigned.")
                else:
                    recipient = data["recipient"]
                    source_address = data["address"]
                    allowed_address_fields = ("street", "barangay", "city", "province", "postalCode")
                    delivery_address = {key: str(source_address.get(key, ""))[:255] for key in allowed_address_fields}
                    if not str(recipient.get("name", "")).strip() or not str(recipient.get("phone", "")).strip() or any(not delivery_address[key].strip() for key in allowed_address_fields[:4]):
                        messages.error(request, "The recipient name, phone, street, barangay, city, and province are required.")
                        context = {**self.admin_site.each_context(request), "title": "Dispatch a delivery", "orders": orders, "riders": riders}
                        return render(request, "admin/customer_data/customerorder/dispatch.html", context)
                    pharmacy = data.get("pharmacy") if isinstance(data.get("pharmacy"), dict) else {}
                    payment = str(data.get("payment", "prepaid"))
                    is_cod = "cash on delivery" in payment.lower() or payment.lower() == "cod"
                    try:
                        amount = Decimal(request.POST.get("cod_amount", "0")) if is_cod else Decimal("0")
                    except InvalidOperation:
                        amount = Decimal("-1")
                    if amount < 0 or amount > Decimal("100000"):
                        messages.error(request, "Enter the payable amount confirmed with the pharmacy.")
                        context = {**self.admin_site.each_context(request), "title": "Dispatch a delivery", "orders": orders, "riders": riders}
                        return render(request, "admin/customer_data/customerorder/dispatch.html", context)
                    delivery = RiderDelivery.objects.create(
                        rider=rider, order=order, customer_name=str(recipient.get("name", ""))[:160],
                        customer_phone=str(recipient.get("phone", ""))[:32], delivery_address=delivery_address,
                        pharmacy_name=str(pharmacy.get("name", "Pharmacy"))[:160], pharmacy_address=str(pharmacy.get("address", ""))[:500],
                        payment_method="cod" if is_cod else "prepaid", amount_due=amount, status="offered",
                    )
                    DeliveryEvent.objects.create(delivery=delivery, actor=request.user, status="offered", note="Assigned by dispatch after pharmacy readiness confirmation.")
                    messages.success(request, f"Order {order.external_id} assigned to {rider.user.full_name or rider.user.email}.")
                    return redirect("admin:customer_data_customerorder_dispatch")
        context = {**self.admin_site.each_context(request), "title": "Dispatch a delivery", "orders": orders, "riders": riders}
        return render(request, "admin/customer_data/customerorder/dispatch.html", context)


admin.site.register(CustomerPrescription)
