# Deploying the backend: Cloud Run + Firestore + Cloud Storage

Cloud Run containers have no persistent disk and may run several instances, so
in production the backend must use `STORAGE_BACKEND=firestore`:

| What | Where |
|---|---|
| Session index (owner, access-token hash, status, timestamps) | Firestore `sessions` |
| Users, HealthKit records and sync anchors | Firestore `users`, `user_emails`, `health_records`, `sync_anchors` |
| Session payload (health data, questionnaire, report; gzip JSON) | Cloud Storage `sessions/{id}.json.gz` |
| Uploaded Apple Health export, until it has been extracted | Cloud Storage `uploads/{id}` |

Payloads live in Cloud Storage because they can include raw ECG waveforms,
which exceed Firestore's 1 MiB document limit. No composite indexes are needed.

Replace the placeholders below. The Firebase project in `.firebaserc` is
`pulse-ai-d54fb`; use whichever project runs your Cloud Run service.

```bash
PROJECT=pulse-ai-d54fb
REGION=asia-east1
SERVICE=pulsebridge-api
BUCKET=${PROJECT}-pulsebridge-data
```

## 1. Enable the APIs

```bash
gcloud services enable firestore.googleapis.com storage.googleapis.com run.googleapis.com --project "$PROJECT"
```

## 2. Create the Firestore database (Native mode)

Skip this if the project already has a `(default)` Firestore database.

```bash
gcloud firestore databases create --location="$REGION" --type=firestore-native --project "$PROJECT"
```

## 3. Create the bucket, private, with a cleanup rule for abandoned uploads

```bash
gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
  --uniform-bucket-level-access --public-access-prevention --project "$PROJECT"

cat > /tmp/lifecycle.json <<'JSON'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 2, "matchesPrefix": ["uploads/"]}}]}
JSON
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file=/tmp/lifecycle.json
```

Uploads are deleted by the API after a successful extract; the rule only
catches files from check-ins people abandoned halfway.

## 4. Grant the Cloud Run service account access

```bash
SA=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" \
  --format='value(spec.template.spec.serviceAccountName)')
SA=${SA:-$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com}

gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/datastore.user
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectUser
```

## 5. Configure and deploy

```bash
gcloud run deploy "$SERVICE" --source backend --region "$REGION" --project "$PROJECT" \
  --set-env-vars "STORAGE_BACKEND=firestore,GCP_PROJECT=$PROJECT,GCS_BUCKET=$BUCKET" \
  --set-env-vars "CORS_ORIGINS=https://$PROJECT.web.app,https://$PROJECT.firebaseapp.com"
```

Secrets (`GROQ_API_KEY`, `JWT_SECRET`) belong in Secret Manager, mounted with
`--set-secrets GROQ_API_KEY=groq-api-key:latest,JWT_SECRET=jwt-secret:latest`.
`JWT_SECRET` must not be the placeholder from `.env.example`; the server logs a
warning at startup if it is.

## Old reports

Reports created before access tokens existed cannot be opened through the API
any more. On Cloud Run they lived on the container's ephemeral disk and are
gone once the new revision replaces it. For any other database, list and then
delete them with:

```bash
cd backend
python scripts/purge_legacy_sessions.py          # dry run
python scripts/purge_legacy_sessions.py --apply  # delete
```

## Staging

Set `FIRESTORE_PREFIX=staging_` on a staging service to keep its collections
and objects separate from production's in the same project and bucket.
