from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import Customer
from .models import RiderApplication, RiderApplicationEvent, RiderProfile


class Conflict(APIException):
    status_code = 409


class ApplicationInput(serializers.ModelSerializer):
    phone = serializers.RegexField(r'^(09\d{9}|\+639\d{9})$')

    class Meta:
        model = RiderApplication
        fields = ('full_name', 'phone', 'vehicle', 'plate_number', 'service_area')
        extra_kwargs = {field: {'allow_blank': False} for field in ('full_name', 'vehicle', 'service_area')}

    def validate_full_name(self, value):
        if len(value) < 2:
            raise serializers.ValidationError('Enter your full name.')
        return value


class ApplicationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    history = serializers.SerializerMethodField()

    def get_history(self, obj):
        return [{'id': event.pk, 'status': event.status, 'notes': event.notes,
                 'created_at': event.created_at} for event in obj.events.all()]

    class Meta:
        model = RiderApplication
        fields = ('id', 'email', 'full_name', 'phone', 'vehicle', 'plate_number',
                  'service_area', 'status', 'notes', 'version', 'submitted_at', 'reviewed_at', 'history')


class OwnApplicationView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        application = RiderApplication.objects.filter(user=request.user).prefetch_related('events').first()
        approved = RiderProfile.objects.filter(user=request.user, approved=True).exists()
        return Response({'application': ApplicationSerializer(application).data if application else None,
                         'approved': approved})

    @transaction.atomic
    def post(self, request):
        # Serialize first submissions for the same account as well as resubmissions.
        Customer.objects.select_for_update().get(pk=request.user.pk)
        if RiderProfile.objects.filter(user=request.user, approved=True).exists():
            raise Conflict('You already have an approved rider account.')
        application = RiderApplication.objects.select_for_update().filter(user=request.user).first()
        if application and application.status != 'Rejected':
            raise Conflict('Your application is already submitted. Refresh to view its status.')
        form = ApplicationInput(data=request.data)
        form.is_valid(raise_exception=True)
        if application:
            for field, value in form.validated_data.items():
                setattr(application, field, value)
            application.status = 'Pending'
            application.notes = ''
            application.reviewed_by = None
            application.reviewed_at = None
            application.submitted_at = timezone.now()
            application.version += 1
            application.save()
        else:
            application = form.save(user=request.user)
        RiderApplicationEvent.objects.create(application=application, actor=request.user,
                                             status='Pending', notes='Application submitted for review.')
        return Response(ApplicationSerializer(application).data, status=201)


class AdminApplicationsView(APIView):
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request):
        rows = RiderApplication.objects.select_related('user').prefetch_related('events').order_by('-submitted_at')
        return Response(ApplicationSerializer(rows, many=True).data)


class DecisionInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=('Approved', 'Rejected'))
    notes = serializers.CharField(max_length=1000, allow_blank=True, default='')
    version = serializers.IntegerField(min_value=1)

    def validate(self, data):
        if data['status'] == 'Rejected' and not data['notes']:
            raise serializers.ValidationError({'notes': 'Explain why the application was rejected.'})
        return data


class ReviewApplicationView(APIView):
    permission_classes = (permissions.IsAdminUser,)

    @transaction.atomic
    def post(self, request, pk):
        form = DecisionInput(data=request.data)
        form.is_valid(raise_exception=True)
        data = form.validated_data
        candidate = get_object_or_404(RiderApplication, pk=pk)
        user = Customer.objects.select_for_update().get(pk=candidate.user_id)
        application = RiderApplication.objects.select_for_update().get(pk=pk)
        if application.status != 'Pending' or application.version != data['version']:
            raise Conflict('This application changed. Refresh before reviewing it again.')
        if data['status'] == 'Approved':
            if not user.is_active:
                raise serializers.ValidationError('An inactive account cannot be approved.')
            rider, _ = RiderProfile.objects.select_for_update().get_or_create(user=user)
            rider.approved = True
            rider.vehicle = application.vehicle
            rider.available = False
            rider.save()
        application.status = data['status']
        application.notes = data['notes']
        application.reviewed_by = request.user
        application.reviewed_at = timezone.now()
        application.version += 1
        application.save()
        RiderApplicationEvent.objects.create(application=application, actor=request.user,
                                             status=application.status, notes=application.notes)
        return Response(ApplicationSerializer(application).data)
