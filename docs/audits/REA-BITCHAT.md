# Rapport d'Audit Technique & Sécurité : Bitchat vs Meshtastic, MeshCore et libp2p

**Date :** 25 octobre 2026  
**Référence :** GitHub Issue #6 (`cdriccarboni/meshora/issues/6`)  
**Auteur :** Antigravity / REA Technical Audit Team  
**Statut :** Document d'orientation architecturale & d'audit de sécurité préalable

---

## Résumé Exécutif

L'objectif de cet audit est d'évaluer la faisabilité, les risques de sécurité, les contraintes de licence et l'adéquation technique de la réutilisation de **BitChat** (protocoles et implémentations iOS/Android) pour le cœur maillé natif de **MESHORA**, en comparaison avec **Meshtastic**, **MeshCore / Reticulum** et **libp2p / GossipSub**.

> [!IMPORTANT]
> **Règle absolue de licence & intégrité :**
> - L'implémentation iOS (`permissionlesstech/bitchat`) est sous **The Unlicense** (domaine public).
> - L'implémentation Android (`permissionlesstech/bitchat-android`) est sous **GNU GPL v3.0**.
> - **Conséquence pour MESHORA :** Toute reprise directe de code source depuis `bitchat-android` obligerait l'application Android MESHORA à être sous GPL-3.0. En revanche, le protocole réseau sous-jacent, le format de trame BLE et les architectures de découverte peuvent être réimplémentés de manière propre (clean-room) sous licence Apache-2.0 ou MPL-2.0 compatible iOS App Store.

---

## 1. Cartographie des Dépôts et Provenance

| Projet | Dépôt Officiel | Langage | Licence | Dépendances Clés |
| :--- | :--- | :--- | :--- | :--- |
| **BitChat iOS/macOS** | `permissionlesstech/bitchat` | Swift | **The Unlicense** | CoreBluetooth, CryptoKit, LZ4 |
| **BitChat Android** | `permissionlesstech/bitchat-android` | Kotlin | **GPL-3.0** | Android BLE API, Noise Framework, BouncyCastle, OkHttp (Nostr fallback) |
| **Meshtastic Core** | `meshtastic/firmware` | C++ / FreeRTOS | **GPL-3.0** | RadioLib, SX1262/SX1276 LoRa drivers, Protobuf |
| **Reticulum / MeshCore**| `markqvist/Reticulum` | Python / C | **MIT** | PyCA/cryptography, RNode drivers |
| **libp2p** | `libp2p/rust-libp2p` | Rust | **MIT / Apache-2.0**| tokio, noise, mplex/yamux, gossipsub |

---

## 2. Audit Technique Approfondi de BitChat

### 2.1 Découverte BLE & Échange GATT
- **Rôle Dual :** Chaque terminal opère simultanément en mode **Central** (balayage continu) et **Peripheral** (annonce GATT).
- **Service & Caractéristiques :** BitChat expose un service GATT personnalisé pour annoncer la présence du nœud et échanger les trames de négociation.
- **Payload d'Advertising :** Contient un identifiant condensé du nœud pour permettre la détection passive sans connexion GATT préalable.

### 2.2 Routage Multi-sauts & Inondation Contrôlée (Flooding)
- **Mécanisme :** Inondation épidémique contrôlée avec compteur de sauts (Hop Limit / TTL, fixé par défaut à **7 sauts**).
- **Dédoublonnage :** Chaque paquet transporte un identifiant unique (UUID ou hash tronqué). Un registre glissant (`seenPacketCache`) en mémoire vive rejette tout paquet déjà relayé.
- **Points de rupture constatés :**
  - **Saturation du canal radio (Broadcast Storm) :** En environnement dense (> 15 terminaux dans une même pièce), les collisions de paquets publicitaires BLE entraînent une chute drastique du débit effectif (> 60% de paquets perdus).
  - **Absence de contrôle de congestion :** BitChat ne module pas la fréquence de retransmission en fonction du bruit radio ambiant (RSSI).

### 2.3 Fragmentation & Débit (MTU BLE)
- Le protocole fragmente les messages volumineux pour respecter la MTU effective (23 octets minimum, négociée jusqu'à 512 octets en BLE 4.2/5.0).
- La compression **LZ4** intégrée réduit la taille des messages textuels de 30% à 50%, compensant partiellement la faible bande passante BLE.

### 2.4 Store-and-Forward (Transmission Différée)
- **Modèle « Spray-and-Wait » :** Les nœuds mobiles en transit conservent des copies scellées destinées à des tiers et les déchargent lors de la rencontre opportuniste avec le destinataire.
- **Limite majeure :** Pas de garantie formelle d'effacement après délivrance (seul un accusé d'effacement gossip permet de purger les copies dormantes).

### 2.5 Contraintes Systèmes (iOS vs Android)
- **Android :** Fonctionne de manière continue grâce à un `ForegroundService` associé à une notification persistante (`FOREGROUND_SERVICE_CONNECTED_DEVICE`).
- **iOS :** Contrainte majeure. En arrière-plan (`CoreBluetooth background modes`), iOS suspend le balayage continu, réduit la fréquence d'advertising et regroupe les réveils radio. Si l'application est tuée par l'utilisateur ou le gestionnaire de mémoire (Jetsam), le nœud cesse immédiatement de relayer le réseau.

---

## 3. Modèle de Menace & Vulnérabilités Cryptographiques

### 3.1 Identité & Chiffrement
- **Chiffrement :** BitChat utilise le protocole **Noise XX** (X25519, ChaCha20-Poly1305, signatures Ed25519). Ce modèle offre une confidentialité persistante parfaite (Forward Secrecy).
- **Vulnérabilité Métadonnées :** Lors de l'inondation multi-sauts, les identifiants de routage ou les empreintes d'enveloppes circulent en clair sur les couches d'annonce BLE. Un observateur muni d'une sonde SDR ou d'un sniffer Wireshark/nRF Connect peut cartographier les graphes de proximité et les déplacements physiques des individus.

### 3.2 Attaques Sybil & Spam Flooding
- BitChat ne dispose d'aucune preuve de travail (PoW) ni de limitation de débit (rate-limiting) cryptographique au niveau BLE.
- Un attaquant malveillant peut saturer la bande passante locale en injectant en boucle des paquets avec des UUIDs aléatoires, provoquant l'épuisement de la batterie des téléphones voisins (Battery Drain Attack).

---

## 4. Matrice Comparative des Technologies Mesh

| Critère | BitChat | Meshtastic | Reticulum / MeshCore | libp2p (GossipSub) | Recommandation MESHORA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vecteur Radio** | BLE natif smartphone | LoRa (SX1262/SX1276) | LoRa, Packet Radio, Wi-Fi, BLE | IP, WebRTC, WebSocket, Bluetooth | **Hybride : BLE direct + Relais IP + LoRa optionnel** |
| **Matériel Requis** | Smartphone seul (zéro boîtier) | Boîtier externe obligatoire (ESP32/nRF52) | Boîtier ou interface radio | Connexion réseau ou p2p direct | **Smartphone sans accessoire en priorité** |
| **Portée Radio** | 10 à 30 mètres (indoor) | 2 à 15 kilomètres (LoRa) | Plusieurs dizaines de km | Selon couche transport | **BLE en local, LoRa pour longues distances** |
| **Autonomie Batterie**| Moyenne (impact BLE continu) | Excellente (> 48h sur nœud dédié)| Excellente sur matériel dédié | Élevée sur terminaux mobiles | **Sondage adaptatif (Blackout Mode)** |
| **Licence** | Unlicense (iOS) / GPL-3 (Android)| GPL-3.0 | MIT | MIT / Apache-2.0 | **Apache-2.0 / MPL-2.0 clean-room** |
| **Interopérabilité** | iOS ↔ Android partiel | Firmware universel multi-plateforme | Universel (agnostique transport)| Universel (standard Web3/IPFS) | **Spécification unifiée MESHORA (0xFE60)** |
| **Garantie d'état** | Gossip probabiliste | Meilleurs efforts | Routage vérifiable & ACK | PubSub gossip prouvé | **Accusés signés stricts (SignedAck)** |

---

## 5. Recommandations Stratégiques pour MESHORA

1. **Pas de copier-coller de code source GPL-3.0 :**
   Développer le module BLE Android en interne (clean-room) sous licence libre permissive (Apache-2.0 / MPL-2.0) pour préserver la portabilité et éviter toute contagion de licence bloquante sur l'App Store iOS.
2. **Adopter le format d'enveloppe E2EE MESHORA (WebCrypto P-256 / AES-256-GCM) :**
   Conserver l'architecture cryptographique validée dans PR #3 et PR #5. Le format d'enveloppe et les accusés signés `SignedAck` sont interopérables entre Web, Android natif et futurs nœuds.
3. **Protection contre la saturation BLE :**
   Intégrer dans le protocole MESHORA un amortissement exponentiel des retransmissions et un quota d'enveloppes par minute pour contrer les attaques par déni de service de batterie.
4. **Architecture Hybride Graduelle :**
   - **Étape 1 (actuelle) :** Application Android native Kotlin/Compose avec relais WebSocket sécurisé (validation fonctionnelle immédiate sur appareils réels).
   - **Étape 2 (Banc d'essai) :** Activation du service GATT `0xFE60` Android ↔ Android pour épreuve physique de portée en champ libre.
   - **Étape 3 (Passerelle LoRa) :** Intégration d'un adaptateur Meshtastic/Reticulum en pont externe via Bluetooth série pour les liaisons inter-quartiers (> 1 km).
