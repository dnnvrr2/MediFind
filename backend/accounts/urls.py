from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, LogoutView, MeView, PasswordResetConfirmView, PasswordResetRequestView, RegisterView

urlpatterns = [path("register/", RegisterView.as_view()), path("token/", LoginView.as_view()), path("token/refresh/", TokenRefreshView.as_view()), path("logout/", LogoutView.as_view()), path("me/", MeView.as_view()), path("password-reset/", PasswordResetRequestView.as_view()), path("password-reset/confirm/", PasswordResetConfirmView.as_view())]
