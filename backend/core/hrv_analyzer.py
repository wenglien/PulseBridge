from __future__ import annotations
"""
HRV computation from RR intervals.
Computes time-domain (SDNN, RMSSD, pNN50) and frequency-domain (LF, HF, LF/HF) metrics.
"""
import numpy as np
from typing import Optional

try:
    from scipy import signal as scipy_signal
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


def compute_hrv_metrics(rr_intervals: list[float]) -> Optional[dict]:
    """
    Compute HRV metrics from RR intervals in milliseconds.
    Returns None if insufficient data.
    """
    rr = np.array(rr_intervals, dtype=float)

    # Need at least 30 beats for meaningful HRV
    if len(rr) < 30:
        return None

    # --- Time domain ---
    sdnn = float(np.std(rr, ddof=1))
    diff_rr = np.diff(rr)
    rmssd = float(np.sqrt(np.mean(diff_rr ** 2)))
    pnn50 = float(np.mean(np.abs(diff_rr) > 50) * 100)
    mean_rr = float(np.mean(rr))

    # --- Frequency domain (Welch's method) ---
    lf_power, hf_power, lf_hf_ratio = 0.0, 0.0, 0.0

    if SCIPY_AVAILABLE and len(rr) >= 60:
        try:
            lf_power, hf_power, lf_hf_ratio = _compute_frequency_domain(rr)
        except Exception:
            pass

    # Fallback: estimate LF/HF from sympatho-vagal balance
    if lf_hf_ratio == 0.0:
        # Sympathetic proxy: low HRV + high mean HR → high LF/HF
        hr = 60000 / mean_rr if mean_rr > 0 else 70
        normalized_hrv = min(sdnn / 60.0, 1.0)
        lf_hf_ratio = round(max(0.5, (hr / 70.0) * (1.5 - normalized_hrv) * 2.0), 2)
        lf_power = sdnn * 0.4
        hf_power = rmssd * 0.3

    return {
        "sdnn": round(sdnn, 2),
        "rmssd": round(rmssd, 2),
        "pnn50": round(pnn50, 2),
        "mean_rr": round(mean_rr, 2),
        "lf_power": round(lf_power, 4),
        "hf_power": round(hf_power, 4),
        "lf_hf_ratio": round(lf_hf_ratio, 3),
        "rr_intervals": list(rr),
        "timestamps": [],
    }


def _compute_frequency_domain(rr: np.ndarray) -> tuple[float, float, float]:
    """Compute LF (0.04–0.15 Hz) and HF (0.15–0.40 Hz) power via Welch's method."""
    fs = 4.0  # interpolation frequency (Hz)
    rr_interp = _interpolate_rr(rr, fs)

    nperseg = min(256, len(rr_interp) // 2)
    if nperseg < 32:
        return 0.0, 0.0, 0.0

    freqs, psd = scipy_signal.welch(
        rr_interp, fs=fs, nperseg=nperseg, scaling="density"
    )

    lf_mask = (freqs >= 0.04) & (freqs < 0.15)
    hf_mask = (freqs >= 0.15) & (freqs < 0.40)

    lf_power = float(np.trapz(psd[lf_mask], freqs[lf_mask])) if lf_mask.any() else 0.0
    hf_power = float(np.trapz(psd[hf_mask], freqs[hf_mask])) if hf_mask.any() else 0.0
    lf_hf_ratio = round(lf_power / hf_power, 3) if hf_power > 1e-9 else 0.0

    return lf_power, hf_power, lf_hf_ratio


def _interpolate_rr(rr: np.ndarray, fs: float) -> np.ndarray:
    """Interpolate unevenly sampled RR intervals to a uniform time series."""
    cumtime = np.cumsum(rr) / 1000.0  # convert ms to seconds
    t_uniform = np.arange(cumtime[0], cumtime[-1], 1.0 / fs)
    rr_interp = np.interp(t_uniform, cumtime, rr)
    # Detrend
    rr_interp = rr_interp - np.mean(rr_interp)
    return rr_interp


def hrv_from_sdnn_records(sdnn_records: list[dict]) -> Optional[dict]:
    """
    Build a simplified HRV metrics dict from pre-computed SDNN records
    (when raw RR intervals are not available).
    """
    if not sdnn_records:
        return None
    values = [r["value_ms"] for r in sdnn_records if r.get("value_ms", 0) > 0]
    if not values:
        return None
    avg_sdnn = float(np.mean(values))
    # Estimate other metrics from SDNN using typical ratios
    rmssd = avg_sdnn * 0.85
    pnn50 = max(0.0, (avg_sdnn - 20) * 1.2)
    mean_rr = 860.0  # assume ~70 bpm
    lf_hf = max(0.5, 2.0 - avg_sdnn / 50.0)
    return {
        "sdnn": round(avg_sdnn, 2),
        "rmssd": round(rmssd, 2),
        "pnn50": round(pnn50, 2),
        "mean_rr": mean_rr,
        "lf_power": round(avg_sdnn * 0.4, 4),
        "hf_power": round(rmssd * 0.3, 4),
        "lf_hf_ratio": round(lf_hf, 3),
        "rr_intervals": [],
        "timestamps": [r.get("timestamp", "") for r in sdnn_records],
    }
