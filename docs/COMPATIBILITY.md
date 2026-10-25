# MESHORA — Matrice de compatibilité

> Version 0.1 — 25 octobre 2026.
> Légende : ✅ documenté par une source fiable · 🟡 possible avec limites connues · 🧪 **non prouvé, test obligatoire** · ❌ impossible ou exclu.
> **Aucune case 🧪 ne peut passer en ✅ sans un rapport de test archivé** (voir `ROADMAP.md`, plan de tests).

## 1. Appareils × transports

| Appareil | BLE GATT central | BLE GATT périphérique | BLE en arrière-plan | LAN mDNS/TCP | Wi-Fi Aware | Multipeer | Radio compagnon LoRa | Relais app fermée |
|---|---|---|---|---|---|---|---|---|
| iPhone (iOS 17+) | ✅ | ✅ | 🟡 UUID ciblés, scan bridé, nom effacé | ✅ | 🟡 iOS 26, iPhone 12+, appairage PIN, capacité gérée | ✅ Apple seulement | ✅ (apps Meshtastic/MeshCore existent) | ❌ après fermeture par l'utilisateur |
| iPad | ✅ | ✅ | 🟡 idem iPhone | ✅ | 🟡 modèles listés par Apple | ✅ | ✅ | ❌ |
| Android 10+ | ✅ | ✅ (selon puce) | ✅ avec service au premier plan + notification | ✅ | 🟡 selon matériel | ❌ | ✅ | ✅ service au premier plan (sauf surcouches constructeur agressives 🧪) |
| macOS | ✅ | ✅ | ✅ (app non suspendue) | ✅ | ❌ | ✅ | ✅ USB/BLE | ✅ si démon lancé |
| Windows 10/11 | ✅ | 🧪 serveur GATT limité selon adaptateur | ✅ | ✅ | ❌ (non retenu) | ❌ | ✅ USB | ✅ |
| Linux (BlueZ) | ✅ | ✅ | ✅ | ✅ | 🧪 | ❌ | ✅ | ✅ |
| Raspberry Pi 4/5 | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ HAT LoRa / RNode / USB | ✅ rôle passerelle |
| Apple Watch | 🟡 | ❌ | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ — terminal via iPhone |
| Wear OS | 🟡 | 🧪 | 🧪 | 🟡 | 🧪 | ❌ | ❌ | 🧪 |
| ESP32 (S3/C6) | ✅ | ✅ | n/a | ✅ | 🧪 (ESP-IDF 6.1 expérimental) | ❌ | ✅ intégré (cartes LoRa) | ✅ relais fixe |
| nRF52 (RAK4631…) | ✅ | ✅ | n/a | ❌ | ❌ | ❌ | ✅ | ✅ relais fixe basse conso |

## 2. Paires d'appareils (le cœur de la promesse)

| Paire | Premier plan des deux côtés | Un côté en arrière-plan | Les deux en arrière-plan | Écran verrouillé, poche, 1 h |
|---|---|---|---|---|
| Android ↔ Android | ✅ | ✅ (service) | ✅ (service) | 🧪 surcouches constructeur |
| iPhone ↔ iPhone | ✅ | 🟡 | 🧪 | 🧪 |
| **Android ↔ iPhone** | ✅ (Bitchat v1.1.1+) | 🧪 **critique** | 🧪 **critique** | 🧪 **critique** |
| iPhone ↔ relais fixe ESP32/Pi | ✅ | 🟡 si connexion déjà établie | 🧪 | 🧪 |
| Téléphone ↔ radio LoRa compagnon | ✅ | 🟡 | 🟡 | 🧪 |

## 3. Protocoles × MESHORA

| Protocole externe | Mode d'intégration | Sens | Phase | Remarques |
|---|---|---|---|---|
| Bitchat (BLE) | Adaptateur natif, compatibilité filaire à évaluer | ↔ | MVP (test E3) | Licences Unlicense/MIT |
| Meshtastic | Pilotage d'une radio via API protobuf | ↔ texte court | Bêta | Canaux Meshtastic ≠ chiffrement MESHORA : l'enveloppe MESHORA voyage chiffrée dans la charge |
| MeshCore | Firmware compagnon BLE/USB | ↔ texte court | Bêta | MIT |
| Reticulum / LXMF | Démon sur passerelle | ↔ | Stable | Licence du démon à choisir (Reticulum-rs MIT vs forks AGPL) |
| Nostr | Client dans le cœur | ↔ | MVP | NIP-17/44/59 |
| Mastodon (ActivityPub) | Publication via API, jeton délégué | → (← mentions en bêta) | Bêta | |
| Bluesky (AT Protocol) | Publication via API, jeton délégué | → | Bêta | |
| Thread / Matter | Hors périmètre | — | — | Via Home Assistant éventuellement |
| ESP-NOW | Entre relais ESP32 d'un même site | ↔ | Stable | |

## 4. MESHORA Nearby (découverte privée)

| Fonction | iPhone | Android | macOS | Windows | Linux / Pi | ESP32 / nRF52 |
|---|---|---|---|---|---|---|
| Annonce avec identifiant tournant dans les données de service | ❌ données de service interdites aux apps [C] → lecture GATT | ✅ | ✅ | 🧪 | ✅ | ✅ |
| Reconnaissance d'un contact au premier plan | 🧪 (N2) | 🧪 (N2) | 🧪 | 🧪 | 🧪 | n/a |
| Reconnaissance en arrière-plan | 🧪 **critique** (N3, N4) | 🟡 service au premier plan | ✅ | 🧪 | ✅ | ✅ |
| Appairage d'un relais par sélecteur système | 🟡 AccessorySetupKit (iOS 18 et ultérieur) [C] | 🟡 CompanionDeviceManager [C] | ❌ | ❌ | ❌ | (côté relais) |
| Appairage par proximité, comme des écouteurs | 🟡 UE seulement, iOS 26.5 et ultérieur, compte organisation [S] | 🟡 Fast Pair = programme partenaire [S] | ❌ | ❌ | ❌ | (côté relais) |
| Ajout de contact par NFC | 🟡 lecture de tag seulement [C] | ✅ [C] | ❌ | ❌ | ❌ | ❌ |
| Distance et direction (UWB) | 🟡 modèles UWB, Nearby Interaction [C] | 🟡 rares modèles [C] | ❌ | ❌ | ❌ | ❌ |
| Réseaux Find My / Find Hub pour transporter des messages | ❌ aucune API, exclu | ❌ aucune API, exclu [S] | ❌ | ❌ | ❌ | ❌ |

## 5. Contraintes réglementaires et physiques

| Sujet | Contrainte | Conséquence |
|---|---|---|
| LoRa 868 MHz (UE) | Rapport cyclique ~1 % sur la plupart des sous-bandes [C, ETSI EN 300 220 à citer] | Texte court uniquement ; pas de relais d'images |
| Bandes amateur | Chiffrement souvent interdit [S] | MESHORA n'utilise que les bandes ISM |
| Export du chiffrement | Déclaration App Store [C] | À remplir avant soumission |
| Retrait par pays | Précédent Bitchat / Chine (avril 2026) [S] | Distribution alternative (APK, F-Droid, AltStore UE) à prévoir |
