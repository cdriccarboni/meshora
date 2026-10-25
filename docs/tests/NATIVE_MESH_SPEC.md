# Spécification Technique : Maillage Physique Sans Internet (Android ↔ iPhone)

| | |
|---|---|
| Date | 25 octobre 2026 |
| Statut | 📐 Spécification d'Ingénierie & Matrice de Vérité (Phase 0 / ADR-4 & ADR-7) |
| Responsable | Antigravity (Intégration & Architecture Réseau) |
| Objectif | Établir sans concession ce qui fonctionne en Web/PWA et ce qui exige un runtime natif |

---

## 1. Matrice de Vérité des Transports

| Transport | Navigateur Web / PWA | Android Natif | iPhone / iOS Natif | État MESHORA actuel |
|---|---|---|---|---|
| **Relais WebSocket Internet** | ✅ Oui (WSS) | ✅ Oui | ✅ Oui | **Opérationnel** (E2EE P-256 + AES-GCM validé) |
| **Wi-Fi Local (Même Box / Routeur)** | ✅ Oui (WS LAN) | ✅ Oui | ✅ Oui | **Opérationnel** (Relais Node sur LAN ou machine locale) |
| **BroadcastChannel** | ✅ Même navigateur | — | — | **Opérationnel** (Test local mono-appareil uniquement) |
| **Bluetooth LE Direct (Android ↔ Android)** | ❌ Impossible en PWA | ✅ Oui (Advertiser + GattServer) | — | 📐 Spécifié (Requiert APK Android) |
| **Bluetooth LE Direct (iPhone ↔ iPhone)** | ❌ Impossible en PWA | — | ✅ Oui (CoreBluetooth) | 📐 Spécifié (Requiert app iOS native) |
| **Bluetooth LE Croisé (Android ↔ iPhone)** | ❌ Impossible en PWA | ✅ Oui (GATT standard) | ✅ Oui (GATT standard) | 📐 Spécifié (Protocole GATT unifié ci-dessous) |
| **Wi-Fi Direct / Wi-Fi Aware (NAN)** | ❌ Impossible en PWA | ✅ Oui (Nearby API / NSD) | ❌ Propriétaire Apple (Multipeer) | 📐 Étude de faisabilité en cours |
| **Meshtastic / LoRa 868 MHz** | ⚠️ Web Serial (Chrome desktop) | ✅ Oui (USB OTG / BLE) | ✅ Oui (BLE compagnon natif) | 📐 Stub formel (Matériel externe requis) |

---

## 2. Pourquoi le Bluetooth Physique est Impossible dans un Navigateur

1. **Absence d'API d'annonce (Advertising) sur le Web :**
   L'API Web Bluetooth du W3C (disponible uniquement sur Chromium) ne supporte que le rôle **Central** (client scannant et se connectant à un périphérique existant). Aucun navigateur ne permet d'émettre des trames d'annonce BLE (`BluetoothLeAdvertiser` ou `CBPeripheralManager`). Deux smartphones sous navigateur ne peuvent donc pas se découvrir mutuellement.
2. **Refus catégorique d'Apple sur iOS :**
   Safari (sur iOS et iPadOS) ne supporte **aucunement** Web Bluetooth, par politique de sécurité et de confidentialité Apple.
3. **Mise en veille immédiate (Background execution) :**
   Une PWA en arrière-plan ou écran verrouillé voit ses scripts JS suspendus sous 5 à 30 secondes.

**Règle de vérité :** Toute affirmation prétendant qu'une application web ou PWA fait communiquer deux smartphones proches en Bluetooth physique sans Internet est techniquement fausse.

---

## 3. Architecture Native Unifiée (Kotlin / Swift / Rust)

Pour concrétiser le maillage physique hors-ligne sans Internet, l'architecture cible repose sur un noyau partagé et des adaptateurs d'accès matériel natifs :

```
┌────────────────────────────────────────────────────────┐
│           Interface Utilisateur (React / UI)           │
└───────────────────────────▲────────────────────────────┘
                            │ Bridge IPC / FFI
┌───────────────────────────┴────────────────────────────┐
│      Noyau Cryptographique & Routage Rust (UniFFI)     │
│   - Gestion des clés ECDSA P-256 & ECDH                │
│   - Chiffrement AES-GCM & Enveloppes                   │
│   - File d'attente persistante (Store-and-Forward)     │
│   - Table de routage & saut mesh (TTL, Anti-boucle)    │
└─────────────▲────────────────────────────▲─────────────┘
              │                            │
┌─────────────┴──────────────┐┌────────────┴─────────────┐
│       Android Natif        ││        iOS Natif         │
│  - BluetoothLeScanner      ││  - CBCentralManager      │
│  - BluetoothLeAdvertiser   ││  - CBPeripheralManager   │
│  - BluetoothGattServer     ││  - Background Processing │
│  - Foreground Service      ││  - AccessorySetupKit     │
└────────────────────────────┘└──────────────────────────┘
```

---

## 4. Spécification du Profil GATT Unifié MESHORA

Pour permettre à un Android et un iPhone de s'interconnecter en direct :

- **Service UUID MESHORA :** `0000FE60-0000-1000-8000-00805F9B34FB` (16-bit court `0xFE60` en publicité).
- **Caractéristique Packet TX/RX (Write Without Response) :**
  - UUID : `0000FE61-0000-1000-8000-00805F9B34FB`
  - Propriétés : `Write Without Response`, `Read`
  - MTU négocié : 512 octets (fallback 23 octets avec fragmentation).
  - Charge utile : Enveloppe chiffrée E2EE binaire (ID message, Clé éphémère, IV, Données chiffrées, Signature).
- **Caractéristique ACK & Statut (Notify) :**
  - UUID : `0000FE62-0000-1000-8000-00805F9B34FB`
  - Propriétés : `Notify`, `Indicate`
  - Charge utile : Accusé de réception signé (`SignedAck`).

### Gestion de l'Arrière-Plan sur iOS
Sur iOS, `CBPeripheralManager` en arrière-plan ne diffuse pas son nom local et place le Service UUID dans l'overflow area (nécessite un scan ciblé explicite côté Android avec filtre sur le Service UUID exact).

### Gestion de l'Arrière-Plan sur Android
Sous Android 14+, l'application requiert un `ForegroundService` avec type `connectedDevice` et notification persistante discrète : « MESHORA : Veille du réseau maillé de proximité active ».

---

## 5. Protocole d'Essai Matériel Requis (Avant Toute Affirmation de Succès)

Le critère M1 et l'essai E2 ne seront déclarés validés que sous les conditions expérimentales strictes suivantes :

1. **Deux appareils physiques :** 1 appareil Android (ex: Pixel) et 1 appareil iOS (ex: iPhone).
2. **Coupure totale d'infrastructure :** Mode avion activé sur les deux téléphones (Wi-Fi coupé, données mobiles 4G/5G coupées, aucun routeur à portée).
3. **Émission d'un paquet chiffré depuis A vers B :**
   - A détecte B par scan GATT de proximité.
   - B reçoit le paquet, allume l'écran ou notifie l'utilisateur.
   - B transmet l'accusé de réception signé via la caractéristique Notify.
   - A enregistre la réception de l'accusé et passe l'état de `sent` à `delivered`.
4. **Mesure de portée et d'atténuation :**
   - Test à 2 mètres (champ libre).
   - Test à 10 mètres (à travers une cloison).
   - Mesure de la perte de paquets et de la décharge batterie sur 1 heure de veille.
