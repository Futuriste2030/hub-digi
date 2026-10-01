"""Settings HUB DIGI — SPEC §2 (Django 5 + DRF + SimpleJWT).

Dev : SQLite par défaut. Prod : PostgreSQL via DATABASE_URL.
Pas de venv dans ce projet : dépendances installées globalement (pip install -r requirements.txt).
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-hubdigi-dev-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
if not DEBUG and SECRET_KEY.startswith("django-insecure-"):
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured("DJANGO_SECRET_KEY prod manquante : renseigner .env sur le VPS.")
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
if DEBUG and "testserver" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append("testserver")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Tiers (SPEC §2)
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "django_otp",
    "django_otp.plugins.otp_totp",
    # HUB DIGI
    "apps.core",
    "apps.accounts",
    "apps.departments",
    "apps.clients",
    "apps.projects_dev",
    "apps.com",
    "apps.finance",
    "apps.fournisseurs",
    "apps.rh",
    "apps.juridique",
    "apps.secretariat_tickets",
    "apps.mailing",
    "apps.bugtracker",
    "apps.portal_client",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # prod : /static/ + build Vite (pattern DIGI-AGENCY)
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "frontend_dist"],  # prod : index.html du build Vite (SPA)
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Base de données : SQLite Django uniquement (choix projet, pas de PostgreSQL) ---
# Prod Docker (pattern DIGI-AGENCY) : SQLITE_PATH=/data/db.sqlite3 via volume.
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": os.getenv("SQLITE_PATH", BASE_DIR / "db.sqlite3")}}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Bamako"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]  # tracker.js (SPEC §9) servi sur /static/tracker.js
STATIC_ROOT = BASE_DIR / "staticfiles"  # prod : collectstatic + nginx /static/ (SPEC §15)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Prod Docker single-container (pattern DIGI-AGENCY) : le build Vite est copié
# dans frontend_dist/ par le Dockerfile ; WhiteNoise le sert à la racine
# (/assets/…, /favicon.ico…), Django renvoie index.html pour les routes SPA.
FRONTEND_DIST = BASE_DIR / "frontend_dist"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
WHITENOISE_USE_FINDERS = True
WHITENOISE_MANIFEST_STRICT = False
WHITENOISE_ROOT = FRONTEND_DIST

# Prod hub.digicom.ml : admin + CSRF derrière nginx TLS (SPEC §15).
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", "https://hub.digicom.ml").split(",")
    if o.strip()
]
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Paiement en ligne : logique conservée, sortie neutralisée tant que PAYMENT_ENABLED=0.
# Backend payer/ reste l'encaissement manuel guichet ; seuls les QR/liens
# pay.digicom.ml imprimés sur PDF sont masqués (apps/finance/pdf.py).
PAYMENT_ENABLED = os.getenv("PAYMENT_ENABLED", "0") == "1"
PAYMENT_URL = os.getenv("PAYMENT_URL", "https://pay.digicom.ml")

# --- CORS : frontend Vite (5199) en dev ---
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5199,http://127.0.0.1:5199").split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.PageNumberPaginationStandard",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.AnonRateThrottle", "rest_framework.throttling.UserRateThrottle"),
    "DEFAULT_THROTTLE_RATES": {"anon": "60/min", "user": "300/min", "webhook": "60/min", "bugs": "30/min"},
}

SPECTACULAR_SETTINGS = {
    "TITLE": "HUB DIGI API",
    "DESCRIPTION": "API interne Digi Com & Technologies (SPEC v1.0).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --- Webhook site vitrine -> HUB (WEBHOOK-CARRIERE.md) ---
CAREER_WEBHOOK_TOKEN = os.getenv("CAREER_WEBHOOK_TOKEN", "")

# --- Mails : console en dev, SMTP dynamique par identité en prod (SPEC §8) ---
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "admin@digicom.ml")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5199")
PASSWORD_RESET_TIMEOUT = 86400  # lien reset valable 24 h (template reset_password)
# SMTP Django (mails système : reset password, notifications) — port 465 => SSL, 587 => TLS.
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587") or 587)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", str(EMAIL_PORT == 465)) == "True"
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", str(EMAIL_PORT == 587 and not EMAIL_USE_SSL)) == "True"
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15") or 15)

# --- Celery (relances, SLA, mails async — SPEC §2) ---
# Sans Redis installé, les tâches tournent en mode eager (synchrone, sans broker).
# Pour du vrai async en prod : CELERY_EAGER=0 + CELERY_BROKER_URL=redis://... (serveur Redis requis).
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "memory://")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "cache+memory://")
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_EAGER", "1") == "1"
CELERY_TIMEZONE = TIME_ZONE
