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
PORT="$PORT" HOST=127.0.0.1 node tools/relay/server.js > /tmp/meshora-interop-relay.log 2>&1 &
RELAY_PID=$!
sleep 1
( cd prototype && RELAY="ws://127.0.0.1:$PORT" ROOM="$ROOM" npx tsx ../tools/audit/echo-bot.ts > /tmp/meshora-interop-bot.log 2>&1 ) &
BOT_PID=$!
trap 'kill $RELAY_PID $BOT_PID 2>/dev/null || true; pkill -f "tools/audit/echo-bot.ts" 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do grep -q '"ready":true' /tmp/meshora-interop-bot.log 2>/dev/null && break; sleep 0.5; done
echo "Robot web : $(head -1 /tmp/meshora-interop-bot.log | cut -c1-80)…"
cd android
MESHORA_INTEROP_RELAY="ws://127.0.0.1:$PORT" MESHORA_INTEROP_ROOM="$ROOM" ./gradlew --offline -q testDebugUnitTest --rerun-tasks
for f in app/build/test-results/testDebugUnitTest/*.xml; do grep -o '<testsuite name="[^"]*" tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' "$f"; done
echo "--- journal du robot web ---"; cat /tmp/meshora-interop-bot.log
