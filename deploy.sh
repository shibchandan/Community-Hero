#!/bin/bash
if [ -z "$1" ]; then
  echo "Error: Please provide your Gemini API key!"
  echo "Usage: bash deploy.sh YOUR_GEMINI_KEY"
  exit 1
fi

GEMINI_KEY=$1

echo "Deploying to Cloud Run..."
gcloud run deploy samadhan-setu \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_KEY},FIREBASE_SERVICE_ACCOUNT_KEY=./firebase-admin-key.json"
