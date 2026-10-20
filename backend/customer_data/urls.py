from django.urls import path
from .views import OrderListCreateView, PrescriptionFileView, PrescriptionListCreateView

urlpatterns = [path("orders/", OrderListCreateView.as_view()), path("prescriptions/", PrescriptionListCreateView.as_view()), path("prescriptions/<int:pk>/file/", PrescriptionFileView.as_view())]
