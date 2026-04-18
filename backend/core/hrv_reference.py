from __future__ import annotations
"""
HRV reference ranges by age.

Sources:
- Task Force of the European Society of Cardiology & North American Society of
  Pacing and Electrophysiology (1996). Heart rate variability: standards of
  measurement, physiological interpretation, and clinical use. Circulation 93.
- Nunan D, Sandercock GR, Brodie DA (2010). A quantitative systematic review of
  normal values for short-term heart rate variability in healthy adults.
  PACE 33(11):1407-1417. — meta-analysis of 44 studies, 5-min recordings.
- Umetani K et al. (1998). Twenty-four hour time domain heart rate variability
  and heart rate: relations to age and gender over nine decades. JACC 31(3).

Values below target short-term (1-5 min) supine measurements typical of
Apple Watch Breathe / mindfulness HRV readings.
"""
from typing import Optional


# Age bracket → (sdnn mean, sdnn sd, rmssd mean, rmssd sd)
# Derived from Nunan 2010 meta-analysis pooled estimates with
# Umetani age-decline slopes applied.
_RANGES: list[tuple[tuple[int, int], dict[str, float]]] = [
    ((0, 29),  {"sdnn_mean": 55.0, "sdnn_sd": 17.0, "rmssd_mean": 45.0, "rmssd_sd": 18.0}),
    ((30, 39), {"sdnn_mean": 48.0, "sdnn_sd": 15.0, "rmssd_mean": 38.0, "rmssd_sd": 15.0}),
    ((40, 49), {"sdnn_mean": 42.0, "sdnn_sd": 14.0, "rmssd_mean": 32.0, "rmssd_sd": 13.0}),
    ((50, 59), {"sdnn_mean": 37.0, "sdnn_sd": 13.0, "rmssd_mean": 27.0, "rmssd_sd": 11.0}),
    ((60, 69), {"sdnn_mean": 32.0, "sdnn_sd": 12.0, "rmssd_mean": 23.0, "rmssd_sd": 10.0}),
    ((70, 120), {"sdnn_mean": 28.0, "sdnn_sd": 11.0, "rmssd_mean": 20.0, "rmssd_sd": 9.0}),
]

# Fallback when age is unknown: general adult (Nunan 2010 pooled mean).
_GENERAL_ADULT = {
    "sdnn_mean": 50.0, "sdnn_sd": 16.0,
    "rmssd_mean": 42.0, "rmssd_sd": 15.0,
}

# LF/HF ratio reference (Task Force 1996): 1.5–2.0 typical supine;
# values above 4 suggest sympathetic dominance.
LF_HF_NORMAL_LOW = 1.0
LF_HF_NORMAL_HIGH = 2.5

# pNN50 (%) typical range 3–30 in healthy adults (Task Force 1996).
PNN50_NORMAL_LOW = 3.0
PNN50_NORMAL_HIGH = 30.0


def get_reference(age: Optional[int]) -> dict:
    """
    Return an HRV reference profile for the given age.

    Returns a dict with:
      age_bracket: "30-39" or "adult (age unknown)"
      sdnn_p25, sdnn_p50, sdnn_p75: 25/50/75 percentile approximations
      rmssd_p25, rmssd_p50, rmssd_p75: same for RMSSD
      sources: list of citation keys
      confidence: "high" if age known, "medium" otherwise
    """
    if age is None or age <= 0:
        ref = _GENERAL_ADULT
        bracket_label = "adult (age unknown)"
        confidence = "medium"
    else:
        ref = _GENERAL_ADULT
        bracket_label = f"{age}"
        for (lo, hi), values in _RANGES:
            if lo <= age <= hi:
                ref = values
                bracket_label = f"{lo}-{hi}"
                break
        confidence = "high"

    # Approximate percentiles assuming near-normal distribution.
    def pct(mean: float, sd: float, z: float) -> float:
        return round(max(0.0, mean + z * sd), 1)

    return {
        "age_bracket": bracket_label,
        "sdnn_p25": pct(ref["sdnn_mean"], ref["sdnn_sd"], -0.6745),
        "sdnn_p50": round(ref["sdnn_mean"], 1),
        "sdnn_p75": pct(ref["sdnn_mean"], ref["sdnn_sd"], 0.6745),
        "rmssd_p25": pct(ref["rmssd_mean"], ref["rmssd_sd"], -0.6745),
        "rmssd_p50": round(ref["rmssd_mean"], 1),
        "rmssd_p75": pct(ref["rmssd_mean"], ref["rmssd_sd"], 0.6745),
        "lf_hf_normal_low": LF_HF_NORMAL_LOW,
        "lf_hf_normal_high": LF_HF_NORMAL_HIGH,
        "pnn50_normal_low": PNN50_NORMAL_LOW,
        "pnn50_normal_high": PNN50_NORMAL_HIGH,
        "sources": ["Nunan 2010", "Task Force 1996", "Umetani 1998"],
        "confidence": confidence,
    }


def percentile_rank(value: float, mean: float, sd: float) -> int:
    """
    Rough percentile (0-100) of `value` under Normal(mean, sd).
    Used for user-facing "your SDNN is at the X percentile" messaging.
    """
    if sd <= 0:
        return 50
    from math import erf, sqrt
    z = (value - mean) / sd
    cdf = 0.5 * (1 + erf(z / sqrt(2)))
    return int(round(cdf * 100))
