"""Curated citation registry for analysis recommendations.

Short codes are used in LLM output; the full citation text is returned
to the frontend for rendering as a references panel.
"""
from __future__ import annotations

REFERENCES: dict[str, str] = {
    "Nunan2010":
        "Nunan D, Sandercock GRH, Brodie DA. A Quantitative Systematic "
        "Review of Normal Values for Short-Term HRV in Healthy Adults. "
        "Pacing Clin Electrophysiol. 2010;33(11):1407-1417.",
    "TaskForce1996":
        "Task Force of the European Society of Cardiology and the North "
        "American Society of Pacing and Electrophysiology. Heart Rate "
        "Variability — Standards of Measurement, Physiological "
        "Interpretation, and Clinical Use. Circulation. 1996;93:1043-1065.",
    "Umetani1998":
        "Umetani K, Singer DH, McCraty R, Atkinson M. Twenty-Four Hour "
        "Time Domain Heart Rate Variability and Heart Rate: Relations to "
        "Age and Gender Over Nine Decades. J Am Coll Cardiol. "
        "1998;31(3):593-601.",
    "AHA2019_AFib":
        "January CT, et al. 2019 AHA/ACC/HRS Focused Update on the "
        "Management of Patients With Atrial Fibrillation. Circulation. "
        "2019;140(2):e125-e151.",
    "ZYYXH/T157-2009":
        "中華中醫藥學會. 中醫體質分類與判定（ZYYXH/T157-2009）. 2009.",
    "AASM2017_Sleep":
        "Watson NF, et al. Recommended Amount of Sleep for a Healthy "
        "Adult: AASM and Sleep Research Society Consensus Statement. "
        "Sleep. 2017;38(6):843-844.",
    "ACSM2018_Exercise":
        "American College of Sports Medicine. ACSM's Guidelines for "
        "Exercise Testing and Prescription. 10th ed. 2018.",
    "Laborde2017_HRV_Stress":
        "Laborde S, Mosley E, Thayer JF. Heart Rate Variability and "
        "Cardiac Vagal Tone in Psychophysiological Research. Front "
        "Psychol. 2017;8:213.",
}

ALLOWED_CODES = sorted(REFERENCES.keys())


def filter_references(used_codes: list[str]) -> dict[str, str]:
    """Return only the references that were actually cited."""
    seen: set[str] = set()
    out: dict[str, str] = {}
    for code in used_codes:
        if code in REFERENCES and code not in seen:
            out[code] = REFERENCES[code]
            seen.add(code)
    return out
