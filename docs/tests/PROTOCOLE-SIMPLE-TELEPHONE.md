# Essai Mac ↔ téléphone — protocole simple (5 minutes)

**Prérequis** : le Mac reste allumé (le relais et le tunnel tournent dessus). Rien n'est publié : prévisualisation et application de test uniquement.

## A. Navigateur du téléphone (Android ou iPhone)

1. Sur le Mac **et** sur le téléphone, ouvrir le lien du QR code `meshora-essai-integration.png` :
   `https://integration-v0-2.meshora.pages.dev/app/?relay=wss%3A%2F%2F<tunnel>.trycloudflare.com%2F%3Froom%3Dessai1&room=essai1`
2. Accepter le relais proposé, puis ouvrir **Messages**.
3. Écrire « test 1 » sur le Mac → doit apparaître sur le téléphone ; sur le Mac : « Délivré (accusé reçu) ».
4. Répondre « test 2 » depuis le téléphone → doit apparaître sur le Mac ; « Délivré » sur le téléphone.

## B. Application Android native

1. Installer `~/meshora-test-relay/MESHORA-0.2.1-beta-release-signee.apk` (câble USB : `adb install -r …` ; ou copie du fichier sur le téléphone puis ouverture, en autorisant l'installation depuis cette source).
2. Onglet **Réseau** : relais `wss://<tunnel>.trycloudflare.com`, salon `essai1`, « Connecter au relais » → « CONNECTÉ (identité prouvée) ».
3. Sur le Mac, ouvrir le lien du A.1. Dans **Messages** sur Android, le pair web apparaît et est choisi automatiquement.
4. Envoyer « test 3 » depuis Android → reçu sur le Mac, « Délivré » sur Android. Envoyer « test 4 » depuis le Mac → reçu sur Android.

## C. Variantes (si A ou B fonctionne)

| Essai | Comment | Attendu |
|---|---|---|
| Réseau mobile | Couper le Wi-Fi du téléphone (4G/5G) et recommencer | Identique |
| Réception différée | Fermer l'application ou l'onglet du téléphone, envoyer depuis le Mac, rouvrir | Message reçu après réouverture ; « Délivré » ensuite sur le Mac |

## À noter (une ligne par essai)

| Essai | Téléphone (modèle, Android/iOS, navigateur) | Wi-Fi ou 4G/5G | Reçu ? | « Délivré » ? | Remarque |
|---|---|---|---|---|---|
| B — Android ↔ Web | Google Pixel (modèle et version d'Android à préciser), APK 0.2.1-beta (`android-v0.2.1-beta-test1`) ; Mac M4, navigateur | Wi-Fi | Oui, dans les deux sens | Oui | Rapporté par le directeur artistique le 26/10/2026, 19 h 05 |
| B — Android ↔ Web | idem | 5G (Wi-Fi coupé) | Oui, dans les deux sens | Oui | idem |
| B — Pixel sans aucun réseau | idem | Aucun (Wi-Fi et données coupés) | Non | Non | **Attendu** : sans réseau, seul un transport radio direct (Bluetooth, Wi-Fi Direct) pourrait passer, et il n'est pas encore implémenté |
| C — Réception différée | — | — | à faire | à faire | Écrire hors réseau, puis rétablir le réseau : le message doit partir seul |

Tant que ce tableau n'est pas rempli à partir d'essais réels, l'échange entre appareils reste **non démontré**.
