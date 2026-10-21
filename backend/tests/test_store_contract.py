"""The same behaviour contract, run against both storage backends."""
from datetime import datetime

import pytest

from db.store.base import token_matches
from tests import fake_gcp


@pytest.fixture(params=["sql", "firestore"])
def store(request, monkeypatch):
    if request.param == "sql":
        from db.store.sql import SqlStore
        return SqlStore()
    fake_gcp.install(monkeypatch)
    from db.store.firestore import FirestoreStore
    return FirestoreStore()


def test_create_and_token(store):
    meta, token = store.create_session(source="manual")
    got = store.get_meta(meta.id)
    assert got.source == "manual" and got.status == "pending"
    assert token_matches(token, got.token_hash)
    assert not token_matches("nope", got.token_hash)
    assert store.load_payload(meta.id) == {}


def test_update_merges_payload_and_listing_fields(store):
    meta, _ = store.create_session()
    store.update_session(meta.id, {"health": {"a": 1}, "status": "health_uploaded"})
    store.update_session(meta.id, {"analysis": {"primary_constitution": "氣虛質"}, "status": "completed"})
    payload = store.load_payload(meta.id)
    assert payload["health"] == {"a": 1} and payload["analysis"]["primary_constitution"] == "氣虛質"
    got = store.get_meta(meta.id)
    assert got.status == "completed" and got.primary_constitution == "氣虛質"


def test_update_unknown_session_raises(store):
    with pytest.raises(KeyError):
        store.update_session("pb_missing", {"x": 1})


def test_progress_and_metas(store):
    a, _ = store.create_session()
    b, _ = store.create_session()
    store.set_progress(a.id, 0.4)
    assert store.get_meta(a.id).progress == pytest.approx(0.4)
    assert {m.id for m in store.get_metas([a.id, b.id, "pb_missing"])} == {a.id, b.id}


def test_uploads_roundtrip_and_delete(store, tmp_path):
    meta, _ = store.create_session()
    src = tmp_path / "in.xml.gz"
    src.write_bytes(b"\x1f\x8bdata")
    store.put_upload(meta.id, src)
    assert src.exists()                      # caller keeps its file
    dest = tmp_path / "out"
    assert store.fetch_upload(meta.id, dest) and dest.read_bytes() == b"\x1f\x8bdata"
    store.delete_upload(meta.id)
    assert store.fetch_upload(meta.id, tmp_path / "again") is False
    store.delete_upload(meta.id)             # idempotent


def test_delete_session_removes_everything(store, tmp_path):
    meta, _ = store.create_session(user_id="u1")
    store.update_session(meta.id, {"health": {}})
    f = tmp_path / "f"
    f.write_bytes(b"x")
    store.put_upload(meta.id, f)
    store.add_health_records(meta.id, "hrv", [(datetime(2026, 1, 1), {"sdnn_ms": 40})])
    assert store.delete_session(meta.id) is True
    assert store.get_meta(meta.id) is None
    assert store.load_payload(meta.id) == {}
    assert store.list_health_records(meta.id) == []
    assert store.delete_session(meta.id) is False


def test_users_unique_email(store):
    u = store.create_user("a@example.com", "hash")
    assert store.get_user(u.id).email == "a@example.com"
    assert store.get_user_by_email("a@example.com").id == u.id
    with pytest.raises(Exception):
        store.create_user("a@example.com", "hash2")


def test_list_for_user_newest_first(store):
    a, _ = store.create_session(user_id="u1")
    b, _ = store.create_session(user_id="u1")
    store.create_session(user_id="u2")
    ids = [m.id for m in store.list_for_user("u1")]
    assert set(ids) == {a.id, b.id}


def test_healthkit_records_and_anchors(store):
    meta, _ = store.create_session(user_id="u1", source="healthkit")
    store.add_health_records(meta.id, "hrv", [
        (datetime(2026, 1, 2), {"sdnn_ms": 41}), (datetime(2026, 1, 1), {"sdnn_ms": 40})])
    store.add_health_records(meta.id, "ecg", [(datetime(2026, 1, 3), {"classification": "sinusRhythm"})])
    recs = store.list_health_records(meta.id)
    assert [r.get("sdnn_ms") for r in recs[:2]] == [40, 41]        # ordered by recorded_at
    assert store.count_health_records("u1", "hrv") == 2
    assert store.count_health_records("u2", "hrv") == 0
    assert store.get_anchor("u1", "hrv") is None
    store.set_anchor("u1", "hrv", "anchor-1")
    store.set_anchor("u1", "hrv", "anchor-2")
    assert store.get_anchor("u1", "hrv")[0] == "anchor-2"


def test_firestore_payload_write_retries_on_concurrent_update(monkeypatch):
    bucket = fake_gcp.install(monkeypatch)
    from db.store.firestore import FirestoreStore
    store = FirestoreStore()
    meta, _ = store.create_session()
    store.update_session(meta.id, {"questionnaire": {"q": 1}})

    # Another instance writes between our read and our write, exactly once.
    raced = []
    def concurrent_writer(name):
        if not raced:
            raced.append(name)
            import gzip, json
            other = {"questionnaire": {"q": 1}, "health": {"from": "other instance"}}
            bucket.objects[name] = (gzip.compress(json.dumps(other).encode()), bucket.objects[name][1] + 1)
    bucket.before_write = concurrent_writer

    store.update_session(meta.id, {"analysis": {"ok": True}})
    payload = store.load_payload(meta.id)
    assert raced, "the race was not triggered"
    assert payload["health"] == {"from": "other instance"}   # not lost
    assert payload["analysis"] == {"ok": True}


def test_headline_metrics_follow_payload_updates(store):
    meta, _ = store.create_session()
    store.update_session(meta.id, {"health": {
        "hrv": {"sdnn": 31.44, "rmssd": 22.8}, "resting_heart_rate": 66,
        "sleep": [{"total_sleep_minutes": 360}, {"total_sleep_minutes": 400}], "ecg_readings": [{}, {}],
    }})
    store.update_session(meta.id, {"questionnaire": {"energy": {"fatigue": 2}, "sleep": {"frequent_waking": 3}}})
    store.update_session(meta.id, {"analysis": {"executive_summary": {"overall_risk_level": "medium"}}})
    m = store.get_meta(meta.id).metrics
    assert m == {"sdnn": 31.4, "rmssd": 22.8, "resting_hr": 66.0, "sleep_minutes": 380.0,
                 "ecg_count": 2, "symptom_load": 5, "risk": "medium"}
    assert store.get_meta(meta.id).summary()["metrics"] == m
