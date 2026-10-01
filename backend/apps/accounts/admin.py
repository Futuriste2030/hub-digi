from django.contrib import admin

from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "username", "role", "department", "poste", "is_active")
    list_filter = ("role", "department", "is_active")
    search_fields = ("email", "username")
