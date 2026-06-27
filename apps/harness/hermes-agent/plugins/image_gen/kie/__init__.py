"""Kie.ai GPT Image 2 backend."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import requests

from agent.image_gen_provider import (
    DEFAULT_ASPECT_RATIO,
    ImageGenProvider,
    error_response,
    normalize_reference_images,
    resolve_aspect_ratio,
    save_url_image,
    success_response,
)

logger = logging.getLogger(__name__)

API_BASE = "https://api.kie.ai/api/v1"
TEXT_MODEL = "gpt-image-2-text-to-image"
EDIT_MODEL = "gpt-image-2-image-to-image"
DEFAULT_RESOLUTION = "1K"
VALID_RESOLUTIONS = {"1K", "2K", "4K"}
ASPECT_RATIOS = {
    "landscape": "16:9",
    "square": "1:1",
    "portrait": "9:16",
}


def _resolution() -> str:
    value = os.environ.get("KIE_IMAGE_RESOLUTION", DEFAULT_RESOLUTION).upper()
    return value if value in VALID_RESOLUTIONS else DEFAULT_RESOLUTION


def _provider_error(
    message: str,
    *,
    prompt: str,
    aspect_ratio: str,
    model: Optional[str] = None,
    error_type: str = "api_error",
) -> Dict[str, Any]:
    return error_response(
        error=message,
        error_type=error_type,
        provider="kie",
        model=model,
        prompt=prompt,
        aspect_ratio=aspect_ratio,
    )


class KieImageGenProvider(ImageGenProvider):
    @property
    def name(self) -> str:
        return "kie"

    @property
    def display_name(self) -> str:
        return "Kie.ai"

    def is_available(self) -> bool:
        return bool(os.environ.get("KIE_API_KEY"))

    def list_models(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": TEXT_MODEL,
                "display": "GPT Image 2",
                "speed": "~1 min",
                "strengths": "Text-to-image and image editing",
                "price": "$0.03–$0.08",
            },
        ]

    def default_model(self) -> Optional[str]:
        return TEXT_MODEL

    def get_setup_schema(self) -> Dict[str, Any]:
        return {
            "name": "Kie.ai",
            "badge": "paid",
            "tag": "GPT Image 2 through Kie.ai",
            "env_vars": [
                {
                    "key": "KIE_API_KEY",
                    "prompt": "Kie.ai API key",
                    "url": "https://kie.ai/market",
                },
            ],
        }

    def capabilities(self) -> Dict[str, Any]:
        return {"modalities": ["text", "image"], "max_reference_images": 16}

    def generate(
        self,
        prompt: str,
        aspect_ratio: str = DEFAULT_ASPECT_RATIO,
        *,
        image_url: Optional[str] = None,
        reference_image_urls: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        prompt = (prompt or "").strip()
        aspect = resolve_aspect_ratio(aspect_ratio)
        if not prompt:
            return _provider_error(
                "Prompt is required and must be a non-empty string",
                prompt=prompt,
                aspect_ratio=aspect,
                error_type="invalid_argument",
            )

        api_key = os.environ.get("KIE_API_KEY")
        if not api_key:
            return _provider_error(
                "KIE_API_KEY is not configured.",
                prompt=prompt,
                aspect_ratio=aspect,
                error_type="auth_required",
            )

        sources: List[str] = []
        if isinstance(image_url, str) and image_url.strip():
            sources.append(image_url.strip())
        sources.extend(normalize_reference_images(reference_image_urls) or [])
        sources = sources[:16]
        if any(not source.startswith("https://") for source in sources):
            return _provider_error(
                "Kie.ai reference images must use HTTPS URLs.",
                prompt=prompt,
                aspect_ratio=aspect,
                error_type="invalid_argument",
            )

        model = EDIT_MODEL if sources else TEXT_MODEL
        resolution = str(kwargs.get("resolution") or _resolution()).upper()
        if resolution not in VALID_RESOLUTIONS:
            resolution = DEFAULT_RESOLUTION
        provider_aspect = ASPECT_RATIOS[aspect]
        if provider_aspect == "1:1" and resolution == "4K":
            resolution = "2K"

        try:
            create_response = requests.post(
                f"{API_BASE}/jobs/createTask",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "input": {
                        "prompt": prompt,
                        "aspect_ratio": provider_aspect,
                        "resolution": resolution,
                        **({"input_urls": sources} if sources else {}),
                    },
                },
                timeout=30,
            )
            create_response.raise_for_status()
            created = create_response.json()
            if created.get("code") not in (None, 200):
                raise RuntimeError(created.get("msg") or "Task creation failed")
            task_id = (created.get("data") or {}).get("taskId")
            if not task_id:
                raise RuntimeError("Provider did not return a task ID")

            deadline = time.monotonic() + 240
            while time.monotonic() < deadline:
                time.sleep(2.5)
                record_response = requests.get(
                    f"{API_BASE}/jobs/recordInfo",
                    params={"taskId": task_id},
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=30,
                )
                record_response.raise_for_status()
                envelope = record_response.json()
                if envelope.get("code") not in (None, 200):
                    raise RuntimeError(envelope.get("msg") or "Task status failed")
                record = envelope.get("data") or {}
                state = str(record.get("state") or "").lower()
                if state in {"fail", "failed"}:
                    raise RuntimeError(record.get("failMsg") or record.get("failCode") or "Task failed")
                if state != "success":
                    continue

                result = record.get("resultJson") or {}
                if isinstance(result, str):
                    result = json.loads(result)
                urls = result.get("resultUrls") if isinstance(result, dict) else None
                output_url = next((value for value in (urls or []) if isinstance(value, str)), None)
                if not output_url:
                    raise RuntimeError("Completed task did not include an image URL")
                saved_path = save_url_image(output_url, prefix="kie_gpt_image_2")
                return success_response(
                    image=str(saved_path),
                    model=model,
                    prompt=prompt,
                    aspect_ratio=aspect,
                    provider="kie",
                    modality="image" if sources else "text",
                    extra={
                        "task_id": task_id,
                        "resolution": resolution,
                        "provider_aspect_ratio": provider_aspect,
                    },
                )
            raise TimeoutError("Kie.ai task timed out")
        except Exception as exc:
            logger.warning("Kie.ai image generation failed: %s", exc)
            return _provider_error(
                f"Kie.ai image generation failed: {exc}",
                prompt=prompt,
                aspect_ratio=aspect,
                model=model,
            )


def register(ctx) -> None:
    ctx.register_image_gen_provider(KieImageGenProvider())
