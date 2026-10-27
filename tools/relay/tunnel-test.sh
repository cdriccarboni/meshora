#!/usr/bin/env bash
# MESHORA — relais de TEST exposé par un tunnel Cloudflare éphémère (« quick tunnel », sans compte).
# Usage (Mac) : bash tools/relay/tunnel-test.sh
# - le relais n'écoute que sur 127.0.0.1 ; seul le tunnel l'expose, en HTTPS/WSS ;
# - l'adresse *.trycloudflare.com change à chaque lancement et disparaît à l'arrêt (Ctrl+C) ;
# - aucune garantie de disponibilité : usage d'essai uniquement, jamais en production.
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT="${PORT:-8787}"
command -v cloudflared >/dev/null || { echo "cloudflared manquant : brew install cloudflared"; exit 1; }
PORT="$PORT" HOST=127.0.0.1 node tools/relay/server.js &
RELAY_PID=$!
trap 'kill $RELAY_PID 2>/dev/null || true' EXIT
sleep 1
curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null && echo "Relais local prêt sur 127.0.0.1:$PORT"
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" 2>&1 | while IFS= read -r line; do
  url=$(printf '%s' "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' || true)
  if [ -n "$url" ]; then
    echo "Relais de test : ${url/https:/wss:}"
    echo "Lien d'essai   : https://<prévisualisation>.meshora.pages.dev/app/?relay=${url/https:/wss:}/?room=essai1"
  fi
done
