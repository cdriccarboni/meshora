# Essai Mac ↔ téléphone — prototype V0.2 (prévisualisation uniquement)

Autorisation : directeur artistique, 25 octobre 2026 (« prévisualisation uniquement »). Aucune production, aucune fusion.

## Dispositif

| Élément | Valeur |
|---|---|
| Application | `https://validation-v0-2-contre-audit.meshora.pages.dev/app/` — déploiement de **prévisualisation** du projet Pages `meshora` (branche `validation-v0-2-contre-audit`, commit `fc73ee1`). Les prévisualisations existantes sont conservées. |
| CSP de `/app` | `connect-src 'self' wss://*.trycloudflare.com` — ajoutée par `MESHORA_TEST_RELAY_ORIGINS` dans `scripts/build_site.py`, **refusée à la construction si le canal est `production`** |
| Relais | `tools/relay/server.js` (version durcie), sur le Mac, écoute **127.0.0.1:8787** uniquement |
| Exposition | Tunnel Cloudflare éphémère (`cloudflared tunnel --url http://127.0.0.1:8787`, sans compte) → `wss://<aléatoire>.trycloudflare.com`. L'adresse change à chaque lancement. Script : `tools/relay/tunnel-test.sh` |
| Origines admises par le relais | `https://meshora.pages.dev`, `https://*.meshora.pages.dev`, `http://localhost:*`, `http://127.0.0.1:*` |
| Coût | 0 € |

Ce que voit le relais : adresses IP (celles de Cloudflare, côté Mac), horaires, tailles, clés publiques, salon. Il ne voit pas le texte (vérifié T1, T2). Le tunnel n'a aucune garantie de disponibilité : il s'arrête avec le Mac.

## Essais automatiques réalisés (25/10/2026, Mac M4, `tools/audit/browser-remote.mjs`)

Deux instances Chrome indépendantes **sur le Mac**, tout le trafic passant par Internet (Pages en HTTPS, relais via tunnel en WSS) :

| Id | Résultat |
|---|---|
| R0 | ✅ accord pour le relais demandé ; WebSocket `wss://` ouverte ; 0 erreur CSP ; `utm_source` retiré de l'adresse |
| R1 | ✅ A→B reçu, « Délivré » chez A ; B→A reçu, « Délivré » chez B |
| R2a | ✅ destinataire absent : le message n'est pas marqué « Délivré » |

**Ce n'est pas un essai entre appareils.** Le chemin réseau est réel (Internet, HTTPS/WSS), mais les deux navigateurs sont sur la même machine. Un essai depuis l'environnement cloud de Claude (autre réseau) a été tenté : bloqué par la liste d'accès réseau de cet environnement.

## Essai téléphone — à réaliser par le directeur artistique

Lien (salon `essai1`, valable tant que le tunnel tourne ; un QR code est fourni dans la conversation) :
`https://validation-v0-2-contre-audit.meshora.pages.dev/app/?relay=wss%3A%2F%2F<tunnel>.trycloudflare.com%2F%3Froom%3Dessai1&room=essai1`

1. Ouvrir le lien sur le Mac (Chrome ou Safari) et sur le téléphone ; accepter le relais ; aller dans **Messages**.
2. Envoyer depuis le Mac, puis depuis le téléphone. Attendu : réception des deux côtés, « Délivré (accusé reçu) » chez l'expéditeur.
3. Téléphone en **4G/5G** (Wi-Fi coupé) : recommencer.
4. Réception différée : fermer l'onglet du téléphone, envoyer depuis le Mac (reste « Envoyé » / « En attente »), rouvrir le lien sur le téléphone : le message arrive dans les ~15 s, puis « Délivré » chez le Mac.

| Essai | Téléphone (modèle, OS, navigateur) | Réseau | Résultat | Date |
|---|---|---|---|---|
| 2. Même Wi-Fi | | | à faire | |
| 3. 4G/5G | | | à faire | |
| 4. Différé | | | à faire | |

Tant que ce tableau n'est pas rempli, la messagerie entre appareils reste **non démontrée** dans `docs/STATUS.md`.

## Arrêt

Sur le Mac : `pkill -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8787"` puis `pkill -f "tools/relay/server.js"`. Journaux : `~/meshora-test-relay/`.
