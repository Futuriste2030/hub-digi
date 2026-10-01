from django.contrib import admin

from .models import Department, Poste


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("nom", "slug")
    prepopulated_fields = {"slug": ("nom",)}


@admin.register(Poste)
class PosteAdmin(admin.ModelAdmin):
    list_display = ("titre", "department", "niveau")
    list_filter = ("department", "niveau")
