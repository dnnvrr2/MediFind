from decimal import Decimal
from datetime import timedelta
from tempfile import TemporaryDirectory
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, override_settings
from rest_framework.test import APITestCase
from rest_framework.exceptions import APIException
from rest_framework_simplejwt.tokens import AccessToken
from accounts.models import Customer
from administration.models import PharmacyApplication, MedicineRequest
from customer_data.models import CustomerOrder
from customer_data.admin import CustomerOrderAdmin
from riders.models import RiderProfile, RiderDelivery, customer_confirmation_code
from riders.admin import RiderDeliveryAdmin
from riders.services import transition_delivery
from .models import Inventory, PharmacyMember, PharmacyOrder
from .services import create_order, public_id, order_action, assign_rider


@override_settings(SECURE_SSL_REDIRECT=False, PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class WorkflowConflictTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = Customer.objects.create_user('wf-owner@example.com', 'review-password-123', full_name='Owner')
        cls.customer = Customer.objects.create_user('wf-customer@example.com', 'review-password-123', full_name='Customer')
        cls.staff = Customer.objects.create_superuser('wf-staff@example.com', 'review-password-123', full_name='Staff')
        cls.rider_user = Customer.objects.create_user('wf-rider@example.com', 'review-password-123', full_name='Rider')
        cls.employee = Customer.objects.create_user('wf-employee@example.com', 'review-password-123', full_name='Employee')
        cls.pharmacy = PharmacyApplication.objects.create(name='Workflow branch', address='Carmen, Cagayan de Oro City', applicant='Owner', email='branch@example.com', phone='09123456789', hours='8 AM - 5 PM', status='Approved', is_open=True)
        PharmacyMember.objects.create(user=cls.owner, pharmacy=cls.pharmacy, role='owner')
        cls.product = MedicineRequest.objects.create(pharmacy=cls.pharmacy, name='Workflow product', generic='Generic', strength='1 mg', form='Tablet', unit='tablet', prescription=False, status='Approved')
        cls.inventory = Inventory.objects.create(medicine=cls.product, price=Decimal('4.50'), stock=20)
        cls.rider = RiderProfile.objects.create(user=cls.rider_user, approved=True, available=True)

    def setUp(self):
        self.enterContext(override_settings(MEDIA_ROOT=self.enterContext(TemporaryDirectory())))
        self.client.force_authenticate(self.customer)

    def payload(self, key='checkout-one', quantity=2):
        return {'pharmacy': {'id': str(self.pharmacy.pk)}, 'submissionKey': key, 'method': 'delivery', 'recipient': {'name': 'Customer', 'phone': '09123456789'}, 'address': {'street': 'Test Street', 'barangay': 'Carmen', 'city': 'Cagayan de Oro City', 'province': 'Misamis Oriental', 'postalCode': '9000'}, 'lines': [{'medicine': {'id': public_id(self.product)}, 'quantity': quantity}]}

    def order(self, key='checkout-one'):
        return create_order(self.customer, 'ORDER-' + key, self.payload(key))

    def ready(self):
        order = self.order()
        managed = PharmacyOrder.objects.get(order=order)
        for target in ('confirmed', 'preparing', 'ready_for_collection'):
            managed = order_action(managed, self.owner, target)
        return order, managed

    def dispatch_request(self, order):
        req = RequestFactory().post('/admin/customer_data/customerorder/dispatch/', {'order_id': order.pk, 'rider_id': self.rider.pk, 'verified_ready': 'yes', 'cod_amount': '0'})
        req.user = self.staff
        SessionMiddleware(lambda request: None).process_request(req)
        req._messages = FallbackStorage(req)
        return req

    def test_identical_checkout_retry_reuses_order_but_different_cart_is_rejected(self):
        first = self.order()
        retry = create_order(self.customer, 'ORDER-retry', self.payload())
        self.assertEqual(retry.pk, first.pk)
        with self.assertRaises(APIException):
            create_order(self.customer, 'ORDER-different', self.payload(quantity=7))
        self.assertEqual(CustomerOrder.objects.filter(owner=self.customer).count(), 1)
        response = self.client.post('/api/customer/orders/', {'external_id': first.external_id, 'data': self.payload(quantity=7)}, format='json')
        self.assertEqual(response.status_code, 409)

    def test_admin_dispatch_cannot_bypass_pharmacy_acceptance_or_cancelled_order(self):
        order = self.order()
        admin = CustomerOrderAdmin(CustomerOrder, AdminSite())
        response = admin.dispatch_view(self.dispatch_request(order))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(RiderDelivery.objects.filter(order=order).exists())
        managed = PharmacyOrder.objects.get(order=order)
        order_action(managed, self.customer, 'cancelled', 'Customer cancelled.')
        with self.assertRaises(APIException):
            assign_rider(order, self.rider, self.staff)
        self.assertFalse(RiderDelivery.objects.filter(order=order).exists())

    def test_admin_and_pharmacy_handoff_share_readiness_and_saved_payment(self):
        order, managed = self.ready()
        response = CustomerOrderAdmin(CustomerOrder, AdminSite()).dispatch_view(self.dispatch_request(order))
        self.assertEqual(response.status_code, 302)
        delivery = RiderDelivery.objects.get(order=order)
        self.assertEqual(delivery.amount_due, Decimal('59.00'))
        with self.assertRaises(APIException):
            assign_rider(order, self.rider, self.owner)
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.reserved, 2)

    def test_dispatch_retry_and_return_update_customer_states_and_consume_stock_once(self):
        order, managed = self.ready()
        assign_rider(order, self.rider, self.owner, managed.version)
        delivery = RiderDelivery.objects.get(order=order)
        for target in ('accepted', 'at_pharmacy', 'picked_up', 'out_for_delivery', 'unsuccessful'):
            delivery = transition_delivery(delivery, self.rider_user, target, 'Customer unavailable' if target == 'unsuccessful' else '')
        order.refresh_from_db()
        self.assertEqual(order.data['status'], 'delivery_issue')
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.reserved, 2)
        with self.assertRaises(APIException):
            transition_delivery(delivery, self.rider_user, 'accepted')
        delivery = transition_delivery(delivery, self.staff, 'accepted', 'Retry approved', dispatch=True)
        order.refresh_from_db()
        self.assertEqual(order.data['status'], 'delivery_retry')
        delivery = transition_delivery(delivery, self.rider_user, 'unsuccessful', 'Still unavailable')
        delivery = transition_delivery(delivery, self.staff, 'returning', 'Return instructed', dispatch=True)
        order.refresh_from_db()
        self.assertEqual(order.data['status'], 'returning')
        transition_delivery(delivery, self.rider_user, 'returned')
        order.refresh_from_db(); self.inventory.refresh_from_db()
        self.assertEqual(order.data['status'], 'returned')
        self.assertEqual((self.inventory.stock, self.inventory.reserved), (18, 0))
        with self.assertRaises(APIException):
            transition_delivery(delivery, self.rider_user, 'returned')
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock, 18)

    def test_admin_status_edits_are_blocked_and_actions_synchronize(self):
        order, managed = self.ready()
        assign_rider(order, self.rider, self.owner)
        delivery = RiderDelivery.objects.get(order=order)
        admin = RiderDeliveryAdmin(RiderDelivery, AdminSite())
        delivery.status = 'delivered'
        with self.assertRaises(DjangoValidationError):
            admin.save_model(self.dispatch_request(order), delivery, None, True)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'offered')
        delivery = transition_delivery(delivery, self.rider_user, 'accepted')
        delivery = transition_delivery(delivery, self.rider_user, 'unsuccessful', 'Issue')
        admin.resolve_as_retry(self.dispatch_request(order), RiderDelivery.objects.filter(pk=delivery.pk))
        order.refresh_from_db(); delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'accepted')
        self.assertEqual(order.data['status'], 'delivery_retry')

    def test_rider_delivery_requires_code_proof_and_cash_and_updates_stock(self):
        order, managed = self.ready()
        assign_rider(order, self.rider, self.owner)
        delivery = RiderDelivery.objects.get(order=order)
        for target in ('accepted', 'at_pharmacy', 'picked_up', 'out_for_delivery'):
            delivery = transition_delivery(delivery, self.rider_user, target)
        self.client.force_authenticate(self.rider_user)
        path = f'/api/rider/deliveries/{delivery.pk}/action/'
        invalid = self.client.post(path, {'status': 'delivered', 'confirmation_code': 'invalid'}, format='json')
        self.assertEqual(invalid.status_code, 400)
        data = {'status': 'delivered', 'confirmation_code': customer_confirmation_code(delivery), 'cash_collected': 'true', 'proof': SimpleUploadedFile('proof.png', b'\x89PNG\r\n\x1a\nproof', content_type='image/png')}
        response = self.client.post(path, data, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        order.refresh_from_db(); self.inventory.refresh_from_db()
        self.assertEqual(order.data['status'], 'delivered')
        self.assertEqual((self.inventory.stock, self.inventory.reserved), (18, 0))
        self.assertEqual(self.client.post(path, {'status': 'delivered'}, format='json').status_code, 400)

    def test_approved_branch_is_listed_before_inventory_exists(self):
        empty = PharmacyApplication.objects.create(name='Empty approved branch', address='CDO', applicant='Owner', email='empty@example.com', status='Approved')
        response = self.client.get('/api/catalog/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(str(empty.pk), [row['id'] for row in response.data['pharmacies']])
        self.assertFalse(any(row['pharmacyId'] == str(empty.pk) for row in response.data['offers']))

    def test_public_login_ignores_expired_bearer(self):
        self.client.force_authenticate(user=None)
        expired = AccessToken.for_user(self.customer)
        expired.set_exp(lifetime=timedelta(seconds=-5))
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + str(expired))
        response = self.client.post('/api/auth/token/', {'email': self.customer.email, 'password': 'review-password-123'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_email_alone_never_accepts_invitation_and_renewal_rotates_code(self):
        self.client.force_authenticate(self.owner)
        invite = self.client.post('/api/pharmacy/invitations/', {'email': self.employee.email, 'role': 'pharmacist'}, format='json').data
        self.client.force_authenticate(self.employee)
        path = f"/api/pharmacy/invitations/{invite['id']}/accept/"
        self.assertEqual(self.client.post(path, {}, format='json').status_code, 403)
        incoming = self.client.get('/api/pharmacy/invitations/').data[0]
        self.assertNotIn('acceptance_code', incoming)
        self.assertNotIn('code_digest', incoming)
        self.client.force_authenticate(self.owner)
        renewed = self.client.post('/api/pharmacy/invitations/', {'email': self.employee.email, 'role': 'pharmacist'}, format='json').data
        self.assertNotEqual(invite['acceptance_code'], renewed['acceptance_code'])
        self.client.force_authenticate(self.employee)
        self.assertEqual(self.client.post(path, {'acceptance_code': invite['acceptance_code']}, format='json').status_code, 403)
        self.assertEqual(self.client.post(path, {'acceptance_code': renewed['acceptance_code']}, format='json').status_code, 200)
        self.assertFalse(PharmacyMember.objects.get(user=self.employee).verified_pharmacist)
        self.assertEqual(self.client.post(path, {'acceptance_code': renewed['acceptance_code']}, format='json').status_code, 404)
