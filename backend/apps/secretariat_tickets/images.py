"""Compression des scans de décharges (Secrétariat) — Pillow.

Objectif : ne pas remplir le VPS. Tout upload est réduit côté serveur :
plus grand côté ramené à 1600 px, conversion JPEG qualité 70 optimisé.
Un scan photo 4000×3000 (~3-5 Mo) tombe typiquement à 200-400 Ko.
En cas d'échec, l'original est conservé (jamais de perte).
"""

import logging
import os
from io import BytesIO

logger = logging.getLogger(__name__)

MAX_PX = 1600
QUALITE = 70


def compresser_image(nom, contenu):
    """Retourne (nom_jpg, ContentFile compressé) ou (None, None) si échec."""
    from django.core.files.base import ContentFile

    try:
        from PIL import Image

        contenu.open() if hasattr(contenu, "open") else None
        img = Image.open(contenu)
        if img.mode in ("RGBA", "LA", "P"):
            fond = Image.new("RGB", img.size, (255, 255, 255))
            fond.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = fond
        else:
            img = img.convert("RGB")
        img.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=QUALITE, optimize=True)
        base = os.path.splitext(os.path.basename(nom or "scan"))[0] or "scan"
        return f"{base}.jpg", ContentFile(buf.getvalue())
    except Exception as exc:  # pragma: no cover - sécurité
        logger.error("Compression décharge échouée (%s) : %s", nom, exc)
        return None, None
