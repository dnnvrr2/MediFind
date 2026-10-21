from django.urls import path
from . import views
urlpatterns = [
    path("invitations/", views.InvitationsView.as_view()),
    path("invitations/<uuid:pk>/accept/", views.InvitationAcceptView.as_view()),
    path("invitations/<uuid:pk>/cancel/", views.InvitationCancelView.as_view()),
    path("me/", views.MeView.as_view()),
    path("application/submit/", views.SubmitApplicationView.as_view()),
    path("documents/<int:pk>/", views.OwnDocumentView.as_view()),
    path("documents/", views.UploadDocumentView.as_view()),
    path("open/", views.OpenView.as_view()),
    path("medicines/", views.MedicinesView.as_view()),
    path("inventory/<uuid:pk>/", views.InventoryView.as_view()),
    path("prescriptions/", views.PrescriptionListView.as_view()),
    path("prescriptions/<int:pk>/review/", views.PrescriptionDecisionView.as_view()),
    path("prescriptions/<int:pk>/file/", views.PrescriptionFileView.as_view()),
    path("orders/", views.OrdersView.as_view()),
    path("orders/<int:pk>/action/", views.OrderActionView.as_view()),
    path("orders/<int:pk>/handoff/", views.HandoffView.as_view()),
    path("riders/", views.RidersView.as_view()),
    path("team/", views.TeamView.as_view()),
    path("activity/", views.ActivityView.as_view()),
]
