"""Access control: a session is readable/changeable only with its own token (or by its owner)."""
import gzip
import json

import pytest
from fastapi.testclient import TestClient

import core.pipeline as pipeline
import main
from core.config import settings
from db.store import get_store
from tests import fake_gcp

H = "X-Session-Token"
LLM_JSON = json.dumps({
    "executive_summary": {"headline_zh": "測試", "overall_risk_level": "low", "key_findings": []},
    "summary_zh": "ok",
}, ensure_ascii=False)


@pytest.fixture(autouse=True)
def fake_llm(monkeypatch):
    async def fake(*_a, **_k):
        yield LLM_JSON
    monkeypatch.setattr(pipeline, "stream_analysis", fake)


@pytest.fixture(params=["sql", "firestore"])
def backend(request, monkeypatch):
    if request.param == "firestore":
        fake_gcp.install(monkeypatch)
        monkeypatch.setattr(settings, "gcs_bucket", "test-bucket")
    monkeypatch.setattr(settings, "storage_backend", request.param)
    get_store.cache_clear()
    yield request.param
    get_store.cache_clear()


@pytest.fixture
def client(backend):
    with TestClient(main.app) as c:
        yield c


def new_questionnaire_session(client):
    r = client.post("/api/questionnaire/submit", json={"fatigue": 1})
    assert r.status_code == 200, r.text
    body = r.json()
    return body["session_id"], body["session_token"]


def test_new_session_has_unguessable_id_and_token(client):
    sid, token = new_questionnaire_session(client)
    assert sid.startswith("pb_") and len(sid.split("_")[-1]) == 16
    assert len(token) >= 40


SESSION_GETS = [
    "/api/sessions/{sid}",
    "/api/questionnaire/{sid}",
    "/api/analysis/{sid}",
    "/api/health-data/{sid}",
    "/api/health-data/extract-progress/{sid}",
]


@pytest.mark.parametrize("path", SESSION_GETS)
def test_reads_require_the_sessions_own_token(client, path):
    sid, token = new_questionnaire_session(client)
    _other_sid, other_token = new_questionnaire_session(client)
    url = path.format(sid=sid)

    assert client.get(url).status_code == 404
    assert client.get(url, headers={H: "wrong"}).status_code == 404
    assert client.get(url, headers={H: other_token}).status_code == 404


def test_missing_and_forbidden_look_identical(client):
    sid, _ = new_questionnaire_session(client)
    missing = client.get("/api/sessions/pb_20260101_0000000000000000", headers={H: "x"})
    forbidden = client.get(f"/api/sessions/{sid}", headers={H: "x"})
    assert missing.status_code == forbidden.status_code == 404
    assert missing.json() == forbidden.json()


def test_owner_flow_end_to_end(client):
    sid, token = new_questionnaire_session(client)
    auth = {H: token}

    assert client.get(f"/api/questionnaire/{sid}", headers=auth).json()["session_id"] == sid

    stream = client.get(f"/api/analysis/stream/{sid}", headers=auth)
    assert stream.status_code == 200
    events = [json.loads(l[6:]) for l in stream.text.splitlines() if l.startswith("data: ")]
    assert events[-1].get("done") is True

    assert client.get(f"/api/analysis/{sid}", headers=auth).json()["executive_summary"]["headline_zh"] == "測試"
    assert client.get(f"/api/sessions/{sid}", headers=auth).json()["status"] == "completed"


def test_writes_require_token(client):
    sid, token = new_questionnaire_session(client)
    # Questionnaire update / manual metrics / analysis on someone else's session
    assert client.post("/api/questionnaire/submit", json={"session_id": sid}).status_code == 404
    assert client.post("/api/health-data/manual", json={"session_id": sid, "sdnn": 40}).status_code == 404
    assert client.post("/api/analysis/run", json={"session_id": sid}).status_code == 404
    assert client.get(f"/api/analysis/stream/{sid}").status_code == 404
    assert client.post(f"/api/analysis/chat/{sid}", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 404
    assert client.delete(f"/api/sessions/{sid}").status_code == 404
    # ...and the owner can
    assert client.post("/api/questionnaire/submit", json={"session_id": sid}, headers={H: token}).status_code == 200


def test_client_cannot_pick_its_own_session_id(client):
    r = client.post("/api/questionnaire/submit", json={"session_id": "pb_mine_123"})
    assert r.status_code == 404
    assert get_store().get_meta("pb_mine_123") is None


def test_delete_requires_token_and_removes_data(client):
    sid, token = new_questionnaire_session(client)
    assert client.delete(f"/api/sessions/{sid}", headers={H: token}).json()["deleted"] is True
    assert get_store().get_meta(sid) is None
    assert client.get(f"/api/sessions/{sid}", headers={H: token}).status_code == 404


def test_listing_is_never_global(client):
    new_questionnaire_session(client)
    assert client.get("/api/sessions").status_code == 401   # anonymous: no global list

    mine, token = new_questionnaire_session(client)
    other, _ = new_questionnaire_session(client)
    r = client.post("/api/sessions/lookup", json={"sessions": [
        {"session_id": mine, "token": token},
        {"session_id": other, "token": "guess"},
        {"session_id": "pb_gone", "token": "x"},
    ]})
    body = r.json()
    assert [s["session_id"] for s in body["sessions"]] == [mine]
    assert set(body["forget"]) == {other, "pb_gone"}


def test_logged_in_owner_can_read_without_token(client):
    jwt = client.post("/api/auth/register", json={"email": "owner@example.com", "password": "longenough"}).json()["access_token"]
    bearer = {"Authorization": f"Bearer {jwt}"}
    r = client.post("/api/questionnaire/submit", json={}, headers=bearer)
    sid = r.json()["session_id"]

    assert client.get(f"/api/sessions/{sid}", headers=bearer).status_code == 200
    assert [s["session_id"] for s in client.get("/api/sessions", headers=bearer).json()] == [sid]

    other_jwt = client.post("/api/auth/register", json={"email": "other@example.com", "password": "longenough"}).json()["access_token"]
    assert client.get(f"/api/sessions/{sid}", headers={"Authorization": f"Bearer {other_jwt}"}).status_code == 404


def test_xml_upload_extract_survives_lost_local_cache(client, tmp_path):
    """Simulates Cloud Run: extract lands on an instance without the uploaded file on disk."""
    xml = (b'<?xml version="1.0"?><HealthData>'
           b'<Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" '
           b'startDate="2026-10-01 07:00:00 +0800" endDate="2026-10-01 07:00:00 +0800" value="61"/>'
           b'</HealthData>')
    r = client.post("/api/health-data/upload-xml",
                    files={"file": ("export.xml.gz", gzip.compress(xml), "application/gzip")})
    assert r.status_code == 200, r.text
    sid, token = r.json()["session_id"], r.json()["session_token"]

    from api.routes.health_data import _cache_path
    _cache_path(sid).unlink()  # "different instance": no local copy

    r = client.post("/api/health-data/extract", headers={H: token}, json={
        "session_id": sid, "start_date": "2026-09-01", "end_date": "2026-10-31", "data_types": ["resting_hr"]})
    assert r.status_code == 200, r.text
    assert r.json()["parsed"]["resting_heart_rate"] == 61.0
    assert client.get(f"/api/health-data/extract-progress/{sid}", headers={H: token}).json()["pct"] == 1.0
    # export is discarded once its data is in the session
    assert get_store().fetch_upload(sid, tmp_path / "x") is False


def _insert_legacy_session(backend, sid):
    """A session as stored before access tokens existed."""
    store = get_store()
    if backend == "sql":
        from db.base import SessionLocal
        from db.models import Session as Row
        with SessionLocal() as db:
            db.add(Row(id=sid, payload_json="{}"))
            db.commit()
    else:
        store.sessions.document(sid).set({"status": "completed"})


def test_purge_removes_only_legacy_sessions(client, backend):
    sid, _ = new_questionnaire_session(client)
    _insert_legacy_session(backend, "pb_20250101_legacy")

    store = get_store()
    assert "pb_20250101_legacy" in store.purge_legacy_sessions(dry_run=True)
    assert store.get_meta("pb_20250101_legacy") is not None          # dry run kept it
    store.purge_legacy_sessions(dry_run=False)
    assert store.get_meta("pb_20250101_legacy") is None
    assert store.get_meta(sid) is not None


def test_legacy_sessions_are_unreachable(client, backend):
    _insert_legacy_session(backend, "pb_20250102_legacy")
    assert client.get("/api/sessions/pb_20250102_legacy").status_code == 404
    assert client.get("/api/sessions/pb_20250102_legacy", headers={H: ""}).status_code == 404


def test_signing_in_claims_this_browsers_sessions(client):
    sid, token = new_questionnaire_session(client)
    other_sid, _ = new_questionnaire_session(client)
    jwt = client.post("/api/auth/register", json={"email": "claim@example.com", "password": "longenough"}).json()["access_token"]
    bearer = {"Authorization": f"Bearer {jwt}"}

    assert client.post("/api/sessions/claim", json={"sessions": [{"session_id": sid, "token": token}]}).status_code == 401
    r = client.post("/api/sessions/claim", headers=bearer, json={"sessions": [
        {"session_id": sid, "token": token}, {"session_id": other_sid, "token": "guess"}]})
    assert r.json()["claimed"] == [sid]

    # Another device: only the account, no token.
    assert [s["session_id"] for s in client.get("/api/sessions", headers=bearer).json()] == [sid]
    assert client.get(f"/api/sessions/{sid}", headers=bearer).status_code == 200

    # A second account cannot take it over, even with the token.
    jwt2 = client.post("/api/auth/register", json={"email": "thief@example.com", "password": "longenough"}).json()["access_token"]
    r = client.post("/api/sessions/claim", headers={"Authorization": f"Bearer {jwt2}"},
                    json={"sessions": [{"session_id": sid, "token": token}]})
    assert r.json()["claimed"] == []
