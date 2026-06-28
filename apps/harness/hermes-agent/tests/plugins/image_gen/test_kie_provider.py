from unittest.mock import Mock, patch

from plugins.image_gen.kie import (
    EDIT_MODEL,
    TEXT_MODEL,
    KieImageGenProvider,
)


def response(payload):
    result = Mock()
    result.json.return_value = payload
    result.raise_for_status.return_value = None
    return result


def test_requires_api_key(monkeypatch):
    monkeypatch.delenv("KIE_API_KEY", raising=False)
    result = KieImageGenProvider().generate("A quiet reading room")
    assert result["success"] is False
    assert result["error_type"] == "auth_required"


def test_text_to_image_success(monkeypatch):
    monkeypatch.setenv("KIE_API_KEY", "test-key")
    submitted = response({"code": 200, "data": {"taskId": "task-1"}})
    completed = response(
        {
            "code": 200,
            "data": {
                "state": "success",
                "resultJson": '{"resultUrls":["https://cdn.example/image.png"]}',
            },
        }
    )

    with (
        patch("plugins.image_gen.kie.requests.post", return_value=submitted) as post,
        patch("plugins.image_gen.kie.requests.get", return_value=completed),
        patch("plugins.image_gen.kie.time.sleep"),
        patch("plugins.image_gen.kie.save_url_image", return_value="/tmp/image.png"),
    ):
        result = KieImageGenProvider().generate("A quiet reading room", "landscape")

    assert result["success"] is True
    assert result["model"] == TEXT_MODEL
    assert result["image"] == "/tmp/image.png"
    payload = post.call_args.kwargs["json"]
    assert payload["input"]["aspect_ratio"] == "16:9"
    assert "input_urls" not in payload["input"]


def test_image_edit_uses_reference_urls(monkeypatch):
    monkeypatch.setenv("KIE_API_KEY", "test-key")
    submitted = response({"code": 200, "data": {"taskId": "task-2"}})
    completed = response(
        {
            "code": 200,
            "data": {
                "state": "success",
                "resultJson": {"resultUrls": ["https://cdn.example/edit.png"]},
            },
        }
    )

    with (
        patch("plugins.image_gen.kie.requests.post", return_value=submitted) as post,
        patch("plugins.image_gen.kie.requests.get", return_value=completed),
        patch("plugins.image_gen.kie.time.sleep"),
        patch("plugins.image_gen.kie.save_url_image", return_value="/tmp/edit.png"),
    ):
        result = KieImageGenProvider().generate(
            "Make the sky warmer",
            image_url="https://cdn.example/source.png",
        )

    assert result["success"] is True
    assert result["model"] == EDIT_MODEL
    assert post.call_args.kwargs["json"]["input"]["input_urls"] == [
        "https://cdn.example/source.png"
    ]


def test_rejects_local_reference(monkeypatch):
    monkeypatch.setenv("KIE_API_KEY", "test-key")
    result = KieImageGenProvider().generate(
        "Edit this",
        image_url="/tmp/source.png",
    )
    assert result["success"] is False
    assert result["error_type"] == "invalid_argument"
