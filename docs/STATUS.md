# MESHORA — État réel des fonctionnalités

> Source de vérité sur ce qui **fonctionne réellement**. Mis à jour par pull request uniquement.
> Une fonction ne passe en « ✅ Testée » qu'avec un lien vers un rapport dans `docs/tests/` (appareils, versions d'OS, version de l'app, données brutes).

Résumé public (FR) : Le 29 octobre 2026, le site est publié en version 0.3.0 et l'application web est en ligne sous /app. Elle passe par le relais de production, vérifié depuis un ordinateur (13/13). Le Bluetooth et l'application Android 0.3.0-beta2 n'ont pas encore été testés sur un vrai téléphone.

Résumé public (EN) : On 29 October 2026, the site was published as version 0.3.0 and the web app went live under /app. It uses the production relay, checked from a computer (13/13). Bluetooth and the Android 0.3.0-beta2 app have not yet been tested on a real phone.

Légende : ⛔ Bloquée pour publication · ⬜ Non commencée · 📐 Spécifiée · 🎭 Simulée dans le prototype (aucun réseau réel) · 🔧 Implémentée, non testée sur appareils · ✅ Testée sur appareils physiques · ❌ Écartée

**V0.3 — mise à jour du 29 octobre 2026 : site public publié en production (`meshora.pages.dev`, version 0.3.0) ; application web `/app` publiée, reliée au relais de production `wss://meshora-relay.acousmaticregietools.workers.dev`, en ligne et vérifié 13/13 le 29/10 (`docs/tests/v0.3/relais-production-2026-10-29.md`). Bluetooth et Android 0.3.0-beta2 toujours non testés sur vrai téléphone.**

**V0.3 — mise à jour du 27 octobre 2026 : Android 0.3.0-beta2 vérifiée sur émulateur Android 16 (APK signé ↔ client web réel via le relais, 8/8) ; Bluetooth scellé par la clé du groupe ; relais résilient (redémarrage, absence 3 min, 4/4). Essai sur vrai téléphone toujours à faire.**

**V0.3 (26 octobre 2026, nuit) : relais de référence Cloudflare en préproduction, connexion automatique et invitations — vérifiés automatiquement contre l'adresse réelle, essai sur téléphone à faire. Détail : `docs/tests/v0.3/`.**

**État au 26 octobre 2026 : une seule fonction est testée sur appareil physique, l'échange chiffré Android ↔ web via un relais Internet de test (Pixel ↔ Mac). Tout le reste est spécifié, simulé ou testé sur ordinateur seulement.** Contre-audit et corrections (branche `validation/v0.2-contre-audit`) : `docs/audits/CONTRE-AUDIT-V0.2.md` ; messagerie vérifiée entre navigateurs sur une machine (25/10), puis entre un Pixel et le Mac via relais Internet (26/10). Audit du prototype V0.2 : `docs/audits/AUDIT-PR3-V0.2.md` (8 P0, 12 P1 ; 0 critère sur 18 de messagerie opérationnelle rempli).

| Pilier | Fonction | État | Plateformes testées | Rapport |
|---|---|---|---|---|
| Mesh | Identité et vérification QR | 📐 | — | — |
| Mesh | Enveloppe chiffrée | 📐 | — | — |
| Mesh | Messagerie BLE Android ↔ iPhone (premier plan) | 📐 | — | E2, E3 à faire |
| Mesh | Relais BLE iPhone en arrière-plan | 📐 | — | E4 à faire |
| Connect | Stockage-relais et synchro Nostr | 📐 | — | E9 à faire |
| Connect | Meshtastic / MeshCore | 📐 | — | E7 à faire |
| Connect | Mastodon / Bluesky | 📐 | — | — |
| Shield | VPN WireGuard vers sa passerelle | 📐 | — | S1–S4 à faire |
| Shield | Tor côté passerelle | 📐 | — | — |
| Resilience | Détection de perte de connexion | 📐 | — | R1, R2 |
| Resilience | Basculement des transports | 📐 | — | — |
| Resilience | États de message sans perte silencieuse | 📐 | — | R4, R5 |
| Resilience | Passerelles signées et consentement | 📐 | — | R3 |
| Resilience | Échanges de fichiers | 📐 | — | R6 |
| Resilience | Cartes et documents hors ligne | 📐 | — | R7 |
| Resilience | Mode économie de batterie | 📐 | — | R10 |
| Resilience | Alertes communautaires signées | 📐 | — | R8 |
| Resilience | Indicateur VPN / chiffrement | 📐 | — | R9 |
| Mesh (Nearby) | Appairage QR Android ↔ iPhone | 📐 | — | N1 |
| Mesh (Nearby) | Reconnaissance par identifiant tournant | 📐 | — | N2–N5 |
| Mesh (Nearby) | Révocation d'un contact | 📐 | — | N6 |
| Mesh (Nearby) | Appairage de relais (AccessorySetupKit / CompanionDeviceManager) | 📐 | — | N10 |
| Prototype V0.2 | Messagerie entre onglets d'un même navigateur (BroadcastChannel) | 🔧 | Chrome (Mac) | Testée entre onglets (contre-audit B1, `docs/tests/CONTRE-AUDIT-V0.2-2026-10-25.md`) |
| Prototype V0.2 | Relais WebSocket chiffré de bout en bout (relais de test) | 🔧 | Chrome × 2 instances, un seul Mac | Fonctionne entre deux navigateurs indépendants sur une machine (B2, T1–T10) ; **non hébergé ; CSP de `/app` bloquante ; non testé entre appareils** |
| Prototype V0.2 | File d'attente hors ligne | 🔧 | Node + Chrome, un seul Mac | Conservée jusqu'à accusé signé ; renvoi réel (T6, T7) ; non testée sur appareil |
| Prototype V0.2 | VPN (WireGuard, VpnService, NEPacketTunnelProvider) | 🎭 | — | Interfaces factices « nécessite un module natif » |
| Prototype V0.2 | Cartes et repères hors ligne | 🔧 | — | Annoncé, non vérifié |
| Prototype V0.2 | Accès aux numéros d'urgence (112) | 🔧 | Chrome mobile et ordinateur (émulés) | Aucun envoi par MESHORA ; liens `tel:` ; bouton accessible (B5). Diffusion d'alertes : ⛔ toujours bloquée |
| Prototype V0.2 | Signatures, « vérifié », chiffrement | 🔧 | Node + Chrome, un seul Mac | WebCrypto réel ; plus de badge de signature fictif ; clés **non vérifiées hors bande** (pas de QR) |
| Android V0.2 | Application native Kotlin + Compose (sans WebView) | 🔧 | JVM (Mac) uniquement | Compile (API 36) ; `docs/audits/CONTRE-AUDIT-ANDROID-V0.2.md` |
| Android V0.2 | Échange chiffré Android ↔ web via relais Internet (accusés signés v2) | ✅ | Google Pixel 9 (Wi-Fi, 5G) ↔ Mac M4 (navigateur), relais de test via tunnel `wss://` | Essai réel du 26/10/2026 : reçu dans les deux sens et « Délivré » (`docs/tests/PROTOCOLE-SIMPLE-TELEPHONE.md`) ; réception différée réussie (message écrit hors réseau, parti au retour du réseau) ; **sans réseau : aucun échange** (Bluetooth non implémenté) |
| Android V0.3 | Bluetooth LE (maillage, relais 7 sauts, accusés) | 🔧 | JVM (3 nœuds simulés, dont un relais d'un autre groupe et un espion radio) | Expérimental, **jamais testé entre deux téléphones** ; depuis le 27/10, trames **scellées par la clé du groupe** (nom, clé, type invisibles hors du groupe ; vecteurs Python = Kotlin = TypeScript) (`docs/BLUETOOTH-V0.3.md`) |
| Android V0.2 | Signature de publication | 🔧 | Mac | Nouvelle clé hors dépôt, mot de passe dans le trousseau ; APK et AAB 0.2.1-beta signés et vérifiés (`CONTRE-AUDIT-ANDROID-V0.2.md` §6) |
| Android V0.2 | Bêta fermée Google Play | ⛔ | — | Non publiée : accord requis ; 12 testeurs × 14 jours si compte personnel ; textes de fiche à corriger |
| Relais | Résilience : redémarrage du relais, destinataire absent 3 min, absence de doublon | 🔧 | Code web réel contre la préproduction | 4/4 (`docs/tests/v0.3/relay-resilience-preprod.log`) ; consommation du 26/10 < 0,5 % des quotas gratuits |
| Android (branche Tor) | Mode Tor facultatif, désactivé par défaut, échec fermé | 🔧 | Émulateur Android 16 (APK signé 0.3.0-beta2-tor2) | Aucune connexion directe au relais en mode Tor (démarrage à froid, Tor bloqué par pare-feu avec relais joignable en direct) ; 8/8 à travers Tor (`docs/tests/v0.3/tor-emulateur.log`) ; branche séparée, PR #13 |
| Relais | Relais de référence Cloudflare (Workers + Durable Objects), adresse stable, boîte aux lettres persistante 24 h | 🔧 | Node (Mac) contre la préproduction (26/10) et la production (29/10) | `tools/audit/relay-conformance.ts` 13/13 (authentification, usurpation, clair refusé, courrier différé, accusés, débit, taille, délai, saturation, bout en bout) : `docs/tests/v0.3/relay-conformance-preprod.log` ; **production en ligne depuis le 29/10/2026** (`wss://meshora-relay.acousmaticregietools.workers.dev`, offre gratuite), 13/13 contre la production le 29/10 depuis un Mac (`docs/tests/v0.3/relais-production-2026-10-29.md`) ; aucun essai sur téléphone contre la production |
| Android V0.3 | Connexion automatique au relais de référence, invitations lien/QR, contacts vérifiés, discussions par personne, FR/EN, clé chiffrée par le magasin Android | 🔧 | JVM (Mac) + relais de référence réel ; **émulateur Android 16 (APK signé 0.3.0-beta2), 8/8** (`docs/tests/v0.3/emulateur/`) ; mise à jour 0.2.1 → beta2 sans perte d'identité | 29/29 tests dont échange réel Android ↔ web via le relais de référence (`docs/tests/v0.3/android-tests-interop-preprod.log`) ; APK 0.3.0-beta1 signé (nouvelle clé) ; **essai sur Pixel à faire** |
| Web V0.3 | Connexion automatique, groupe privé, invitation `#join=`, contact vérifié, bandeau « Ouvrir dans l'application » sur Android | 🔧 | Chrome × 2 (Mac) contre la prévisualisation `v0-3.meshora.pages.dev` | 5/5 en navigateurs réels (`docs/tests/v0.3/web-invite-e2e.log`) |
| Mesh natif | Trame, fragmentation, déduplication, relais TTL, limiteur | 🔧 | JVM | `MeshFrameTest` 5/5 (branche `claude/mesh-ble-prep`) ; aucune radio pilotée |
| Site | Pages Découvrir et Installer (FR/EN), schéma vérifié / en développement / futur | 🔧 | Chrome ordinateur 1280 px et mobile 390 px, thèmes clair et sombre | Prévisualisation `v0-3.meshora.pages.dev` : 121/121 (`docs/tests/v0.3/site-audit-v0-3.log`) ; avant : 120/120 vérifications (accessibilité axe WCAG 2.1 AA, liens, débordement, versions) ; **publié en production le 29/10/2026** (`meshora.pages.dev`, 0.3.0, mentions légales FR/EN) ; vérifié par requêtes HTTP (200, sans `noindex`), audit navigateur de la production à faire |
| Web V0.3 | Application web publiée sous `/app` (production), relais de production, lien vers le code source (AGPL-3.0) | 🔧 | Requêtes HTTP vers `meshora.pages.dev/app/` ; relais de production 13/13 depuis un Mac | Publiée le 29/10/2026 : CSP `connect-src` limitée au relais de production ; **aucun essai sur téléphone ni en navigateur réel contre la production** |
| — | Transport via les réseaux Find My / Find Hub | ❌ | — | NEARBY §1 |
| — | Bluetooth Mesh SIG, Wi-Fi Direct, Nearby Connections, I2P | ❌ | — | voir AUDIT |

Le prototype Google AI Studio met à jour la colonne « État » vers 🎭 pour ce qu'il simule, dans sa propre PR.
