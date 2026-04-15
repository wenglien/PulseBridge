# PulseBridge

上傳 Apple Watch 的 ECG、HRV 與睡眠數據，結合五步症狀問卷，由 AI 生成融合中西醫觀點的個人化健康分析報告，並支援即時追問與一鍵匯出就醫 PDF。
網頁版專案已上線：https://pulse-ai-d54fb.web.app/
> Upload your Apple Watch ECG, HRV, and sleep data. Complete a five-step symptom questionnaire. Get a bilingual AI-generated health report that bridges Western biomarkers with Traditional Chinese Medicine — then ask follow-up questions or export a doctor-ready PDF in one click.

---

## Features

| Feature | Description |
|---|---|
| Apple Health XML upload | Memory-safe streaming parser handles exports up to several GB |
| HRV & ECG analysis | SDNN, RMSSD, LF/HF ratio, AFib detection, ST-deviation flagging |
| Sleep analysis | Deep / REM / core sleep breakdown from HealthKit data |
| TCM constitution scoring | Rule-based scoring across 9 constitution types |
| AI analysis (streaming) | LLM-generated report streamed in real time via SSE |
| AI follow-up chat | Ask questions about your report; AI answers with full context |
| PDF report export | One-click bilingual report for sharing with your doctor |
| Session history | All analyses saved and accessible for review |

---

## Architecture

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│  Next.js 16 (App Router)    │      │  FastAPI (Python)            │
│  TypeScript · Tailwind CSS  │ HTTP │  Pydantic v2 · SQLAlchemy    │
│  Recharts · Framer Motion   │◄────►│  NumPy · SciPy               │
│  Firebase Hosting (static)  │      │  Google Cloud Run            │
└─────────────────────────────┘      └──────────────┬───────────────┘
                                                     │ HTTPS
                                              ┌──────▼───────┐
                                              │   Groq API   │
                                              │ (LLaMA 3.3)  │
                                              └──────────────┘
```

**Data flow:**
1. User uploads `export.xml` → browser gzips it → backend streams-parses only the requested date range
2. HRV metrics computed from RR intervals (Welch's method)
3. ECG classifications aggregated; AFib burden, ST-deviation flagged
4. Symptom questionnaire scored against 9 TCM constitution types
5. All signals fed to LLM prompt → streaming JSON response → structured report UI
6. User can ask follow-up questions; LLM answers with full report context

---

## Tech Stack

**Frontend**
- Next.js 16 · React 19 · TypeScript 5
- Tailwind CSS v4 · Framer Motion
- Recharts · Radix UI
- Firebase Hosting (static export via `output: "export"`)

**Backend**
- FastAPI · Uvicorn · Pydantic v2
- SQLAlchemy (SQLite by default, PostgreSQL-ready)
- NumPy / SciPy (HRV frequency-domain analysis)
- httpx (async Groq API calls)
- Google Cloud Run

**AI**
- Groq API (`llama-3.3-70b-versatile` by default)
- Drop-in compatible with any OpenAI-compatible endpoint

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- A [Groq API key](https://console.groq.com) (free tier available)

### 1 — Clone

```bash
git clone https://github.com/your-org/pulsebridge.git
cd pulsebridge
```

### 2 — Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — at minimum set GROQ_API_KEY and a strong JWT_SECRET

uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### 3 — Frontend

```bash
cd frontend
npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000   (already the default)

npm run dev
```

Open `http://localhost:3000`.

---

## Project Structure

```
pulsebridge/
├── backend/
│   ├── api/
│   │   ├── routes/          # FastAPI route handlers
│   │   │   ├── analysis.py  # AI analysis + SSE streaming + chat
│   │   │   ├── health_data.py
│   │   │   ├── questionnaire.py
│   │   │   └── sessions.py
│   │   └── dependencies.py
│   ├── core/
│   │   ├── claude_engine.py # LLM prompt builder + Groq streaming
│   │   ├── ecg_analyzer.py  # AFib, ST-deviation, risk flagging
│   │   ├── hrv_analyzer.py  # SDNN, RMSSD, LF/HF (Welch's)
│   │   ├── tcm_scorer.py    # 9 TCM constitution rule-based scoring
│   │   ├── xml_stream_parser.py  # Memory-safe Apple Health XML parser
│   │   └── config.py
│   ├── models/              # Pydantic v2 schemas
│   ├── db/                  # SQLAlchemy models & session store
│   ├── main.py
│   └── requirements.txt
│
└── frontend/
    ├── app/                 # Next.js App Router pages
    │   ├── page.tsx         # Home / dashboard
    │   ├── upload/          # XML / CSV upload flow
    │   ├── questionnaire/   # 5-step symptom form
    │   ├── analysis/        # Report + chat + PDF export
    │   └── history/
    ├── components/
    │   ├── analysis/        # Report UI components
    │   ├── charts/          # Recharts-based visualisations
    │   ├── ui/              # Design system (Button, Card, FadeIn…)
    │   └── upload/
    ├── hooks/               # useHealthData, useAnalysis, useQuestionnaire
    ├── lib/                 # api.ts, reportPrint.ts, utils.ts
    └── types/               # TypeScript type definitions
```

---

## Supported Apple Health Data Types

| Data type | HealthKit identifier |
|---|---|
| Heart Rate | `HKQuantityTypeIdentifierHeartRate` |
| HRV (SDNN) | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` |
| Resting Heart Rate | `HKQuantityTypeIdentifierRestingHeartRate` |
| Sleep | `HKCategoryTypeIdentifierSleepAnalysis` |
| ECG | `ECGSample` + `InstantaneousBeatsPerMinute` |

---

## Limitations & Disclaimers

- **Not a medical device.** All output is for informational purposes only. Always consult a licensed healthcare provider.
- ECG analysis is limited to Apple Watch single-lead readings and cannot detect all cardiac conditions.
- TCM constitution scoring is rule-based and not a substitute for diagnosis by a qualified TCM practitioner.
- Analysis quality depends on the quantity and quality of uploaded data; sparse data yields lower-confidence results.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[MIT](LICENSE)
