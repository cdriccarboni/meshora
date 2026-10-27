#!/usr/bin/env bash
# MESHORA — Essai d'interopérabilité Android (Kotlin, JVM) ↔ web (TypeScript) via le relais réel.
# Lance : relais local durci, robot d'écho web (vrai code), puis les tests unitaires Android dont LiveRelayInteropTest.
# Prérequis : node, JDK 17 (JAVA_HOME), Android SDK (android/local.properties), prototype/node_modules.
# Usage : bash tools/audit/interop-android.sh   (depuis la racine du dépôt)
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT="${PORT:-18787}"
ROOM="interop-$(date +%s)"
# Relais visé : MESHORA_RELAY_URL (ex. relais de référence wss://…) ou, par défaut, relais Node local.
if [ -n "${MESHORA_RELAY_URL:-}" ]; then
  RELAY_URL="$MESHORA_RELAY_URL"; HEALTH="$(echo "$RELAY_URL" | sed 's#^ws#http#')/health"; RELAY_PID=""
else
  PORT="$PORT" HOST=127.0.0.1 node tools/relay/server.js > /tmp/meshora-interop-relay.log 2>&1 &
  RELAY_PID=$!; RELAY_URL="ws://127.0.0.1:$PORT"; HEALTH="http://127.0.0.1:$PORT/health"
  sleep 1
fi
echo "Relais : $RELAY_URL (salon $ROOM)"
( cd prototype && RELAY="$RELAY_URL" ROOM="$ROOM" npx tsx ../tools/audit/echo-bot.ts > /tmp/meshora-interop-bot.log 2>&1 ) &
BOT_PID=$!
trap 'kill $RELAY_PID $BOT_PID 2>/dev/null || true; pkill -f "tools/audit/echo-bot.ts" 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -fsS "$HEALTH" >/dev/null 2>&1 && break; sleep 0.25; done
READY=0; for _ in $(seq 1 60); do grep -q '"ready":true' /tmp/meshora-interop-bot.log 2>/dev/null && READY=1 && break; sleep 0.5; done
[ "$READY" = 1 ] || { echo "ÉCHEC : robot web non prêt"; cat /tmp/meshora-interop-bot.log; exit 1; }
echo "Robot web : $(head -1 /tmp/meshora-interop-bot.log | cut -c1-80)…"
cd android
MESHORA_INTEROP_RELAY="$RELAY_URL" MESHORA_INTEROP_ROOM="$ROOM" ./gradlew --offline -q testDebugUnitTest --rerun-tasks
for f in app/build/test-results/testDebugUnitTest/*.xml; do grep -o '<testsuite name="[^"]*" tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' "$f"; done
grep -q 'skipped="0"' app/build/test-results/testDebugUnitTest/TEST-org.meshora.app.LiveRelayInteropTest.xml || { echo "ÉCHEC : essai d'interopérabilité ignoré"; exit 1; }
echo "INTEROPÉRABILITÉ : OK"
echo "--- journal du robot web ---"; cat /tmp/meshora-interop-bot.log
