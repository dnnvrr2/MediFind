from django.urls import reverse
from rest_framework.test import APITestCase
from accounts.models import Customer
from .models import RiderApplication, RiderProfile


class RiderApplicationTests(APITestCase):
    def setUp(self):
        self.applicant = Customer.objects.create_user(email='rider-applicant@example.com', password='test-password', full_name='Test Applicant')
        self.other = Customer.objects.create_user(email='another-rider@example.com', password='test-password')
        self.staff = Customer.objects.create_user(email='reviewer@example.com', password='test-password', is_staff=True)
        self.payload = {'full_name': 'Test Applicant', 'phone': '09123456789', 'vehicle': 'Motorcycle', 'plate_number': 'TEST 123', 'service_area': 'Cagayan de Oro'}
        self.url = '/api/rider/application/'

    def submit(self):
        self.client.force_authenticate(self.applicant)
        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def review(self, app, status='Approved', notes=''):
        self.client.force_authenticate(self.staff)
        return self.client.post(f"/api/rider/applications/{app['id']}/review/", {'status': status, 'version': app['version'], 'notes': notes}, format='json')

    def test_authentication_ownership_and_staff_review_permissions(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)
        app = self.submit()
        self.assertEqual(self.client.get('/api/rider/deliveries/').status_code, 403)
        self.assertEqual(self.client.get('/api/rider/applications/').status_code, 403)
        self.assertEqual(self.client.post(f"/api/rider/applications/{app['id']}/review/", {'status': 'Approved', 'version': 1}, format='json').status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertIsNone(self.client.get(self.url).data['application'])
        self.assertEqual(self.client.get('/api/rider/deliveries/').status_code, 403)

    def test_approval_grants_access_only_to_the_applicant_and_starts_offline(self):
        app = self.submit()
        self.assertFalse(RiderProfile.objects.filter(user=self.applicant).exists())
        response = self.review(app)
        self.assertEqual(response.status_code, 200, response.data)
        rider = RiderProfile.objects.get(user=self.applicant)
        self.assertTrue(rider.approved)
        self.assertFalse(rider.available)
        self.assertEqual(rider.vehicle, 'Motorcycle')
        self.client.force_authenticate(self.applicant)
        self.assertTrue(self.client.get(self.url).data['approved'])
        self.assertEqual(self.client.get('/api/auth/me/').data['is_rider'], True)
        self.assertEqual(self.client.get('/api/rider/deliveries/').status_code, 200)
        self.assertEqual(self.client.post(self.url, self.payload, format='json').status_code, 409)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/rider/deliveries/').status_code, 403)

    def test_rejection_requires_reason_and_allows_resubmission_with_history(self):
        app = self.submit()
        self.assertEqual(self.review(app, 'Rejected').status_code, 400)
        self.assertEqual(self.review(app, 'Rejected', 'Please correct your service area.').status_code, 200)
        self.client.force_authenticate(self.applicant)
        self.assertEqual(self.client.get('/api/rider/me/').status_code, 403)
        self.payload['service_area'] = 'Lapasan, Cagayan de Oro'
        updated = self.submit()
        self.assertEqual(updated['status'], 'Pending')
        self.assertEqual(updated['version'], 3)
        self.assertEqual([row['status'] for row in updated['history']], ['Pending', 'Rejected', 'Pending'])
        self.assertEqual(self.review(app).status_code, 409)
        self.assertEqual(self.review(updated).status_code, 200)
        self.assertEqual(RiderApplication.objects.count(), 1)

    def test_pending_duplicate_and_final_decision_cannot_be_overwritten(self):
        app = self.submit()
        self.assertEqual(self.client.post(self.url, self.payload, format='json').status_code, 409)
        self.assertEqual(self.review(app).status_code, 200)
        self.assertEqual(self.review(app, 'Rejected', 'Changed mind').status_code, 409)
        self.assertTrue(RiderProfile.objects.get(user=self.applicant).approved)

    def test_validation_and_client_cannot_self_approve(self):
        self.client.force_authenticate(self.applicant)
        for field, value in [('phone', '123'), ('full_name', ' '), ('vehicle', ''), ('service_area', ''), ('vehicle', 'x' * 81)]:
            self.assertEqual(self.client.post(self.url, {**self.payload, field: value}, format='json').status_code, 400)
        response = self.client.post(self.url, {**self.payload, 'status': 'Approved', 'approved': True, 'user': self.other.pk}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'Pending')
        self.assertEqual(RiderApplication.objects.get().user, self.applicant)
        self.assertFalse(RiderProfile.objects.filter(user=self.applicant, approved=True).exists())

    def test_existing_approved_riders_do_not_need_to_apply(self):
        RiderProfile.objects.create(user=self.applicant, approved=True)
        self.client.force_authenticate(self.applicant)
        self.assertEqual(self.client.get(self.url).data, {'application': None, 'approved': True})
        self.assertEqual(self.client.post(self.url, self.payload, format='json').status_code, 409)
