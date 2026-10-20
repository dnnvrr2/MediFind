from django.urls import path
from .views import OrderListCreateView, PrescriptionFileView, PrescriptionListCreateView
from riders.views import CustomerDeliveryCodeView

urlpatterns = [path("orders/", OrderListCreateView.as_view()), path("orders/<str:order_id>/delivery-code/", CustomerDeliveryCodeView.as_view()), path("prescriptions/", PrescriptionListCreateView.as_view()), path("prescriptions/<int:pk>/file/", PrescriptionFileView.as_view())]
