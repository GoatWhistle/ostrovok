import os
from pathlib import Path

from fastapi.testclient import TestClient

from hotel_agent.main import create_app
from hotel_agent.settings import load_settings


def test_reviewed_chat_answer_and_search_snapshot_survive_reload() -> None:
    root = Path(__file__).resolve().parents[4]
    settings = load_settings(
        {
            **os.environ,
            "CHARACTERISTICS_DIR": str(root / "characteristics"),
            "LLM_PROVIDER": "fake",
            "EMBEDDING_API_KEY": "",
            "NUITEE_API_KEY": "",
            "ETG_KEY_ID": "",
            "ETG_API_KEY": "",
        }
    )
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/api/v1/chat/messages",
            json={
                "message": "тихий отель в Сочи",
                "region_id": "sochi",
                "locale": "ru",
            },
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        identifier = payload["id"]
        try:
            assert payload["search"]["results"]
            answer = payload["messages"][-1]["content"]
            assert answer.startswith("В подборке ")
            assert "Подтверждённые и неизвестные условия" in answer
            restored = client.get(f"/api/v1/chat/conversations/{identifier}")
            assert restored.status_code == 200, restored.text
            assert restored.json()["messages"][-1]["content"] == answer
            assert restored.json()["search"] == payload["search"]
        finally:
            removed = client.delete(f"/api/v1/chat/conversations/{identifier}")
            assert removed.status_code == 204, removed.text
