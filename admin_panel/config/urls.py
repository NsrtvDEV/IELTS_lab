from django.contrib import admin
from django.urls import path
from django.views.generic import RedirectView

admin.site.site_header = "BandUp — администрирование"
admin.site.site_title = "BandUp"
admin.site.index_title = "Тесты, пользователи и результаты"

urlpatterns = [
    path("", RedirectView.as_view(url="/admin/")),
    path("admin/", admin.site.urls),
]
