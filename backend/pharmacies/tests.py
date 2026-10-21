from datetime import timedelta
from tempfile import TemporaryDirectory
from django.test import override_settings
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from accounts.models import Customer
from administration.models import PharmacyApplication, PharmacyDocument
from .models import PharmacyMember, PharmacyInvitation


@override_settings(SECURE_SSL_REDIRECT=False)
class PartnershipTests(APITestCase):
    def setUp(self):
        media = self.enterContext(TemporaryDirectory())
        self.enterContext(override_settings(MEDIA_ROOT=media))
        self.owner = Customer.objects.create_user(email="owner@example.com", password="test-password-123", full_name="Branch Owner")
        self.employee = Customer.objects.create_user(email="employee@example.com", password="test-password-123", full_name="Employee")
        self.other = Customer.objects.create_user(email="other@example.com", password="test-password-123", full_name="Other")
        self.client.force_authenticate(self.owner)
        self.details = {"name": "Test Pharmacy", "address": "Carmen, Cagayan de Oro City", "applicant": "Branch Owner", "email": "branch@example.com", "phone": "09123456789", "hours": "8 AM - 5 PM"}

    def draft(self):
        response = self.client.post("/api/pharmacy/me/", self.details, format="json")
        self.assertEqual(response.status_code, 201)
        return PharmacyApplication.objects.get(pk=response.data["id"])

    def approved(self):
        app = self.draft()
        app.status = "Approved"
        app.save(update_fields=["status"])
        return app

    def invite(self, role="pharmacist"):
        response = self.client.post("/api/pharmacy/invitations/", {"email": self.employee.email, "role": role}, format="json")
        self.assertEqual(response.status_code, 201)
        self.invite_code = response.data["acceptance_code"]
        return response.data["id"]

    def test_application_saves_documents_then_submits_for_review(self):
        app = self.draft()
        for kind in ["FDA", "Business", "Pharmacist"]:
            response = self.client.post("/api/pharmacy/documents/", {"kind": kind, "file": SimpleUploadedFile(kind + ".pdf", b"%PDF-1.4\nexample", content_type="application/pdf")}, format="multipart")
            self.assertEqual(response.status_code, 200)
        response = self.client.post("/api/pharmacy/application/submit/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        app.refresh_from_db()
        self.assertEqual(app.status, "Pending")
        self.assertEqual(app.documents.count(), 3)
        self.assertFalse(self.owner.pharmacy_member.verified_pharmacist)
        response = self.client.patch("/api/pharmacy/me/", {"name": "Changed"}, format="json")
        self.assertEqual(response.status_code, 409)

    def test_missing_or_invalid_documents_do_not_submit(self):
        app = self.draft()
        response = self.client.post("/api/pharmacy/documents/", {"kind": "FDA", "file": SimpleUploadedFile("fake.pdf", b"invalid file")}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.post("/api/pharmacy/application/submit/", {}, format="json").status_code, 400)
        app.refresh_from_db()
        self.assertEqual(app.status, "Draft")
        self.assertFalse(PharmacyDocument.objects.filter(application=app).exists())

    def test_only_owner_can_create_invites_and_owner_role_cannot_be_invited(self):
        app = self.approved()
        self.assertEqual(self.client.post("/api/pharmacy/invitations/", {"email": self.employee.email, "role": "owner"}, format="json").status_code, 400)
        PharmacyMember.objects.create(user=self.other, pharmacy=app, role="staff")
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post("/api/pharmacy/invitations/", {"email": self.employee.email, "role": "staff"}, format="json").status_code, 403)

    def test_invitation_is_email_bound_and_does_not_grant_pharmacist_verification(self):
        self.approved()
        invitation = self.invite()
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/pharmacy/invitations/").data, [])
        self.assertEqual(self.client.post(f"/api/pharmacy/invitations/{invitation}/accept/", {}).status_code, 404)
        self.client.force_authenticate(self.employee)
        self.assertEqual(len(self.client.get("/api/pharmacy/invitations/").data), 1)
        self.assertEqual(self.client.post(f"/api/pharmacy/invitations/{invitation}/accept/", {"acceptance_code": self.invite_code}).status_code, 200)
        member = PharmacyMember.objects.get(user=self.employee)
        self.assertEqual(member.role, "pharmacist")
        self.assertFalse(member.verified_pharmacist)
        self.assertFalse(self.client.get("/api/pharmacy/me/").data["can_review"])
        self.assertEqual(self.client.post(f"/api/pharmacy/invitations/{invitation}/accept/", {}).status_code, 404)
        self.assertEqual(PharmacyMember.objects.filter(user=self.employee).count(), 1)

    def test_expired_cancelled_and_unapproved_invitations_cannot_be_accepted(self):
        app = self.approved()
        invitation = self.invite("staff")
        PharmacyInvitation.objects.filter(pk=invitation).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.client.force_authenticate(self.employee)
        self.assertEqual(self.client.post(f"/api/pharmacy/invitations/{invitation}/accept/", {}).status_code, 404)
        self.client.force_authenticate(self.owner)
        invitation = self.invite("staff")
        self.assertEqual(self.client.post(f"/api/pharmacy/invitations/{invitation}/cancel/", {}).status_code, 200)
        self.client.force_authenticate(self.employee)
        self.assertEqual(self.client.post(f"/api/pharmacy/invitations/{invitation}/accept/", {}).status_code, 404)
        self.client.force_authenticate(self.owner)
        invitation = self.invite("staff")
        app.status = "Rejected"
        app.save(update_fields=["status"])
        self.client.force_authenticate(self.employee)
        self.assertEqual(self.client.post(f"/api/pharmacy/invitations/{invitation}/accept/", {}).status_code, 404)
        self.assertFalse(PharmacyMember.objects.filter(user=self.employee).exists())


@override_settings(SECURE_SSL_REDIRECT=False)
class BranchDetailsTests(APITestCase):
    def setUp(self):
        self.owner = Customer.objects.create_user(email="branch-owner@example.com", password="test-password-123", full_name="Owner")
        self.client.force_authenticate(self.owner)
        self.app = PharmacyApplication.objects.create(name="Branch", address="Carmen, CDO", applicant="Owner", email="branch@example.com", status="Approved", phone="09123456789", hours="Legacy hours")
        PharmacyMember.objects.create(user=self.owner, pharmacy=self.app, role="owner")
        self.schedule = [{"day": day, "open": day < 6, "opens": "08:00", "closes": "17:00", "allDay": False} for day in range(7)]

    def test_multiple_contacts_and_schedule_round_trip_and_staff_visibility(self):
        payload = {"contact_numbers": ["09123456789", "+63 998 765 4321"], "opening_schedule": self.schedule}
        response = self.client.patch("/api/pharmacy/me/", payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["contact_numbers"], ["09123456789", "+639987654321"])
        self.assertEqual(response.data["phone"], "09123456789")
        self.assertEqual(response.data["opening_schedule"], self.schedule)
        self.assertEqual(response.data["hours"], "Mon-Sat: 8:00 AM - 5:00 PM; Sun: Closed")
        self.app.refresh_from_db()
        from .services import pharmacy_data
        public = pharmacy_data(self.app)
        self.assertEqual(public["contactNumbers"], ["09123456789", "+639987654321"])
        self.assertEqual(public["hours"], response.data["hours"])

    def test_invalid_secondary_numbers_and_duplicates_cannot_be_saved(self):
        for values in [["09123456789", "09123"], ["09123456789", "+639123456789"], ["+6391234567890"], ["+638123456789"]]:
            response = self.client.patch("/api/pharmacy/me/", {"contact_numbers": values}, format="json")
            self.assertEqual(response.status_code, 400, values)
        self.app.refresh_from_db()
        self.assertEqual(self.app.phone, "09123456789")

    def test_legacy_hours_survive_contact_update_and_legacy_contact_survives_schedule_update(self):
        self.assertEqual(self.client.patch("/api/pharmacy/me/", {"contact_numbers": ["09123456789"]}, format="json").status_code, 200)
        self.app.refresh_from_db()
        self.assertEqual(self.app.hours, "Legacy hours")
        self.assertEqual(self.client.patch("/api/pharmacy/me/", {"opening_schedule": self.schedule}, format="json").status_code, 200)
        self.app.refresh_from_db()
        self.assertEqual(self.app.phone, "09123456789")

    def test_invalid_days_and_equal_times_rejected_but_overnight_and_all_day_accepted(self):
        for rows in [self.schedule[:6], [{**row, "day": 0} for row in self.schedule], [{**row, "opens": "25:00"} for row in self.schedule], [{**row, "closes": row["opens"]} for row in self.schedule]]:
            self.assertEqual(self.client.patch("/api/pharmacy/me/", {"opening_schedule": rows}, format="json").status_code, 400)
        for rows in [[{**row, "opens": "22:00", "closes": "06:00"} for row in self.schedule], [{**row, "allDay": True, "closes": row["opens"]} for row in self.schedule]]:
            self.assertEqual(self.client.patch("/api/pharmacy/me/", {"opening_schedule": rows}, format="json").status_code, 200)
