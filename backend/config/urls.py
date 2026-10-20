from django.contrib import admin
from django.urls import include, path

urlpatterns = [path("admin/", admin.site.urls), path("api/auth/", include("accounts.urls")), path("api/customer/", include("customer_data.urls")), path("api/rider/", include("riders.urls"))]
urlpatterns += [path("api/administration/", include("administration.urls"))]

from pharmacies.views import PublicCatalogView
urlpatterns += [path("api/pharmacy/", include("pharmacies.urls")), path("api/catalog/", PublicCatalogView.as_view())]
