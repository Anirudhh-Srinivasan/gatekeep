import os
import sys
from pathlib import Path

os.environ.setdefault("RESET_TOKEN", "test-token")
sys.path.insert(0, str(Path(__file__).parents[2] / "engine"))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_and_validation():
    assert client.get("/health").json() == {"status": "ok"}
    response = client.post("/check", json={"target": "x", "action": "bad"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_ACTION"

def test_real_graph_routes_and_reversal():
    reset = client.post("/reset", headers={"X-Reset-Token": "test-token"})
    assert reset.status_code == 200
    assert client.get("/targets").status_code == 200
    result = client.post("/check", headers={"X-Viewer": "alice"}, json={"target": "file:compat/win7_shim.js", "action": "delete", "depth": 4}).json()
    assert result["verdict"] == "ESCALATE"
    preview = client.post("/reverse", json={"old": "D1", "new_id": "D4", "new_title": "Drop Windows 7 support", "dry_run": True}).json()
    assert preview["committed"] is False

def test_ask_is_frontend_compatible():
    client.post("/reset", headers={"X-Reset-Token": "test-token"})
    response = client.post("/ask", json={"question": "Can I delete file:compat/win7_shim.js?"})
    assert response.status_code == 200
    assert {"question", "tool_calls", "result", "explanation", "names_verified"} <= response.json().keys()
