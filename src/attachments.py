"""Image attachment validation and processing for homework uploads."""

import base64
import io
import os
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile
from PIL import Image

MAX_IMAGE_COUNT = int(os.getenv("MAX_IMAGE_COUNT", "3"))
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(5 * 1024 * 1024)))
MAX_IMAGE_DIMENSION = int(os.getenv("MAX_IMAGE_DIMENSION", "2048"))

ALLOWED_MIME_TYPES = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}

MIME_BY_FORMAT = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


@dataclass
class ProcessedImage:
    mime_type: str
    base64_data: str


def _normalize_mime(content_type: str | None) -> str | None:
    if not content_type:
        return None
    return content_type.split(";")[0].strip().lower()


async def validate_and_process_images(files: list[UploadFile]) -> list[ProcessedImage]:
    """Validate uploaded images and return base64-encoded payloads for the LLM."""
    if not files:
        return []

    if len(files) > MAX_IMAGE_COUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Massimo {MAX_IMAGE_COUNT} immagini per messaggio",
        )

    processed: list[ProcessedImage] = []

    for upload in files:
        if not upload.filename:
            raise HTTPException(status_code=400, detail="Nome file immagine mancante")

        raw = await upload.read()
        if len(raw) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Immagine troppo grande (max {MAX_IMAGE_BYTES // (1024 * 1024)} MB)",
            )

        mime = _normalize_mime(upload.content_type)
        if mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Formato non supportato. Usa JPEG, PNG o WebP",
            )

        try:
            Image.open(io.BytesIO(raw)).verify()
            image: Image.Image = Image.open(io.BytesIO(raw))
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail="File immagine non valido"
            ) from exc

        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        width, height = image.size
        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            scale = min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height)
            image = image.resize(
                (int(width * scale), int(height * scale)),
                Image.Resampling.LANCZOS,
            )

        output = io.BytesIO()
        save_format = ALLOWED_MIME_TYPES[mime]
        if save_format == "JPEG" and image.mode != "RGB":
            image = image.convert("RGB")
        image.save(output, format=save_format, quality=85)
        encoded = base64.b64encode(output.getvalue()).decode("ascii")

        processed.append(
            ProcessedImage(
                mime_type=MIME_BY_FORMAT[save_format],
                base64_data=encoded,
            )
        )

    return processed
