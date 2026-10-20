from django.urls import path
from .views import DocumentView, MedicinesView, MedicineReviewView, PharmaciesView, PharmacyLocationView, ReviewView

urlpatterns = [
    path("pharmacies/", PharmaciesView.as_view()),
    path("pharmacies/<uuid:pk>/review/", ReviewView.as_view()),
    path("pharmacies/<uuid:pk>/location/", PharmacyLocationView.as_view()),
    path("medicines/", MedicinesView.as_view()),
    path("medicines/<uuid:pk>/review/", MedicineReviewView.as_view()),
    path("documents/<int:pk>/", DocumentView.as_view()),
]
