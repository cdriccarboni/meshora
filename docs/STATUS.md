# MESHORA — État réel des fonctionnalités

> Source de vérité sur ce qui **fonctionne réellement**. Mis à jour par pull request uniquement.
> Une fonction ne passe en « ✅ Testée » qu'avec un lien vers un rapport dans `docs/tests/` (appareils, versions d'OS, version de l'app, données brutes).

Légende : ⬜ Non commencée · 📐 Spécifiée · 🎭 Simulée dans le prototype (aucun réseau réel) · 🔧 Implémentée, non testée sur appareils · ✅ Testée sur appareils physiques · ❌ Écartée

**État au 25 octobre 2026 : aucune fonction n'est testée sur appareil. Tout ce qui existe est spécifié ou simulé.**

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
| — | Bluetooth Mesh SIG, Wi-Fi Direct, Nearby Connections, I2P | ❌ | — | voir AUDIT |

Le prototype Google AI Studio met à jour la colonne « État » vers 🎭 pour ce qu'il simule, dans sa propre PR.
