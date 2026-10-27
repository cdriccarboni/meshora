# MESHORA — Coordination des agents

> Version 0.1 — 25 octobre 2026. GitHub (`cdriccarboni/meshora`) est la **source de vérité unique**.

## 1. Rôles

| Agent | Responsabilité | Branches | Ne fait pas |
|---|---|---|---|
| **Porteur du projet** | Décisions, validation, fusion vers `main` | — | — |
| **Claude** | Audit, architecture, sécurité, documentation, contrats d'interface (`contracts/`), structure du site (`site/`) | `docs/*`, `contracts/*` | Construire l'interface du prototype |
| **Google AI Studio** | Interface et prototype (adaptateurs simulés `Sim*`) | `ai-studio/*` | Modifier `docs/` ou `contracts/` directement (propose une PR) |
| **Pi Desktop / agents locaux** | Intégration, builds natifs, tests sur appareils physiques, rapports dans `docs/tests/` | `integration/*`, `tests/*` | Déclarer une fonction opérationnelle sans rapport archivé |

## 2. Règles de collaboration

1. Toute modification passe par une pull request vers `main`. **Aucune fusion sans accord explicite du porteur du projet.**
2. Aucun agent ne supprime, ne renomme ni ne réécrit les fichiers d'un autre agent. Un désaccord se traite par commentaire de PR.
3. Dossiers réservés :
   - `docs/`, `contracts/`, `site/` → Claude
   - `prototype/` → Google AI Studio (à créer par lui)
   - `native/`, `gateway/`, `docs/tests/` → agents d'intégration
4. Les contrats (`contracts/typescript/meshora-contracts.ts`) sont le point de jonction : le prototype les importe, le cœur natif les respecte. Changement = PR `contracts/*` + incrément de version.
5. `docs/STATUS.md` est mis à jour par la PR qui change l'état réel d'une fonction : 🎭 par AI Studio pour ce qu'il simule, ✅ uniquement par un agent de test avec rapport.
6. Aucun déploiement public, aucune publication sur un store, aucune suppression sans validation explicite.

## 3. Ce qui ne peut pas être fait dans une PWA

Les fonctions suivantes exigent des applications **natives** ; le prototype web les simule seulement :
- Bluetooth LE (central et périphérique), relais BLE en arrière-plan — impossible sur iPhone en web, et l'émission d'annonces BLE est impossible en web sur toutes les plateformes.
- VPN WireGuard (extension réseau iOS/macOS, `VpnService` Android).
- Wi-Fi Aware, Multipeer Connectivity.
- Accès aux radios LoRa compagnon en Bluetooth sur iPhone.

Ce qu'une PWA peut faire réellement : interface, stockage local, synchronisation Nostr via WebSocket quand Internet est disponible, LAN via un serveur local de passerelle, Web Serial / Web Bluetooth central sur Chrome desktop et Android uniquement [C].

## 4. Prochaines étapes pour Google AI Studio

1. Créer `prototype/` sur une branche `ai-studio/prototype-v0` ; ne rien modifier hors de ce dossier.
2. Importer `contracts/typescript/meshora-contracts.ts` et implémenter `SimMeshoraAdapter` (pannes, latences, partitions réglables ; tous les `MessageState`, dont `expired` et `storage_full`).
3. Appliquer `docs/DESIGN.md` : jetons de couleur, Inter, clair/sombre, trois onglets **Se connecter / Communiquer / Découvrir**, libellés FR/EN du §8, nom « Continuité ».
4. Afficher la bannière discrète « Prototype — réseau simulé » tant que `adapter.simulated === true`.
5. Écran de consentement « passerelle inconnue » (sans option « toujours » cochée) et écran « Diagnostic » listant transports, preuves et limites de plateforme.
6. Prévoir dans l'onglet **Se connecter** la section « Autour de moi » (contacts proches, relais, passerelle) et les trois modes de visibilité de `NEARBY.md` §3.5 (Invisible / Mes contacts / Tout le monde 10 min), en simulation.
7. Le logo officiel est celui du prototype (`OrbitalLogo.tsx`, `public/icon.svg`) ; le site en dérive ses fichiers (`DESIGN.md` §2). Garder ces deux sources synchronisées : toute évolution du logo passe par une PR qui met à jour les deux.
8. Ouvrir une PR vers `main` avec captures clair/sombre et FR/EN ; mettre à jour `docs/STATUS.md` en 🎭 pour les fonctions simulées.

## 5. Passation V0.2 (25 octobre 2026) — revue de cohérence par Claude

Source : `MESHORA-CLAUDE-V0.2.zip` (extrait partiel du prototype : 17 fichiers, dont `PASSATION.md`). Le prototype lui-même n'est **pas** intégré par Claude : c'est le rôle d'Antigravity.

**Pris en compte dans le site (PR #2)** : logo officiel, palette (`#121316`, `#60A5FA`), police Plus Jakarta Sans, icônes PWA et image de partage régénérées depuis `public/icon.svg`.

**Cohérent avec la documentation** : quatre piliers (mêmes noms et rôles), matrice PWA / Android / iOS de `docs/MOBILE_AND_MESH_CONSTRAINTS.md`, règles « vérité d'affichage », « consentement passerelle », « zéro perte silencieuse ».

**À traiter par Antigravity avant toute publication de `/app`** (bloquant = la construction du site échoue ou la PR ne doit pas être validée) :

| # | Constat dans la V0.2 | Gravité | Action attendue |
|---|---|---|---|
| A1 | **PRIORITÉ 1 (confirmée par le porteur du projet le 25/10/2026)** — Bouton « SOS Rapide », « Diffusion d'urgence », message « Signal de détresse diffusé aux nœuds mesh ! » alors que le réseau est simulé | **Bloquant (sécurité des personnes)** | Retirer de la version publiée, ou désactiver avec la mention « ne remplace pas le 112 » tant que la diffusion réelle n'est pas testée (PUBLICATION §3 règle 6). Le build bloque automatiquement. |
| A2 | Vocabulaire « urgence », « détresse vitale », balise stroboscopique, animation radar, repères « zone de sécurité / sanctuaire » | Bloquant (directive design) | Remplacer par le vocabulaire de `DESIGN.md` §7–8 (« Continuité », « annonces de la communauté », « fiches pratiques ») |
| A3 | Dépendances `@google/genai`, `express`, `dotenv` dans `package.json`, alors que le README affirme « aucune donnée envoyée à un service IA » | Bloquant (confidentialité) | Vérifier l'usage réel dans le code complet ; retirer toute dépendance IA de la version publiée ; aucune clé d'API dans le bundle (le build la détecte) |
| A4 | Google Fonts chargé dans `index.html` | Bloquant (CSP de `/app` et confidentialité) | Auto-héberger Plus Jakarta Sans / JetBrains Mono ou utiliser les polices système |
| A5 | `user-scalable=no, maximum-scale=1.0` dans la balise viewport | Bloquant (WCAG 1.4.4, zoom interdit) | Supprimer ces deux paramètres |
| A6 | Manifeste `id`, `start_url`, `scope` = `/` ; `apple-touch-icon.png` référencé mais absent ; `theme-color` `#090a0c` différent du manifeste | Majeur | `/app/` partout (PUBLICATION §4) ; réutiliser `site/assets/icons/` ; une seule couleur `#121316` |
| A7 | « Transport local réel » `BroadcastChannel` : ne relie que des onglets **du même navigateur** | Majeur (honnêteté) | Ne jamais le présenter comme une messagerie entre appareils ; ne compte pas pour le test M1 |
| A8 | Relais WebSocket local : nécessite un serveur (`express`) qui n'existe pas sur Cloudflare Pages | Majeur | Sur l'aperçu public, le désactiver ou l'afficher comme « nécessite une passerelle locale » |
| A9 | Formulations « garantir que vos échanges restent toujours accessibles », « Aucune esthétique… » mais promesse de continuité absolue | Mineur | Reformuler sans garantie absolue |
| A10 | Licence AGPL-3.0-or-later | Décision provisoire : option B | Fournir `package-lock.json` et la liste des licences des dépendances, confirmer l'origine des ressources (`LICENSING.md` §7, L1–L2) ; prévoir l'accès au code source de `/app` (article 13) |

## 6. Publication web

Exigences et répartition détaillées dans `PUBLICATION.md`. En bref : Claude fournit le site (`site/`), le script de construction et ses contrôles ; **Antigravity** prépare Cloudflare Pages, l'intégration du ZIP AI Studio dans `/app` et les tests de bout en bout ; **AI Studio** fournit l'application `/app`. La messagerie n'est annoncée comme opérationnelle qu'après le test M1 (deux clients distincts, chiffrement vérifié).

## 7. Prochaines étapes pour les agents locaux

Phase 0 de `ROADMAP.md` : expériences E1 à E10 sur appareils physiques, en commençant par **E1** (constat PWA/iPhone), **E2**, **E3** (BLE Android ↔ iPhone, compatibilité Bitchat) et **E10** (découverte Nearby). Rapports dans `docs/tests/`.

## 8. Contre-audit V0.2 et corrections ciblées (25 octobre 2026) — Claude

- Analyse complète : `docs/audits/CONTRE-AUDIT-V0.2.md` ; résultats bruts : `docs/tests/CONTRE-AUDIT-V0.2-2026-10-25.md`.
- Les corrections de Claude sont sur `validation/v0.2-contre-audit`, **pas** sur `ai-studio/prototype-v0` (laissée intacte à `9965e5e`).
- Fichiers d'Antigravity touchés, à relire par Antigravity : `WebSocketTransport.ts`, `TransportManager.ts`, `BroadcastTransport.ts`, `QuickSOSButton.tsx`, `MessagesScreen.tsx`, `ResilienceScreen.tsx`, `EmergencyBroadcastPanel.tsx`, `i18n.ts`, `App.tsx`, `main.tsx`, `tests/real-two-clients.test.ts`, `tools/relay/server.js`. Nouveau : `core/urlHygiene.ts`, `tests/url-hygiene.test.ts`, `tools/audit/*`.
- Protocole relais modifié : le relais envoie `MESHORA_CHALLENGE {nonce, room}` ; le client répond par `MESHORA_HELLO` avec `helloSignature` = ECDSA P-256/SHA-256 de `MESHORA-HELLO|v1|<room>|<nonce>|<publicKeyHex>` ; l'identifiant doit valoir `msh_` + 12 premiers hex de SHA-256(clé SPKI). `MESHORA_MSG` (clair) n'existe plus.
- Reste à Antigravity : voir `CONTRE-AUDIT-V0.2.md` §8.
- Règle maintenue : la messagerie entre appareils n'est annoncée nulle part tant que l'essai Mac ↔ téléphone (§11) n'est pas consigné dans `docs/tests/`.

## 9. Android et Bitchat (26 octobre 2026) — Claude

- Branche `claude/android-interop` : PR #5 + PR #7 (`f990e03`, fusion sans conflit) + corrections Android. PR #7 et `android/native-beta` ne sont pas modifiées.
- **Clé de signature `android/meshora-upload.jks` publiée sur GitHub avec son mot de passe** : à considérer comme compromise. Ne jamais l'enregistrer sur Google Play. En générer une nouvelle hors dépôt (`docs/audits/CONTRE-AUDIT-ANDROID-V0.2.md` §3).
- Le protocole commun est décrit dans `docs/PROTOCOLE-V0.2.md`. Toute modification du protocole (web, Android, relais) doit passer `bash tools/audit/interop-android.sh`.
- Antigravity : reprendre ou contester les corrections Android ; restent A-P1-5 à A-P1-8 et A-P2-2.
- REA : `docs/audits/CONTRE-AUDIT-REA-BITCHAT.md` corrige plusieurs affirmations de `REA-BITCHAT.md` et fixe le protocole d'essais B-T1 à B-T8 ; l'audit approfondi sur appareils reste à faire.

## 10. Suite (26 octobre 2026, 9 h) — Claude

- Revue indépendante de la PR #8 (agent distinct) : aucun P0 ; P1/P2 traités dans `3b4dca0` (accusés v2, renvois progressifs, reconnexion Android, AGP 8.9.3). Détails : `CONTRE-AUDIT-ANDROID-V0.2.md` §5.
- **Changement de protocole** : accusés v2 (`docs/PROTOCOLE-V0.2.md` §3). La prévisualisation `validation-v0-2-contre-audit` (accusés v1) n'est plus compatible avec le relais de test : utiliser `integration-v0-2.meshora.pages.dev`.
- Nouvelle clé d'importation Android générée hors dépôt (`CONTRE-AUDIT-ANDROID-V0.2.md` §6). Antigravity : ne plus utiliser `android/meshora-upload.jks` ni les APK/AAB signés avec elle.
- Socle du maillage natif (trame, fragmentation, relais TTL, limiteur, UUID 128 bits) : branche `claude/mesh-ble-prep`, spécification `docs/MESH-NATIF-V0.3.md`. Antigravity : construire `BleLink` dessus, sans dupliquer `mesh/`.

## 11. Site public v0.3.0-preview (26 octobre 2026, soir) — Claude

- Branche `site/decouvrir-installer` (au-dessus de `claude/ble-link`) : pages Découvrir et Installer finalisées en FR/EN, sans changement de design ni de logo.
- **Découvrir** : schéma SVG accessible (deux orientations), trois catégories distinguées par la forme du trait et par le texte (vérifié / en développement / vision future), lecture en texte. Les promesses non démontrées ont été retirées (« rien n'est perdu », QR, Nostr, iPhone qui relaie).
- **Installer** : seul lien APK affiché = 0.2.1-beta (provenance GitHub, version 3, SHA-256 `dd56b3da…`, certificat `5f:18:1e:db:…`), vérifiés le 26/10 ; la version Bluetooth est signalée « en développement », lien vers la page de version seulement. iPhone : prévu, sans lien.
- `site/releases.json` accepte maintenant `planned`, `web`, `future` ; le contrôle de construction refuse toujours tout lien de téléchargement non déclaré.
- Versions alignées : site et application web 0.3.0-preview, application Android 0.2.1-beta (vérifiée) et 0.3.0-alpha-ble2 (essai).
- Grok Bot / Antigravity : toute nouvelle version Android doit être ajoutée à `site/releases.json` **après** vérification (provenance, version, empreinte, certificat, essai sur appareil).
- Vérification : `BASE=<prévisualisation> node tools/audit/site-pages.mjs` (120 contrôles), captures `docs/tests/captures-site-v0.3/`.

## 12. Mission V0.3 — relais par défaut, Android grand public, intégration (26–27 octobre 2026) — Claude

**Branche d'intégration** : `integration/v0.3` (PR finale vers `main`, brouillon, **non fusionnée**). Elle contient, dans l'ordre, toutes les PR #1 → #11 (chaîne linéaire vérifiée : chaque branche est ancêtre de la suivante), puis le relais Cloudflare et les travaux V0.3.

| Fait | Où | Preuve |
|---|---|---|
| Relais de référence Cloudflare (préproduction) | `relay/cloudflare/` | 13/13 contre l'adresse réelle |
| Android 0.3.0-beta1 (relais par défaut, invitations, FR/EN, clé chiffrée) | `android/` | 29/29 tests, interopérabilité via le relais réel ; release `android-v0.3.0-beta1` |
| Web : relais par défaut, invitations | `prototype/src/core/invitation.ts` | 5/5 navigateurs réels |
| Site : Installer 0.3.0-beta1 « en validation », assetlinks.json | `site/` | 121/121 |
| Revue Bluetooth + plan d'essais physiques | `docs/BLUETOOTH-V0.3.md` | — |

**Pour Antigravity** : la PR #7 contient la clé compromise et son mot de passe dans l'historique ; ne plus réutiliser `android/meshora-upload.jks` de ta copie locale. Les nouveaux écrans Compose sont entièrement en ressources (`values/` anglais, `values-fr/` français) : toute nouvelle chaîne doit passer par `stringResource`. Les essais physiques Bluetooth P1–P7 sont décrits dans `docs/BLUETOOTH-V0.3.md`.
**Pour REA** : l'audit Bitchat approfondi reste à faire (protocole B-T1 à B-T8, `docs/audits/CONTRE-AUDIT-REA-BITCHAT.md`) ; Claude lance une analyse des sources de Bitchat et une étude Tor à la fin de cette mission (demande du directeur artistique, 26/10, 23 h 25).
**Pour Grok Bot** : décisions humaines en attente listées dans la PR d'intégration.

## 13. Corrections et validation V0.3 (27 octobre 2026, matin) — Claude

| Correction | Où | Preuve |
|---|---|---|
| Bluetooth : trames scellées par la clé du groupe (plus de nom ni de clé en clair) | `mesh/GroupSeal.kt`, `prototype/src/mesh/groupSeal.ts` | Vecteurs Python/Kotlin/TS identiques ; `MeshRouterTest` avec espion radio |
| Android : nom des interlocuteurs conservé après déconnexion | `MeshoraApp.rememberConversationPartners` | Émulateur, essai A5 |
| Web sur Android : bandeau « Ouvrir dans l'application » (Chrome bloquait la redirection) | `WebSocketTransport.showAndroidInviteBanner` | Navigateur Android émulé |
| Tor (branche séparée) : coupure immédiate de l'ancienne connexion directe ; interrogation du port SOCKS ; message « Tor n'atteint pas le relais » | `claude/tor-option` | Émulateur : 0 connexion directe en mode Tor, 8/8 à travers Tor |
| Intégration sans historique compromis | branche `release/v0.3` (un seul commit, même arbre que `integration/v0.3`) | ni la clé ni son mot de passe atteignables depuis cette branche |

**Pour Antigravity** : ta copie locale `/Users/cedriccarboni/Projets/MESHORA/android/meshora-upload.jks` est la clé **compromise** (empreinte `07:6D:EA…`, mot de passe public dans l'historique de la PR #7). Ne jamais l'utiliser ; sa suppression est à décider avec le directeur artistique. Toute trame Bluetooth doit passer par `GroupSeal` (aucune trame en clair n'est plus lue).
**Pour Grok Bot** : la PR à fusionner (après accord) est la PR « release/v0.3 » vers `main`, pas la PR #12 (qui importerait l'historique de la PR #7).

