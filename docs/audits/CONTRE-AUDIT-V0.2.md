# Contre-audit final — prototype V0.2 (PR #3) et corrections ciblées

| | |
|---|---|
| Date | 25 octobre 2026 |
| Auteur | Claude (contre-audit indépendant et corrections ciblées) |
| Code audité | `ai-studio/prototype-v0` @ `9965e5e` (Antigravity) |
| Branche de validation | `validation/v0.2-contre-audit` (part de `9965e5e`, n'écrit pas sur la branche d'Antigravity) |
| Référence | `docs/audits/AUDIT-PR3-V0.2.md` (8 P0, 12 P1, 9 P2) |
| Environnement d'essai | Mac M4, macOS, Node 24.21, Google Chrome (Playwright, sans tête) ; Python 3.9 pour le site |
| Fusion / production | **Aucune.** Rien n'est fusionné dans `main`, rien n'est publié en production, aucune prévisualisation supprimée. |

## 0. Verdict

1. **Les affirmations d'Antigravity sont reproduites mais insuffisantes.** `tsc` : 0 erreur ; tests unitaires 13/13 ; tests d'intégration 9/9. Mais les tests d'intégration exercent des clients Node écrits pour le test, **pas le code de l'application**. Sur le vrai code (banc indépendant, clients applicatifs dans des processus distincts), **1 comportement sûr sur 10** à `9965e5e` : envoi en clair dès trois participants, accusé non signé accepté, usurpation de pair, détournement de boîte aux lettres, réception différée et renvoi après coupure absents, relais vulnérable (trames non masquées, Origin, 1,8 Gio de mémoire pour 96 Mio envoyés).
2. **Après corrections ciblées (branche de validation)** : 10/10 au banc applicatif, 7/7 en navigateur réel, 13/13 + 12/12 + 9/9 aux tests du projet, compilation et construction complètes sans erreur.
3. **La messagerie inter-appareils n'est pas démontrée.** Elle est démontrée **entre deux navigateurs indépendants sur un même Mac** via un relais local. Entre un Mac et un téléphone, rien n'a été essayé : il manque un relais joignable en `wss://` et une CSP qui l'autorise (§5). Elle ne doit pas être annoncée comme fonctionnelle.
4. **Le maillage Bluetooth reste une étape native future.** Aucun code BLE n'existe ; le navigateur ne peut pas en faire (voir `NATIVE_MESH_SPEC.md` §2).

## 1. Méthode et niveaux de preuve

| Niveau | Ce qui est prouvé | Ce qui ne l'est pas |
|---|---|---|
| **Simulé** | Comportement de l'interface avec des données inventées (marquées « SIMULATION ») | Toute transmission |
| **Intégration (Node)** | Le relais et la cryptographie fonctionnent entre processus sur une même machine (`tests/real-two-clients.test.ts`, `tools/audit/run.ts`) | Le navigateur, le réseau réel, un téléphone |
| **Navigateur réel (même machine)** | L'application construite (`dist/app`) échange entre onglets et entre deux instances Chrome indépendantes via un relais local (`tools/audit/browser.mjs`) | Deux appareils, deux réseaux, Safari iOS |
| **Physique** | — | **Aucun essai à ce jour** (même Wi-Fi, réseaux différents, BLE) |

Outils ajoutés (branche de validation) :

- `tools/audit/app-client.ts` + `tools/audit/run.ts` : le vrai `TransportManager`, `WebSocketTransport`, `storage`, `identity` et `crypto` tournent dans des processus Node distincts, pilotés par IPC ; un attaquant « brut » et une écoute de tout ce que le relais émet. Scénarios T1–T9.
- `tools/audit/relay-dos.mjs` : relais dans un processus séparé, trame annoncée à 1 Gio (T10).
- `tools/audit/browser.mjs` : site construit servi localement, relais local, Chrome ; scénarios B1–B5 avec captures (`docs/tests/captures-v0.2/`).
- `prototype/tests/url-hygiene.test.ts` : 12 cas.

## 2. Résultats chiffrés

### 2.1 Banc applicatif (vrai code, processus distincts)

| Id | Scénario | `9965e5e` (Antigravity) | Branche de validation |
|---|---|---|---|
| T1 | Deux clients : réception, relais aveugle, « Délivré » | ✅ | ✅ |
| T2 | Trois participants : aucun clair sur le relais | ❌ le texte passe **en clair** et est lu par le 3ᵉ | ✅ une enveloppe chiffrée par pair |
| T3 | Accusé non signé forgé par un participant | ❌ passe à « Délivré » | ✅ reste « Envoyé » |
| T4 | Tiers revendiquant l'identifiant de Bob | ❌ déchiffre le message, Bob ne reçoit rien, A affiche « Délivré » | ✅ refusé par le relais et par le client ; Bob reçoit |
| T5 | Boîte aux lettres retirée en déclarant la clé publique de Bob | ❌ courrier volé, perdu pour Bob | ✅ remis au seul détenteur prouvé de la clé |
| T6 | Message envoyé avant l'arrivée du destinataire | ❌ jamais reçu, reste « Envoyé » | ✅ reçu, « Délivré », sorti de l'Outbox |
| T7 | Coupure puis redémarrage du relais | ❌ jamais renvoyé | ✅ « En attente » pendant la coupure, puis reçu et « Délivré » |
| T8 | Trame cliente non masquée (RFC 6455 §5.1) | ❌ traitée | ✅ connexion fermée (1002) |
| T9 | Page d'un autre site (Origin étrangère) | ❌ acceptée | ✅ refusée (403) |
| T10 | Trame annoncée à 1 Gio | ❌ +1,75 Gio de mémoire, connexion maintenue | ✅ fermée (1009), +1 Mio |

### 2.2 Navigateur réel (Chrome, `dist/` construit, relais local)

| Id | Scénario | Résultat |
|---|---|---|
| B1 | Deux onglets du même navigateur | ✅ reçu |
| B2 | Deux instances Chrome indépendantes (profils séparés, ordinateur 1280×800 et mobile 390×844) | ✅ A→B reçu, « Délivré » chez A, B→A reçu |
| B3 | `?utm_source…&room=atelier&fbclid…#messages` sur `/app/` | ✅ adresse affichée `…/app/?room=atelier#messages` |
| B3b | Site : `?utm_campaign=z&x=1` | ✅ `?x=1` |
| B4 | Lien `?relay=wss://relais-inconnu.example/ws` | ✅ accord demandé ; refus respecté (rien d'enregistré) |
| B5 | Bouton 112, mobile et ordinateur | ✅ 40 × 40 px, 15 px au-dessus de la barre de navigation, aplat sans dégradé ni animation, `aria-label`, fenêtre `role="dialog"` nommée, piège de focus, Échap, focus rendu au bouton |

### 2.3 Tests du projet et construction (Mac, branche de validation)

`npx tsc --noEmit` : 0 erreur · `npm test` : unitaires 13/13, hygiène d'adresse 12/12, intégration 9/9 · `vite build` : OK · `python3 scripts/build_site.py` : OK (10 pages + `/app`, gardes de publication passées).

## 3. Statut anomalie par anomalie (référence : AUDIT-PR3-V0.2)

Légende : **C** corrigé · **PC** partiellement corrigé · **NC** non corrigé. « Antigravity » = corrigé dans `9965e5e` ; « Claude » = corrigé sur la branche de validation.

### P0

| Id | Statut | Preuve |
|---|---|---|
| P0-1 SOS fictif | **C** (Antigravity, complété par Claude) | Le SOS est remplacé par un accès aux numéros officiels ; aucun envoi. Claude : bouton 40 px sobre, confirmation en deux temps (ouvrir → choisir le numéro), fenêtre accessible (B5). |
| P0-2 Signatures fabriquées « vérifiées » | **C** (Claude) | `Math.random` supprimé par Antigravity, mais badges « Signature Ed25519 vérifiée » / « Signé Ed25519 » encore affichés sans aucune signature (`ResilienceScreen.tsx:525`, `EmergencyBroadcastPanel.tsx:691`). Remplacés par « non signé · non vérifié ». |
| P0-3 « Délivré » sans destinataire | **C** (Antigravity + Claude) | Antigravity : `isAvailable()` réel, « Envoyé » ≠ « Délivré ». Faille résiduelle (T3, T4) : tout ACK accepté. Claude : « Délivré » seulement si ACK signé par une clé à laquelle le message a été chiffré. |
| P0-4 Perte silencieuse | **C** (Antigravity + Claude) | Antigravity : l'Outbox garde le message jusqu'à l'ACK. Résiduel : renvoi présumé réussi, jamais déclenché à l'arrivée d'un pair (T6, T7). Claude : renvoi réel, au retour d'un pair et toutes les 15 s. |
| P0-5 « Chiffré » sans chiffrement | **C** (Antigravity + Claude) | Antigravity : vraie cryptographie WebCrypto. Résiduel : repli **en clair** (T2), cadenas inconditionnel, « chiffré localement ». Claude : E2EE obligatoire, réception en clair refusée, cadenas seulement si une enveloppe est partie. |
| P0-6 Alertes fictives réelles | **PC** | Plus d'alerte initiale. Restent : préréglages de simulation sans « [SIMULATION] » pour certains, repère « Poste-Secours-Centre », carillon (`resilienceEngine.ts:640-760`). À Antigravity. |
| P0-7 Pairs inventés « vérifiés » | **C** (Antigravity + Claude) | Plus de pair fictif. Résiduel : pairs relais et onglets marqués `verified: true`. Claude : `verified: false` tant qu'aucune vérification hors bande (QR) n'existe ; identifiant lié à la clé. |
| P0-8 Aperçu public | **NC** | `ai-studio-prototype-v0.meshora.pages.dev` sert encore `d79b1b9` (bundle contenant « chiffré localement »). À redéployer depuis la branche de validation **avec votre accord**. |

### P1

| Id | Statut | Preuve |
|---|---|---|
| P1-1 Relais inexistant | **PC** | Relais Node fourni (Antigravity), durci (Claude). Non hébergé ; la CSP de `/app` (`connect-src 'self'`) bloque tout relais externe (§5). |
| P1-2 BroadcastChannel présenté comme réseau | **C** (Claude) | Textes : « Test local : 2ᵉ onglet du même navigateur. Entre appareils, un relais de test est nécessaire. » |
| P1-3 « Connecté » sans test | **C** (Antigravity) | Sonde `HEAD /version.json`, état `local_only`. |
| P1-4 Déduplication volatile | **C** (Antigravity) | Cache persistant de 500 identifiants + validation de schéma. |
| P1-5 SW en ligne bloqué par la CSP | **C** (Antigravity) | Enregistré dans le bundle (`main.tsx`). |
| P1-6 Zoom interdit | **C** (Antigravity) | `index.html` corrigé. |
| P1-7 Google Fonts | **C** (Antigravity) | Supprimé. |
| P1-8 Géolocalisation au SOS | **C** (Antigravity) | Plus de géolocalisation dans le bouton. |
| P1-9 « 112 sans SIM » | **C** (Antigravity) | Formulation corrigée. |
| P1-10 Fréquence LoRa | **PC** | Fiche corrigée (869,525) ; reste « 868.250 MHz Slot 1 » dans la carte (`resilienceEngine.ts:76`). |
| P1-11 Icônes PNG iOS | **C** (Antigravity) | Manifeste `/app/` avec PNG. |
| P1-12 Tests tautologiques | **NC** | Le test 9 (`Relais-Voisin-42`) reste tautologique. Compensé par le banc indépendant, pas corrigé. |

### P2

| Id | Statut | Preuve |
|---|---|---|
| P2-1 Dépendances inutiles | **NC** | `@google/genai`, `express`, `dotenv` toujours déclarés. |
| P2-2 `.aistudio/` versionné | **NC** | Toujours présent. |
| P2-3 Stroboscope | **NC** | Toujours présent (`EmergencyBroadcastPanel.tsx:68-70`). Risque photosensible : à retirer ou limiter à < 3 éclairs/s avec avertissement. |
| P2-4 « Diffusé à proximité » | **PC** | Avertissement corrigé ; « Re-diffuser… aux appareils plus éloignés » subsiste (`:707`) alors que la portée est l'onglet local. |
| P2-5 Promesses (« zéro message perdu », « toujours accessibles ») | **C** (Claude) | FR et EN réécrits (« prototype », « le plus longtemps possible »). |
| P2-6 Shield « protection active » | **PC** | Suffixe « (Simulation d'intention) » ajouté ; libellé principal à revoir. |
| P2-7 Nom de cache fixe | **NC** | `meshora-app-v0.2.0`. |
| P2-8 Textes codés en dur | **C** (Claude) | Bouton 112 entièrement bilingue. |
| P2-9 Carte fictive sans mention | **NC** | 7 repères `verified: true` sur coordonnées fictives ; aucune mention « exemple ». |

**Bilan** : 8 P0 → 6 C, 1 PC, 1 NC (P0-8, redéploiement à autoriser). 12 P1 → 9 C, 2 PC, 1 NC. 9 P2 → 2 C, 3 PC, 4 NC.

## 4. Sécurité : ce qui est vérifié, ce qui reste

| Point | État après corrections | Limite restante |
|---|---|---|
| Chiffrement de bout en bout | ECDH P-256 éphémère + AES-256-GCM, signature ECDSA de l'enveloppe ; **aucun repli en clair** (T2) | Pas de KDF (secret ECDH utilisé directement) ; même paire de clés pour ECDSA et ECDH ; pas de confidentialité persistante côté expéditeur |
| Authentification des pairs | Identifiant = empreinte de la clé (48 bits) ; HELLO signé sur défi du relais ; usurpation refusée (T4) | **Aucune vérification hors bande** (QR, TOFU) : un relais malveillant peut toujours substituer sa propre clé (homme du milieu). Identifiant de 48 bits : collision ciblée coûteuse mais possible. Prochaine étape : QR + épinglage de clé. |
| Accusés | Signés, liés au message et à une clé destinataire réelle (T3) | « Délivré » = au moins un destinataire du salon |
| Boîte aux lettres | Remise au seul détenteur prouvé de la clé (T5), 24 h, 50/destinataire, 1000/salon | Mémoire vive : perdue au redémarrage du relais (l'Outbox de l'expéditeur compense par renvoi, T7) |
| Usurpation d'expéditeur | Signature vérifiée par le destinataire ; le relais refuse une enveloppe dont l'expéditeur ≠ la clé authentifiée | — |
| Relais (RFC 6455, DoS) | Trames ≤ 256 Kio, masquage exigé, fragmentation refusée, Origin en liste blanche, 60 msg/10 s, 64 clients/salon, 200 salons, ping 30 s, écoute 127.0.0.1 par défaut (T8–T10) | Pas de TLS natif (à confier au tunnel ou à la plateforme) ; pas de limite par IP |
| Clé privée | — | Extractible, en clair dans `localStorage` : lisible par tout script de l'origine. À migrer vers une clé non extractible (IndexedDB) |
| Relais proposé par lien | Accord explicite demandé, `wss://` exigé hors réseau local (B4) | — |
| Confidentialité de position | Aucune géolocalisation demandée par l'app à ce stade | La carte est fictive (P2-9) |
| Comportement réseau | « En attente » hors ligne, renvoi réel, sonde de joignabilité | — |
| Alertes officielles / voisins | Aucune alerte officielle simulée ; aucun voisin inventé hors bouton « SIMULATION » | Préréglages P0-6 à finir |

## 5. Où tourne le relais ? Coûts et limites

**Constat** : le relais n'est hébergé nulle part. Cloudflare Pages ne sert que des fichiers. L'aperçu n'a donc **aucun** relais (`resolveRelayUrl` renvoie `null` hors `localhost`). De plus, la CSP de `/app` (`site/_headers`) limite `connect-src` à `'self'` : même avec `?relay=`, **le navigateur refuse la connexion à un relais externe**. Enfin, sur téléphone, une page en `http://<IP du Mac>` n'est pas un contexte sécurisé : WebCrypto y est indisponible, l'application ne peut pas chiffrer. **Il faut HTTPS pour la page et `wss://` pour le relais.**

| Option | Coût | Effort | Limites | Usage recommandé |
|---|---|---|---|---|
| A. Relais Node sur le Mac + tunnel rapide Cloudflare (`cloudflared tunnel --url http://127.0.0.1:8787`) | Gratuit, sans compte | Faible (relais prêt) | Adresse `*.trycloudflare.com` aléatoire et éphémère ; Mac allumé ; pas de garantie de service | **Essai Mac ↔ téléphone immédiat** |
| B. Cloudflare Workers + Durable Objects (WebSocket Hibernation) | Offre gratuite : 100 000 requêtes/jour, 13 000 Go·s/jour ; messages WebSocket entrants comptés 20 pour 1 ; au-delà, refus. Payant : 5 $/mois minimum | Moyen : port du relais (≈ 300 lignes) vers l'API Durable Objects | Mémoire et stockage par objet ; boîte aux lettres à persister dans le stockage de l'objet | **Relais de test durable**, même compte que Pages |
| C. Serveur loué (VPS) | ≈ 4–6 €/mois | Moyen + exploitation (TLS, mises à jour) | Responsabilité d'exploitation | Plus tard, si besoin hors Cloudflare |

Dans tous les cas, la CSP de `/app` doit autoriser **explicitement** l'adresse du relais (`connect-src 'self' wss://<hôte-du-relais>`), sur la prévisualisation uniquement tant que la messagerie n'est pas validée. Ce changement n'est **pas** fait : il dépend du choix A ou B et de votre accord.

## 6. Adresse de l'application

- Cible : `https://meshora.pages.dev/app/` (non publiée ; la production reste en attente de votre accord).
- `utm_*` et identifiants de clic (`fbclid`, `gclid`, `msclkid`, etc.) retirés de l'adresse affichée et des liens partagés, sur le site et l'application ; paramètres fonctionnels (`relay`, `room`, invitation, appairage) et fragment conservés (B3, B3b, 12 tests unitaires). MESHORA ne génère aucun paramètre de suivi.
- Aucune adresse interne ne dépend de `ai-studio` : les seules occurrences sont des mentions documentaires et le nom de la branche de prévisualisation (`ai-studio-prototype-v0.meshora.pages.dev`), qui reste en place pendant les essais.
- Prévisualisations conservées : `ai-studio-prototype-v0.meshora.pages.dev` (à `d79b1b9`) et `4bc420bf.meshora.pages.dev` (HTTP 200).

## 7. Interface : bouton 112

Avant : 56 px, dégradé rose-rouge, ombre forte, `bottom-24` dans un conteneur animé (le bouton « fixe » défilait avec la page : relevé à 3017 px du haut sur mobile), fenêtre sans `role="dialog"`, sans Échap ni gestion du focus, bouton de fermeture sans nom.
Après : 40 × 40 px, aplat `rose-600`, ombre légère, pictogramme téléphone seul (« 112 » lu par les lecteurs d'écran), rendu par portail dans `<body>`, ancré à 76 px + zone sûre au-dessus du bas (15 px au-dessus de la barre de navigation), contenu principal décalé (`pb-32`) pour ne rien masquer en fin de page ; fenêtre `role="dialog"` `aria-modal` nommée, piège de focus, Échap, clic hors fenêtre, retour du focus ; confirmation en deux temps ; 15/18/114 signalés « France ». Captures : `docs/tests/captures-v0.2/b5-*.png`.

## 8. Ce qui reste (par responsable)

**Antigravity (développement)** : P0-6 (préréglages, « Poste-Secours-Centre », carillon) ; P1-10 (868,250 MHz dans la carte) ; P1-12 (test 9) ; P2-1, P2-2, P2-3 (stroboscope), P2-4, P2-6, P2-7, P2-9 ; clé privée non extractible ; KDF (HKDF) et séparation des clés ECDSA/ECDH ; libellé de transport du message envoyé (« Broadcast » affiché alors que l'envoi passe aussi par le relais).
**Décision du directeur artistique** : option de relais (A ou B) ; ajout de l'hôte du relais à la CSP de prévisualisation ; redéploiement de la prévisualisation depuis la branche de validation (P0-8).
**Essais physiques** (non réalisés) : Mac ↔ téléphone, même Wi-Fi ; réseaux différents (4G/5G) ; Safari iOS ; réception différée réelle ; puis, plus tard, BLE natif (E2–E4).

## 9. Critère de fin

| Exigence | État |
|---|---|
| Code vérifié | ✅ |
| Tests exécutés | ✅ (projet, banc applicatif, navigateur) |
| Preuves consignées | ✅ ce document, `docs/tests/CONTRE-AUDIT-V0.2-2026-10-25.md`, captures |
| Plan de fusion prêt | ✅ PR de consolidation en brouillon (§10) |
| Messagerie inter-appareils démontrée | ❌ **non** — essai Mac ↔ téléphone à faire |

Le contre-audit est **terminé pour le code et les essais sur une machine**. Il n'est **pas** « DONE » pour la messagerie entre appareils, qui exige l'essai physique décrit en §11.

## 10. Plan de fusion proposé (à valider, rien n'est fusionné)

Chaîne actuelle : #1 `docs/audit-architecture` → `main` ; #2 `web/public-site` → #1 ; #3 `ai-studio/prototype-v0` → #2 ; #4 `docs/audit-pr3` → #2.

La branche `validation/v0.2-contre-audit` contient, sans réécriture d'historique : `main`, #1, #2, #3 (`9965e5e`, intact), #4 (fusion sans conflit) et les corrections de Claude. Elle est proposée en **PR de consolidation en brouillon vers `web/public-site`**.

Ordre recommandé, chaque étape sur votre accord :
1. Antigravity relit les corrections de Claude (PR de consolidation) et les reprend ou les conteste.
2. Fusion de la consolidation dans `web/public-site` (elle absorbe #3 et #4, qui se ferment alors d'elles-mêmes).
3. Fusion de #2 dans `docs/audit-architecture`, puis de #1 dans `main`.
4. Production : seulement après l'essai Mac ↔ téléphone réussi et votre accord.

Licences : inchangées depuis la vérification précédente (option B provisoire ; 270 paquets npm, licences compatibles, 0 vulnérabilité). Aucune dépendance ajoutée par Claude ; `playwright-core` n'est utilisé qu'en dehors du dépôt, pour les essais.

## 11. Prochaine action : application testable entre le Mac M4 et un téléphone

1. Accord sur l'option A (gratuite, immédiate) pour l'essai.
2. Claude ajoute `wss://*.trycloudflare.com` à la CSP de `/app` **sur la prévisualisation uniquement** et redéploie la prévisualisation existante depuis la branche de validation.
3. Sur le Mac : `node tools/relay/server.js` puis `cloudflared tunnel --url http://127.0.0.1:8787` (affiche une adresse `https://xxx.trycloudflare.com`). Ajouter l'origine de prévisualisation à `MESHORA_ALLOWED_ORIGINS` si elle diffère.
4. Sur le Mac (Chrome) et sur le téléphone : ouvrir `https://ai-studio-prototype-v0.meshora.pages.dev/app/?relay=wss://xxx.trycloudflare.com&room=essai1`, accepter le relais.
5. Essais à consigner : Wi-Fi commun ; téléphone en 4G/5G ; message envoyé téléphone éteint puis rallumé ; coupure du relais ; captures et versions (iOS/Android, navigateur).
