#!/usr/bin/env bash
# MESHORA — Construction Android signée avec la clé d'importation HORS DÉPÔT (macOS).
# - Clé : ~/.meshora/meshora-upload-*.jks (droits 600), référencée par ~/.meshora/signing.properties
# - Mot de passe : trousseau macOS, service « org.meshora.android.upload », compte « meshora-upload »
#   (jamais écrit sur disque ni affiché).
# - Produit : APK et AAB de publication signés + vérification apksigner / jarsigner.
# Ne publie RIEN sur Google Play.
# Usage : bash tools/android/build-signed.sh   (depuis la racine du dépôt)
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")/../../android"
REPO=$(cd .. && pwd -P)

PROPS="${MESHORA_SIGNING_PROPERTIES:-$HOME/.meshora/signing.properties}"
[ -f "$PROPS" ] || { echo "Configuration de signature absente : $PROPS"; exit 1; }
STORE=$(grep '^storeFile=' "$PROPS" | cut -d= -f2-)
ALIAS=$(grep '^keyAlias=' "$PROPS" | cut -d= -f2-)
STORE_REAL=$(cd "$(dirname "$STORE")" && pwd -P)/$(basename "$STORE")
case "$STORE_REAL" in "$REPO"/*) echo "REFUS : la clé ne doit pas être dans le dépôt ($STORE_REAL)"; exit 1;; esac

MESHORA_KEYSTORE_PASSWORD=$(security find-generic-password -s org.meshora.android.upload -a meshora-upload -w)
export MESHORA_KEYSTORE_PASSWORD
export MESHORA_KEY_PASSWORD="$MESHORA_KEYSTORE_PASSWORD"
: "${JAVA_HOME:=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export JAVA_HOME

./gradlew -q clean assembleRelease bundleRelease

BT=$(ls -d "${ANDROID_HOME:-$HOME/Library/Android/sdk}"/build-tools/* | sort -V | tail -1)
APK=app/build/outputs/apk/release/app-release.apk
AAB=app/build/outputs/bundle/release/app-release.aab
echo "== APK"; "$BT/apksigner" verify --verbose --print-certs "$APK" | grep -E "Verified using|Signer #1 certificate (DN|SHA-256)"
echo "== AAB"; LC_ALL=C "$JAVA_HOME/bin/jarsigner" -J-Duser.language=en -verify "$AAB" | grep -E "jar verified|unsigned|not signed" || true
echo "== Empreinte de la clé d'importation"
"$JAVA_HOME/bin/keytool" -J-Duser.language=en -list -v -keystore "$STORE" -alias "$ALIAS" -storepass:env MESHORA_KEYSTORE_PASSWORD | grep -E "SHA256:" | head -1 || true
shasum -a 256 "$APK" "$AAB"
