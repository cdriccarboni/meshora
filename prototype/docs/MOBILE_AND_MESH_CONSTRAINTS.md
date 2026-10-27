# Contraintes Mobiles & Réseaux Maillés (Android vs iOS vs PWA Web)

Ce document établit la distinction technique indispensable entre les trois modes d'exécution de MESHORA.

---

## 1. La Matrice des Capacités

| Capacité Technique | PWA Web (Navigateur) | Application Native Android | Application Native iOS (iPhone) |
| :--- | :---: | :---: | :---: |
| **Messagerie locale même réseau Wi-Fi** | ✅ Oui (BroadcastChannel & WebSocket) | ✅ Oui | ✅ Oui |
| **Persistance hors ligne des messages** | ✅ Oui (IndexedDB / Cache API) | ✅ Oui (SQLite / Room) | ✅ Oui (SwiftData / CoreData) |
| **Installation écran d'accueil sans store** | ✅ Oui (Manifest PWA) | ✅ Oui (PWA ou APK) | ⚠️ Oui (Manuel via Partage Safari) |
| **Tunnel VPN complet au niveau système** | ❌ Impossible en PWA sandbox | ✅ Oui (`android.net.VpnService`) | ✅ Oui (`NEPacketTunnelProvider`) |
| **Scan & Connexion Bluetooth LE continu** | ⚠️ Web Bluetooth limité (geste utilisateur requis) | ✅ Oui (Foreground Service & BLE) | ⚠️ Limité (Règles strictes CoreBluetooth en tâche de fond) |
| **Mesh Wi-Fi Direct / Wi-Fi Aware sans AP** | ❌ Impossible en Web standard | ✅ Oui (`WifiP2pManager`) | ❌ Verrouillé (MultipeerConnectivity uniquement Apple) |
| **Exécution permanente en arrière-plan** | ❌ Suspendu si onglet inactif | ✅ Oui (Service de premier plan avec notification) | ❌ Suspendu après quelques minutes (sauf VoIP/Audio) |
| **Support direct interface USB/Série (LoRa/Meshtastic)** | ⚠️ Web Serial (Chrome desktop/Android uniquement) | ✅ Oui (USB OTG standard) | ❌ Non supporté directement sur iOS |

---

## 2. Recommandations d'Implémentation pour les Développeurs

1. **Pour le Web et le prototype v0.1** :
   - Exploiter le transport universel `BroadcastChannel` pour tester instantanément entre fenêtres sur une même machine.
   - Exploiter le relais local WebSocket pour les échanges entre deux téléphones ou ordinateurs connectés au même réseau Wi-Fi local.
   - Isoler les interfaces matérielles dans des adaptateurs typés `ITransportAdapter` capables de passer de façon transparente d'un stub simulé à un pont natif (`Capacitor`, `React Native`, ou `Kotlin/Swift`).

2. **Pour les futurs modules natifs Android** :
   - Développer un `ForegroundService` dédié au routage mesh pour éviter l'arrêt du processus par le système de gestion de batterie Android (Doze Mode).
   - Intégrer la bibliothèque officielle WireGuard Android (`com.wireguard.android:tunnel`).

3. **Pour les futurs modules natifs iOS** :
   - Développer une extension d'application `NetworkExtension` de type `NEPacketTunnelProvider` pour WireGuard.
   - Gérer le protocole de signalisation Bluetooth via `CBCentralManager` avec restauration d'état `CBCentralManagerOptionRestoreIdentifierKey`.
