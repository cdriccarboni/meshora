# MESHORA V.0.2

> **« Un réseau qui relie les autres. »**  
> *A network that links the others.*

MESHORA est une application libre, décentralisée et multiplateforme conçue pour communiquer à travers les différents réseaux disponibles. Plutôt que d'imposer un nouveau protocole propriétaire ou d'inventer une connectivité magique dans le navigateur, MESHORA s'appuie sur les technologies existantes et offre une architecture modulaire et adaptative.

---

## 🌟 Les Quatre Piliers MESHORA

1. **MESHORA Mesh** — Communiquer localement de pair à pair (réseau local Wi-Fi/LAN en direct, BroadcastChannel inter-onglets, et adaptateurs modulaires pour Bluetooth LE, Meshtastic LoRa et Reticulum).
2. **MESHORA Connect** — Tirer parti opportuniste des connexions et passerelles disponibles (accès Internet, nœuds relais, et passerelles décentralisées Nostr, Bluesky, Mastodon).
3. **MESHORA Shield** — Protéger les communications grâce à une politique stricte de vérité : activation volontaire de VPN (WireGuard, tunnels natifs Android/iOS), surveillance des fuites et aucune fausse promesse de sécurité.
4. **MESHORA Resilience** — Assurer la continuité intelligente de service : détection automatique des pertes de connexion, basculement vers transports autorisés avec consentement explicite pour toute passerelle inconnue, conservation des messages hors ligne avec zéro perte, fiches/cartes d'urgence en cache, transfert P2P de fichiers, et mode économie de batterie.

---

## 🎨 Identité Visuelle

- **Minimalisme élégant, technologique, accessible et rassurant.**
- Logo orbital monochrome symbolisant les nœuds et relais interconnectés.
- Palette sobre : blanc pur, graphite profond (`#121316`), et bleu doux (`#3b82f6` / `#60a5fa`).
- Bilingue natif Français / English avec bascule en un clic.
- **Principe fondamental :** Aucune esthétique militaire, survivaliste, agressive ou anxiogène. La résilience est conçue comme un confort quotidien de continuité.

---

## 📱 PWA & Compatibilité Mobile (Android & iOS)

MESHORA fonctionne immédiatement en **Progressive Web App (PWA)** installable sur mobile et bureau. Une distinction technique stricte est documentée dans `docs/MOBILE_AND_MESH_CONSTRAINTS.md` :

- **PWA Web** : messagerie locale instantanée via `BroadcastChannel` et relais local WebSocket, stockage hors-ligne IndexedDB, file d'attente d'envoi persistante.
- **Application native Android** : requise pour le scan Bluetooth LE continu en arrière-plan, Wi-Fi Aware / Wi-Fi Direct, et le VPN via l'API système `VpnService`.
- **Application native iPhone (iOS)** : requise pour les extensions réseau `NEPacketTunnelProvider`, les règles strictes de WebKit PWA en tâche de fond, et le profil CoreBluetooth.

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js >= 18
- npm

### Installation & Lancement
```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement (port 3000)
npm run dev

# Exécution des tests automatisés
npm run test # ou via l'interface interactive de test intégrée
```

---

## 🛡️ Règles de Sécurité

- **Zéro secret dans le code.**
- **Vérité de sécurité** : Ne jamais afficher "VPN actif" ou "Chiffré de bout en bout" sans poignée de main cryptographique validée.
- **Consentement préalable** : Aucun basculement vers une passerelle tierce sans confirmation explicite.
- **Zéro perte silencieuse** : Tout message envoyé hors-ligne est sécurisé localement dans la file d'attente Outbox jusqu'à acquittement.
- **Respect de la vie privée** : Aucune donnée envoyée à un tiers ou service IA externe.

---

## 📄 Licence

Ce projet est sous licence **GNU Affero General Public License v3.0 (AGPL-3.0)**. Consultez le fichier [LICENSE](./LICENSE) pour plus de détails.
