"""ECG-CSV-only check-ins: native Apple exports in either UI language, trimming, response size."""
import math

import pytest
from fastapi.testclient import TestClient

import main
from core.csv_parser import detect_csv_type, parse_ecg_csv

H = "X-Session-Token"


def _waveform(seconds=30, rate=512, bpm=60):
    """Synthetic single-lead trace: a sharp R wave every beat on a gentle baseline."""
    period = int(rate * 60 / bpm)
    out = []
    for i in range(seconds * rate):
        phase = i % period
        r = 1200.0 * math.exp(-((phase - 40) ** 2) / 18.0)
        out.append(round(r + 30 * math.sin(i / 40), 1))
    return out


def native_en(day: int, cls="Sinus Rhythm") -> bytes:
    head = (f"Name,Test User\nDate of Birth,1990-01-01\nRecorded Date,2026-10-{day:02d} 08:00:00 +0800\n"
            f"Classification,{cls}\nSymptoms,\nSoftware Version,2.0\nDevice,Watch7,1\n"
            "Sample Rate,512 hertz\n\nLead,Lead I\nUnit,µV\n\n")
    return (head + "\n".join(str(v) for v in _waveform())).encode()


def native_zh(day: int) -> bytes:
    head = (f"姓名,測試\n出生日期,1990-01-01\n記錄日期,2026-10-{day:02d} 08:00:00 +0800\n"
            "分類,竇性心律\n症狀,\n軟體版本,2.0\n裝置,Watch7,1\n取樣頻率,512赫茲\n\n導程,導程I\n單位,µV\n\n")
    return (head + "\n".join(str(v) for v in _waveform())).encode()


@pytest.mark.parametrize("raw", [native_en(1), native_zh(1)], ids=["english", "chinese"])
def test_native_exports_are_detected_and_parsed(raw):
    assert detect_csv_type(raw) == "ecg"
    [r] = parse_ecg_csv(raw)
    assert r["classification"] == "sinusRhythm"
    assert r["timestamp"].startswith("2026-10-01")
    assert len(r["voltage_measurements"]) == 30 * 512


def test_columnar_csv_is_not_mistaken_for_native():
    raw = b"Date,Classification,Average Heart Rate\n2026-10-01 08:00:00,Sinus Rhythm,61\n\n"
    assert detect_csv_type(raw) == "ecg"
    rows = parse_ecg_csv(raw)
    assert len(rows) == 1 and rows[0]["average_heart_rate"] == 61.0   # blank line is not a reading


def test_ecg_only_upload_keeps_every_recording_but_few_waveforms():
    files = [("files", (f"ecg_2026-10-{d:02d}.csv", native_en(d), "text/csv")) for d in range(1, 32)]
    files += [("files", ("ecg_extra.csv", native_zh(1).replace(b"08:00:00", b"20:00:00"), "text/csv"))]
    with TestClient(main.app) as c:
        r = c.post("/api/health-data/upload-csv", files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        readings = body["parsed"]["ecg_readings"]
        assert len(readings) == 32
        assert all(not x["voltage_measurements"] for x in readings)          # response stays small
        assert body["parsed"]["hrv"] and body["parsed"]["hrv"]["sdnn"] >= 0  # HRV derived from waveforms

        sid, tok = body["session_id"], body["session_token"]
        stored = c.get(f"/api/health-data/{sid}", headers={H: tok}).json()["ecg_readings"]
        with_wave = [x for x in stored if x["voltage_measurements"]]
        assert len(with_wave) == 30                                          # only the newest keep raw data
        oldest = min(stored, key=lambda x: x["timestamp"])
        assert not oldest["voltage_measurements"] and 55 <= oldest["average_heart_rate"] <= 65
