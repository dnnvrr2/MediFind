import json
import shutil
import uuid
from pathlib import Path

from django.core.cache import cache
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.tokens import default_token_generator
from django.test import TransactionTestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from accounts.models import Customer
from rest_framework.test import APIClient


class CustomerApiFlowTests(TransactionTestCase):
    password = "MediFind-Demo-Password-123!"

    def setUp(self):
        cache.clear()
        self.media_path = Path(__file__).resolve().parents[2] / f".test-media-{uuid.uuid4().hex}"
        self.media_path.mkdir()
        self.media_override = override_settings(MEDIA_ROOT=str(self.media_path))
        self.media_override.enable()
        self.client = APIClient()

    def tearDown(self):
        self.media_override.disable()
        shutil.rmtree(self.media_path, ignore_errors=True)

    def register(self, email):
        response = self.client.post("/api/auth/register/", {
            "email": email, "password": self.password,
            "full_name": "Test Customer", "phone": "09171234567",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def authenticate(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_register_sign_in_and_update_profile(self):
        created = self.register("customer-one@example.com")
        self.assertEqual(created["customer"]["full_name"], "Test Customer")
        self.authenticate(created["access"])
        response = self.client.patch("/api/auth/me/", {"full_name": "Updated Customer", "phone": "09170000000"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["full_name"], "Updated Customer")
        self.client.credentials()
        login = self.client.post("/api/auth/token/", {"email": "customer-one@example.com", "password": self.password}, format="json")
        self.assertEqual(login.status_code, 200, login.data)
        self.assertIn("refresh", login.data)

    def test_orders_are_scoped_to_the_authenticated_customer(self):
        first = self.register("owner-one@example.com")
        self.authenticate(first["access"])
        created = self.client.post("/api/customer/orders/", {"external_id": "DEMO-000001", "data": {"total": 125.5}}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.client.credentials()
        second = self.register("owner-two@example.com")
        self.authenticate(second["access"])
        listed = self.client.get("/api/customer/orders/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data, [])

    def test_prescription_upload_is_private_and_owner_scoped(self):
        owner = self.register("rx-owner@example.com")
        self.authenticate(owner["access"])
        png = b"\x89PNG\r\n\x1a\n" + b"test-image-data"
        uploaded = SimpleUploadedFile("sample.png", png, content_type="image/png")
        record = {"id": "RX-0001", "status": "draft", "revision": 1,
                  "createdAt": 1700000000000, "updatedAt": 1700000000000,
                  "file": {"uri": "", "name": "sample.png", "mimeType": "image/png", "size": len(png)},
                  "requested": [], "pharmacyId": "", "approved": [], "note": ""}
        response = self.client.post("/api/customer/prescriptions/", {
            "external_id": "RX-0001", "data": json.dumps(record), "file": uploaded,
        }, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        file_path = f"/api/customer/prescriptions/{response.data['id']}/file/"
        self.assertTrue(response.data["file_url"].endswith(file_path))
        file_response = self.client.get(file_path)
        self.assertEqual(file_response.status_code, 200)
        contents = b"".join(file_response.streaming_content)
        file_response.close()
        self.assertEqual(contents, png)
        self.client.credentials()
        stranger = self.register("rx-stranger@example.com")
        self.authenticate(stranger["access"])
        self.assertEqual(self.client.get(file_path).status_code, 404)

    def test_logout_blacklists_refresh_token(self):
        account = self.register("logout@example.com")
        self.authenticate(account["access"])
        response = self.client.post("/api/auth/logout/", {"refresh": account["refresh"]}, format="json")
        self.assertEqual(response.status_code, 204)
        refresh = self.client.post("/api/auth/token/refresh/", {"refresh": account["refresh"]}, format="json")
        self.assertEqual(refresh.status_code, 401)

    def test_prescription_rejects_a_file_with_mismatched_content(self):
        account = self.register("rx-invalid@example.com")
        self.authenticate(account["access"])
        upload = SimpleUploadedFile("not-an-image.png", b"plain text", content_type="image/png")
        response = self.client.post("/api/customer/prescriptions/", {"external_id": "RX-BAD", "data": "{}", "file": upload}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.data)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", FRONTEND_BASE_URL="http://localhost:8081")
    def test_password_reset_is_generic_and_confirmation_changes_password(self):
        account = self.register("reset@example.com")
        self.client.credentials()
        missing = self.client.post("/api/auth/password-reset/", {"email": "unknown@example.com"}, format="json")
        known = self.client.post("/api/auth/password-reset/", {"email": "reset@example.com"}, format="json")
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(known.data, missing.data)
        self.assertEqual(len(mail.outbox), 1)
        user = Customer.objects.get(email="reset@example.com")
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        self.assertIn(f"uid={uid}&token={token}", mail.outbox[0].body)
        changed = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "A-new-strong-password-934!"}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password("A-new-strong-password-934!"))
        reused = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "Another-new-password-993!"}, format="json")
        self.assertEqual(reused.status_code, 400)
