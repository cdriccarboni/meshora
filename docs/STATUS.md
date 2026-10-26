# MESHORA — État réel des fonctionnalités

> Source de vérité sur ce qui **fonctionne réellement**. Mis à jour par pull request uniquement.
> Une fonction ne passe en « ✅ Testée » qu'avec un lien vers un rapport dans `docs/tests/` (appareils, versions d'OS, version de l'app, données brutes).

Légende : ⛔ Bloquée pour publication · ⬜ Non commencée · 📐 Spécifiée · 🎭 Simulée dans le prototype (aucun réseau réel) · 🔧 Implémentée, non testée sur appareils · ✅ Testée sur appareils physiques · ❌ Écartée

**État au 26 octobre 2026 : une seule fonction est testée sur appareil physique, l'échange chiffré Android ↔ web via un relais Internet de test (Pixel ↔ Mac). Tout le reste est spécifié, simulé ou testé sur ordinateur seulement.** (Mention historique du 25 octobre : aucune fonction n'était testée sur appareil. Tout ce qui existe est spécifié ou simulé.** Contre-audit et corrections (branche `validation/v0.2-contre-audit`) : `docs/audits/CONTRE-AUDIT-V0.2.md` ; messagerie vérifiée entre navigateurs **sur une seule machine**, pas entre appareils. Audit du prototype V0.2 : `docs/audits/AUDIT-PR3-V0.2.md` (8 P0, 12 P1 ; 0 critère sur 18 de messagerie opérationnelle rempli).

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
| Android V0.2 | Échange chiffré Android ↔ web via relais Internet (accusés signés v2) | ✅ | Google Pixel (Wi-Fi et 5G) ↔ Mac M4 (navigateur), relais de test via tunnel `wss://` | Essai réel du 26/10/2026 : reçu dans les deux sens et « Délivré » (`docs/tests/PROTOCOLE-SIMPLE-TELEPHONE.md`) ; réception différée à essayer ; **sans réseau : aucun échange** (Bluetooth non implémenté) |
| Android V0.2 | Bluetooth LE | ⬜ | — | Aucun appel BLE implémenté (affichage corrigé) |
| Android V0.2 | Signature de publication | 🔧 | Mac | Nouvelle clé hors dépôt, mot de passe dans le trousseau ; APK et AAB 0.2.1-beta signés et vérifiés (`CONTRE-AUDIT-ANDROID-V0.2.md` §6) |
| Android V0.2 | Bêta fermée Google Play | ⛔ | — | Non publiée : accord requis ; 12 testeurs × 14 jours si compte personnel ; textes de fiche à corriger |
| Mesh natif | Trame, fragmentation, déduplication, relais TTL, limiteur | 🔧 | JVM | `MeshFrameTest` 5/5 (branche `claude/mesh-ble-prep`) ; aucune radio pilotée |
| — | Transport via les réseaux Find My / Find Hub | ❌ | — | NEARBY §1 |
| — | Bluetooth Mesh SIG, Wi-Fi Direct, Nearby Connections, I2P | ❌ | — | voir AUDIT |

Le prototype Google AI Studio met à jour la colonne « État » vers 🎭 pour ce qu'il simule, dans sa propre PR.
