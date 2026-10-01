# HUB DIGI — image prod single-container (pattern DIGI-AGENCY).
# Stage front : build Vite avec les ARGs prod. Stage python : Django + gunicorn,
# WhiteNoise sert /static/ + build Vite, /media/ servi par Django (volume).
ARG VITE_API_URL=https://hub.digicom.ml/api/v1
ARG VITE_PAIEMENT_ACTIF=false

FROM node:22-slim AS front
WORKDIR /front
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL
ARG VITE_PAIEMENT_ACTIF
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_PAIEMENT_ACTIF=${VITE_PAIEMENT_ACTIF}
RUN npm run build

FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# Build Vite -> servi par WhiteNoise (WHITENOISE_ROOT) + fallback SPA index.html
COPY --from=front /front/dist ./frontend_dist

RUN python manage.py collectstatic --noinput

RUN useradd --create-home --no-log-init appuser \
    && mkdir -p /app/media /data \
    && chown -R appuser:appuser /app/media /data /app/staticfiles /app/frontend_dist
USER appuser

EXPOSE 8000

# Migrate au démarrage (no-op si à jour), puis gunicorn. DB via SQLITE_PATH.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --workers 3 --bind 0.0.0.0:8000 --timeout 60"]
