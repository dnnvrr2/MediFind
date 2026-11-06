from django.urls import path
from .views import RiderDeliveryActionView, RiderDeliveryListView, RiderIssueView, RiderLoginView, RiderMeView
from .applications import OwnApplicationView, AdminApplicationsView, ReviewApplicationView

urlpatterns = [
    path('application/', OwnApplicationView.as_view()),
    path('applications/', AdminApplicationsView.as_view()),
    path('applications/<int:pk>/review/', ReviewApplicationView.as_view()),
    path("token/", RiderLoginView.as_view()),
    path("me/", RiderMeView.as_view()),
    path("deliveries/", RiderDeliveryListView.as_view()),
    path("deliveries/<uuid:pk>/action/", RiderDeliveryActionView.as_view()),
    path("deliveries/<uuid:pk>/issues/", RiderIssueView.as_view()),
]
