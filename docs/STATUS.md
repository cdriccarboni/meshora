# MESHORA — État réel des fonctionnalités

> Source de vérité sur ce qui **fonctionne réellement**. Mis à jour par pull request uniquement.
> Une fonction ne passe en « ✅ Testée » qu'avec un lien vers un rapport dans `docs/tests/` (appareils, versions d'OS, version de l'app, données brutes).

Légende : ⛔ Bloquée pour publication · ⬜ Non commencée · 📐 Spécifiée · 🎭 Simulée dans le prototype (aucun réseau réel) · 🔧 Implémentée, non testée sur appareils · ✅ Testée sur appareils physiques · ❌ Écartée

**État au 25 octobre 2026 : aucune fonction n'est testée sur appareil. Tout ce qui existe est spécifié ou simulé.** Audit du prototype V0.2 : `docs/audits/AUDIT-PR3-V0.2.md` (8 P0, 12 P1 ; 0 critère sur 18 de messagerie opérationnelle rempli).

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
| Prototype V0.2 | Messagerie entre onglets d'un même navigateur (BroadcastChannel) | 🔧 | — | Fonctionne entre onglets seulement ; statut « Délivré » faux (audit PR #3, P0-3) |
| Prototype V0.2 | Relais WebSocket | ⛔ | — | Aucun serveur ; « disponible » et « envoyé » toujours vrais (audit PR #3, P0-3, P1-1) |
| Prototype V0.2 | File d'attente hors ligne | ⛔ | — | `localStorage` seulement ; messages retirés de la file sans accusé (audit PR #3, P0-4) |
| Prototype V0.2 | VPN (WireGuard, VpnService, NEPacketTunnelProvider) | 🎭 | — | Interfaces factices « nécessite un module natif » |
| Prototype V0.2 | Cartes et repères hors ligne | 🔧 | — | Annoncé, non vérifié |
| Prototype V0.2 | Diffusion d'urgence / SOS | ⛔ | — | Bloqué pour publication (COORDINATION §5, A1 ; audit PR #3, P0-1) |
| Prototype V0.2 | Signatures, « vérifié », chiffrement | ⛔ | — | Fabriqués (`Math.random`), aucune cryptographie (audit PR #3, P0-2, P0-5) |
| — | Transport via les réseaux Find My / Find Hub | ❌ | — | NEARBY §1 |
| — | Bluetooth Mesh SIG, Wi-Fi Direct, Nearby Connections, I2P | ❌ | — | voir AUDIT |

Le prototype Google AI Studio met à jour la colonne « État » vers 🎭 pour ce qu'il simule, dans sa propre PR.
