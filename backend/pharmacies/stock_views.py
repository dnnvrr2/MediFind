from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .services import member_for
from . import stock_imports as stock


class StockView(APIView):
    permission_classes = (IsAuthenticated,)


class SettingsView(StockView):
    def get(self, request):
        return Response(stock.settings_data(member_for(request.user)))

    def patch(self, request):
        return Response(stock.save_settings(member_for(request.user), request.data))


class TemplateView(StockView):
    def get(self, request):
        return Response(stock.template_data(member_for(request.user)))


class UploadView(StockView):
    def post(self, request):
        return Response(stock.upload_csv(member_for(request.user), request.FILES.get("file")), status=201)


class PreviewView(StockView):
    def post(self, request, pk):
        return Response(stock.preview_import(member_for(request.user), pk, request.data.get("mapping")))


class ConfirmView(StockView):
    def post(self, request, pk):
        return Response(stock.confirm_import(member_for(request.user), pk, request.data.get("version")))
