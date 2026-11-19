import json
import shutil
import uuid
from pathlib import Path
from decimal import Decimal

from django.core.cache import cache
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.tokens import default_token_generator
from django.test import TransactionTestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from accounts.models import Customer
from administration.models import MedicineRequest, PharmacyApplication
from customer_data.models import CustomerOrder
from pharmacies.models import Inventory
from pharmacies.services import public_id
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

    def test_registration_requires_a_valid_mobile_number(self):
        details = {
            "email": "mobile-signup@example.com", "password": self.password,
            "full_name": "Test Customer",
        }
        cases = [
            ({}, "Enter your mobile number."),
            ({"phone": "   "}, "Enter your mobile number."),
            ({"phone": "09123"}, "Invalid number"),
        ]
        for fields, message in cases:
            with self.subTest(fields=fields):
                response = self.client.post("/api/auth/register/", {**details, **fields}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["phone"], [message])

        self.assertFalse(Customer.objects.filter(email=details["email"]).exists())
        response = self.client.post(
            "/api/auth/register/", {**details, "phone": "+63 917 123 4567"}, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_registration_preserves_the_entered_first_and_last_names(self):
        details = {
            "email": "split-name@example.com", "password": self.password,
            "first_name": " Maria Clara ", "phone": "09171234567",
        }
        incomplete = self.client.post("/api/auth/register/", details, format="json")
        self.assertEqual(incomplete.status_code, 400)
        self.assertIn("last_name", incomplete.data)

        response = self.client.post(
            "/api/auth/register/", {**details, "last_name": "De la Cruz"}, format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["customer"]["full_name"], "Maria Clara De la Cruz")
        self.assertEqual(response.data["customer"]["first_name"], "Maria Clara")
        self.assertEqual(response.data["customer"]["last_name"], "De la Cruz")

        self.authenticate(response.data["access"])
        updated = self.client.patch("/api/auth/me/", {"full_name": "Maria Clara Santos"}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["first_name"], "Maria Clara")
        self.assertEqual(updated.data["last_name"], "Santos")

    def test_update_profile_saves_split_names_and_requires_a_valid_number(self):
        created = self.register("edit-profile@example.com")
        self.authenticate(created["access"])
        names = {"first_name": "Ana Maria", "last_name": "De los Santos"}
        for number, message in [("", "Enter your mobile number."), ("09123", "Invalid number")]:
            with self.subTest(number=number):
                response = self.client.patch("/api/auth/me/", {**names, "phone": number}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["phone"], [message])

        response = self.client.patch("/api/auth/me/", {**names, "phone": "09171234567"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["first_name"], "Ana Maria")
        self.assertEqual(response.data["last_name"], "De los Santos")
        self.assertEqual(response.data["full_name"], "Ana Maria De los Santos")

        profile = self.client.get("/api/auth/me/")
        self.assertEqual(profile.data["first_name"], "Ana Maria")
        self.assertEqual(profile.data["last_name"], "De los Santos")

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
        pharmacy = PharmacyApplication.objects.create(
            name="Branch", address="Carmen, Cagayan de Oro City", applicant="Owner",
            email="branch@example.com", status="Approved", is_open=True,
        )
        medicine = MedicineRequest.objects.create(
            pharmacy=pharmacy, name="Product", generic="Product", strength="1 mg",
            form="Tablet", description="1 mg tablet", prescription=False, status="Approved",
        )
        Inventory.objects.create(medicine=medicine, price=Decimal("4.50"), stock=10)
        first = self.register("owner-one@example.com")
        self.authenticate(first["access"])
        details = {
            "pharmacy": {"id": str(pharmacy.pk)}, "submissionKey": "owner-one-checkout",
            "method": "pickup", "recipient": {"name": "Customer", "phone": "09171234567"},
            "lines": [{"medicine": {"id": public_id(medicine)}, "quantity": 1}],
        }
        created = self.client.post(
            "/api/customer/orders/", {"external_id": "ORDER-one", "data": details}, format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(created.data["data"]["managed"])

        invalid = self.client.post("/api/customer/orders/", {
            "external_id": "DEMO-blocked", "data": {**details, "pharmacy": {"id": "healthplus"}},
        }, format="json")
        self.assertEqual(invalid.status_code, 400)
        self.assertFalse(CustomerOrder.objects.filter(external_id="DEMO-blocked").exists())

        owner = Customer.objects.get(email="owner-one@example.com")
        CustomerOrder.objects.create(owner=owner, external_id="DEMO-archived", data={"status": "confirmed"})
        listed = self.client.get("/api/customer/orders/")
        self.assertEqual([row["external_id"] for row in listed.data], ["ORDER-one"])

        self.client.credentials()
        second = self.register("owner-two@example.com")
        self.authenticate(second["access"])
        listed = self.client.get("/api/customer/orders/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data, [])

    def test_customer_cannot_submit_a_prescription_decision_without_a_pharmacy(self):
        customer = self.register("rx-without-pharmacist@example.com")
        self.authenticate(customer["access"])
        response = self.client.post("/api/customer/prescriptions/", {
            "external_id": "RX-unverified", "data": {"status": "approved", "pharmacyId": "", "revision": 1},
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get("/api/customer/prescriptions/").data, [])

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
        import re
        match = re.search(r"uid=([^&\s]+)&token=([^\s]+)", mail.outbox[0].body)
        self.assertIsNotNone(match)
        self.assertEqual(match.group(1), uid)
        token = match.group(2)
        changed = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "A-new-strong-password-934!"}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        user.refresh_from_db()
        self.assertTrue(user.check_password("A-new-strong-password-934!"))
        reused = self.client.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "Another-new-password-993!"}, format="json")
        self.assertEqual(reused.status_code, 400)
