# Maillage natif V0.3 — préparation Bluetooth LE et Wi-Fi pair-à-pair

> Statut : **préparation**. Le format de trame, la fragmentation, la déduplication, la politique de relais et le limiteur de débit existent en Kotlin pur, testés sur JVM (`android/app/src/main/java/org/meshora/app/mesh/`, `MeshFrameTest` 5/5). **Aucune radio n'est encore pilotée.** Rien ici n'est à présenter comme fonctionnel avant les essais physiques du §6.

## 1. Principes retenus (issus des faits vérifiés de l'audit Bitchat)

| Constat vérifié chez Bitchat (whitepaper) | Choix MESHORA |
|---|---|
| Identifiant de pair de 8 octets **non rotatif**, voisins directs annoncés en clair → traçage physique | Identifiant d'annonce **tournant** (dérivé par contact, voir `docs/NEARBY.md`, k_beacon) ; **aucune** liste de voisins annoncée |
| TTL 7, plafonné à 5 quand ≥ 6 voisins | Repris : `MeshFrame.MAX_TTL = 7`, `DENSE_TTL = 5`, `RelayPolicy.DENSE_NEIGHBOURS = 6` |
| Fragments ≈ 469 octets, réassemblage 30 s, 1 Mio max | Fragmentation selon la MTU négociée ; réassemblage 30 s, **64 Kio** max, 64 simultanés, messages abandonnés ignorés jusqu'à expiration |
| Courrier différé sans confidentialité persistante | Courrier différé BLE **désactivé** tant que des clés de pré-session (prekeys) n'existent pas |
| Taille des messages observable (rembourrage partiel) | Rembourrage des enveloppes par paliers (256/512/1024/2048) avant fragmentation — à implémenter |
| Limites de débit et quotas présents | Seau à jetons par pair (`PeerRateLimiter`), déduplication bornée (`DedupCache`) |
| Code Android sous GPL-3.0 | **Aucune reprise de code** ; seuls les paramètres publiés sont réutilisés |

## 2. Identifiants radio

Service GATT `120689f9-ed0b-4ef8-a491-cc457d12b459`, écriture `8168e5af-7c92-4c8a-a685-a33a570a1a83`, notification `e156230b-847c-42a1-a71c-d05348a61451` (`mesh/MeshIds.kt`). Ils remplacent `0xFE60/61/62`, plage réservée aux membres du Bluetooth SIG.

## 3. Trame (`mesh/MeshFrame.kt`)

`version(1) type(1) ttl(1) flags(1) messageId(16) fragIndex(2) fragCount(2) length(2) payload` — 26 octets d'en-tête, gros-boutiste. Types : `ENVELOPE` (enveloppe chiffrée et signée de `docs/PROTOCOLE-V0.2.md`), `ACK` (accusé signé), `ANNOUNCE` (à définir avec l'identifiant tournant). Le décodeur rejette toute entrée invalide sans exception (2 000 entrées aléatoires testées). La trame n'est pas signée ; son contenu l'est, et le TTL reste modifiable par les relais.

## 4. Architecture Android

```
BleLink (central + périphérique) ─┐
WifiP2pLink (débit, voix)  ───────┼─► MeshRouter : Reassembler → RelayPolicy → TransportManager (déchiffrement, accusés)
WebSocketTransport (Internet) ────┘                       └─► relais des copies (TTL−1) vers les autres liens
```

| Brique | Rôle | Contraintes Android (documentation officielle, **non vérifiées sur appareil**) |
|---|---|---|
| `BleLink` | Annonce + balayage filtré sur le service, connexion GATT, écriture/notification de trames | Permissions `BLUETOOTH_SCAN` (`neverForLocation`), `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT` (API 31+) ; balayages limités (environ 5 démarrages par 30 s) ; balayage écran éteint seulement avec filtre ; annonce classique limitée à 31 octets ; MTU négociable jusqu'à 517 ; nombre de connexions GATT simultanées limité selon le matériel |
| Service de premier plan | Maintenir le maillage écran éteint | Type `connectedDevice` (API 34+) avec déclaration Play ; notification permanente ; Doze et économiseurs constructeurs à mesurer |
| `WifiP2pLink` | Fichiers, voix | `NEARBY_WIFI_DEVICES` (API 33+) ; la formation de groupe Wi-Fi Direct demande souvent une confirmation à l'écran ; pas d'interopérabilité avec iOS |
| Wi-Fi Aware | Découverte et liaison sans point d'accès | Matériel compatible seulement (`PackageManager.FEATURE_WIFI_AWARE`) ; à détecter, jamais supposer |

## 5. iOS (pour la suite)

CoreBluetooth en arrière-plan : pas de balayage continu, annonces de service déplacées dans une zone que **seuls d'autres appareils iOS** voient en recherche explicite ; une application tuée ne relaie plus. Multipeer Connectivity ne parle pas à Android. Conséquence : Android ↔ iPhone par BLE n'est envisageable qu'avec l'application au premier plan côté iPhone, jusqu'à preuve du contraire (essais E4 de la feuille de route).

## 6. Essais physiques requis avant toute annonce

| Essai | Appareils | Critère de réussite |
|---|---|---|
| M1 | 2 Android, BLE seul, sans SIM ni Wi-Fi | Découverte < 10 s à 5 m ; message chiffré remis et « Délivré » (accusé signé) |
| M2 | 3 Android, A et C hors de portée | A→B→C remis, TTL décrémenté, aucun doublon chez C |
| M3 | 2 Android, écran éteint 30 min | Remise toujours possible ; consommation mesurée |
| M4 | Android ↔ iPhone (premier plan) | Découverte et échange |
| M5 | Wi-Fi Direct, fichier de 5 Mo | Transfert intègre, débit mesuré |
| M6 | Attaquant (rafale, rejeu, fragments malformés) | Débit limité, rejeu ignoré, pas de plantage ni de croissance mémoire |

## 7. Répartition

- **Antigravity** (développement Android) : `BleLink`, service de premier plan, `MeshRouter`, rembourrage, interface — en s'appuyant sur `mesh/` sans le dupliquer.
- **Claude** : contre-audit de chaque étape, tests d'attaque (M6), interopérabilité avec le web et le relais.
- **REA** : mesures comparées avec Bitchat sur les mêmes appareils (B-T1…B-T8).
