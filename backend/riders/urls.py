from django.urls import path
from .views import RiderDeliveryActionView, RiderDeliveryListView, RiderIssueView, RiderLoginView, RiderMeView

urlpatterns = [
    path("token/", RiderLoginView.as_view()),
    path("me/", RiderMeView.as_view()),
    path("deliveries/", RiderDeliveryListView.as_view()),
    path("deliveries/<uuid:pk>/action/", RiderDeliveryActionView.as_view()),
    path("deliveries/<uuid:pk>/issues/", RiderIssueView.as_view()),
]
