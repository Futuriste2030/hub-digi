"""URLs HUB DIGI — API sur /api/v1/ (SPEC §12), doc OpenAPI sur /api/docs/.

Prod single-container (pattern DIGI-AGENCY) : nginx proxy tout vers gunicorn,
WhiteNoise sert /static/ + build Vite, Django sert /media/ (volume Docker
invisible depuis l'hôte) et renvoie index.html pour les routes SPA React.
"""

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.departments.urls")),
    path("api/v1/", include("apps.clients.urls")),
    path("api/v1/", include("apps.projects_dev.urls")),
    path("api/v1/", include("apps.finance.urls")),
    path("api/v1/", include("apps.fournisseurs.urls")),
    path("api/v1/", include("apps.secretariat_tickets.urls")),
    path("api/v1/", include("apps.mailing.urls")),
    path("api/v1/", include("apps.rh.urls")),
    path("api/v1/", include("apps.juridique.urls")),
    path("api/v1/", include("apps.com.urls")),
    path("api/v1/", include("apps.bugtracker.urls")),
    path("api/v1/", include("apps.push.urls")),
    path("api/v1/", include("apps.webauthn.urls")),
    path("api/v1/", include("apps.core.urls")),
    path("api/v1/", include("apps.portal_client.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]


def _spa_index(request, chemin=""):
    """Fallback SPA React : toute route non API/admin/static/media -> index.html du build Vite."""
    index = settings.BASE_DIR / "frontend_dist" / "index.html"
    if not index.exists():
        raise Http404("Build frontend absent (frontend_dist/index.html).")
    return FileResponse(open(index, "rb"), content_type="text/html")


# /media/ toujours servi par Django : en prod le volume Docker est invisible
# depuis l'hôte nginx (pattern DIGI-AGENCY), donc pas de alias nginx /media/.
from django.conf.urls.static import static as _static

urlpatterns += _static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# SPA fallback en dernier : ne capte ni /api/* ni /admin/* ni /static/* ni /media/*.
urlpatterns += [re_path(r"^(?!api/|admin/|static/|media/).*$", _spa_index)]
