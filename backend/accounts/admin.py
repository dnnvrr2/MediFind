from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from .models import Customer


class CustomerCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = Customer
        fields = ("email", "full_name", "phone")


class CustomerChangeForm(UserChangeForm):
    class Meta:
        model = Customer
        fields = "__all__"


@admin.register(Customer)
class CustomerAdmin(UserAdmin):
    model = Customer
    form = CustomerChangeForm
    add_form = CustomerCreationForm
    ordering = ("email",)
    list_display = ("email", "full_name", "phone", "is_staff", "is_active")
    search_fields = ("email", "full_name")
    fieldsets = ((None, {"fields": ("email", "password")}), ("Personal info", {"fields": ("full_name", "phone")}), ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}), ("Important dates", {"fields": ("last_login", "date_joined")}))
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "full_name", "phone", "password1", "password2", "is_staff", "is_active")} ),)
    filter_horizontal = ("groups", "user_permissions")
