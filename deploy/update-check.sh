#!/usr/bin/env bash
exec "$HOME/deploy/auto-deploy.sh" \
  "marumie-jp" \
  "$HOME/marumie-jp" \
  "marumie-jp" \
  "npm ci && npm run build:flows && NEXT_BASE_PATH=/marumie npm run build" \
  "http://210.131.212.62/marumie"
