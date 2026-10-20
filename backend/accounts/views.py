from django.conf import settings
from django.contrib.auth import password_validation
from django.contrib.auth.forms import PasswordResetForm
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Customer
from .serializers import CustomerSerializer, RegisterSerializer

class LoginThrottle(AnonRateThrottle):
    scope = "login"
class RegisterThrottle(AnonRateThrottle):
    scope = "register"
class PasswordResetThrottle(AnonRateThrottle):
    scope = "password_reset"

class LoginSerializer(TokenObtainPairSerializer):
    username_field = "email"

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterThrottle]
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        refresh = RefreshToken.for_user(customer)
        return Response({"customer": CustomerSerializer(customer).data, "access": str(refresh.access_token), "refresh": str(refresh)}, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        customer = serializer.user
        return Response({"customer": CustomerSerializer(customer).data, **serializer.validated_data})

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = CustomerSerializer
    def get_object(self):
        return self.request.user

class LogoutView(APIView):
    def post(self, request):
        token = request.data.get("refresh", "")
        if not token:
            return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(token).blacklist()
        except Exception:
            return Response({"detail": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)
from django.conf import settings
class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]
    def post(self, request):
        form = PasswordResetForm(data={"email": request.data.get("email", "")})
        if form.is_valid():
            form.save(request=request, use_https=request.is_secure(), from_email=settings.DEFAULT_FROM_EMAIL,
                      email_template_name="accounts/password_reset_email.txt",
                      subject_template_name="accounts/password_reset_subject.txt",
                      extra_email_context={"frontend_url": settings.FRONTEND_BASE_URL})
        return Response({"detail": "If an account exists for that email, a password reset link will be sent."})

class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]
    def post(self, request):
        try:
            user = Customer.objects.get(pk=force_str(urlsafe_base64_decode(request.data.get("uid", ""))))
            token = request.data.get("token", "")
            if not default_token_generator.check_token(user, token):
                raise ValueError
            password = request.data.get("new_password", "")
            password_validation.validate_password(password, user)
        except (Customer.DoesNotExist, ValueError, TypeError, ValidationError, OverflowError):
            return Response({"detail": "This password reset link is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Your password has been updated. You can now sign in."})
