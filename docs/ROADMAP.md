# MESHORA — Feuille de route, coûts et plan de tests

> Version 0.1 — 25 octobre 2026. Les durées supposent une équipe réduite (1–2 développeurs à temps partiel + contributions). Elles sont indicatives.

## 1. Phases

### Phase 0 — Preuves expérimentales (6 semaines) — **bloquante**
Objectif : transformer les 🧪 critiques de `COMPATIBILITY.md` en résultats mesurés. Rien n'est promis publiquement avant la fin.

| Id | Expérience | Question tranchée | Critère de réussite |
|---|---|---|---|
| E1 | Prototype web sur iPhone | Web Bluetooth disponible ? | Constat documenté (attendu : non) |
| E2 | App BLE minimale Android ↔ iPhone, premier plan | Débit, portée, connexions simultanées | Mesures sur 3 modèles par plateforme |
| E3 | Bitchat ↔ app MESHORA minimale | Peut-on parler le protocole BLE de Bitchat ? | Message échangé dans les deux sens, ou rapport d'incompatibilité |
| E4 | iPhone en arrière-plan, écran verrouillé, 1 h | Relais réel en arrière-plan | Taux de livraison et latence mesurés, toutes les 5 min |
| E5 | iPhone fermé par l'utilisateur | Relais après balayage | Constat (attendu : aucun relais) |
| E6 | Chaîne de 5 sauts mixtes (Android, iPhone, ESP32) | Inondation + dédup | ≥ 95 % de livraison, latence médiane notée |
| E7 | Radio MeshCore et Meshtastic pilotée depuis l'app | Faisabilité du pont | Message texte de bout en bout BLE → LoRa → BLE |
| E8 | Wi-Fi Aware iPhone (iOS 26) ↔ Android | Interop réelle | Lien de données établi ou échec documenté |
| E9 | Passerelle Pi → Nostr → téléphone distant | Synchro différée | Message livré après reconnexion, sans doublon |
| E10 | **Nearby** : reconnaissance d'un contact appairé Android ↔ iPhone par identifiant tournant (tests N1–N5 de `NEARBY.md`) | La découverte privée fonctionne-t-elle des deux côtés, au premier plan et en arrière-plan ? | Délais et taux de reconnaissance publiés ; aucun identifiant stable au-delà de 15 min |

Livrable : `docs/tests/PHASE0-RESULTS.md` avec données brutes.

### MVP (phase 1 — environ 4 mois après la phase 0)
- Android et iPhone : messages texte 1:1 et petits groupes, BLE + LAN.
- Identité, vérification QR, chiffrement (SECURITY §3).
- Stockage-relais, expiration, accusés.
- Synchro Nostr quand un appareil a Internet.
- Simulateur intégré (issu du prototype AI Studio) pour les démos.
- Limites affichées dans l'app (arrière-plan iOS).

### Bêta (phase 2 — +4 à 6 mois)
- Desktop macOS, Windows, Linux (Tauri).
- Démon passerelle Raspberry Pi (image prête à flasher).
- Ponts Meshtastic et MeshCore.
- Publication Mastodon et Bluesky par jeton délégué.
- Pièces jointes légères (images compressées) hors LoRa.
- Programme de testeurs terrain (festival, salle de spectacle, randonnée).

### Version stable (phase 3 — +6 mois)
- Audit de sécurité externe et correctifs.
- Groupes MLS.
- Pont Reticulum ; Wi-Fi Aware si E8 positif ; Multipeer pour gros fichiers Apple ↔ Apple.
- Firmware relais fixe ESP32 MESHORA (ou profil sur MeshCore).
- Spécification de l'enveloppe v1 figée et publiée.

### Chantier prioritaire Nearby
Détail dans `NEARBY.md` §7–8. Phase 0 : E10 (N1–N5). MVP : appairage QR, identifiants tournants, visibilité « Mes contacts », liste « Autour de moi ». Bêta : relais appairés via AccessorySetupKit et CompanionDeviceManager, révocation testée (N6), consommation publiée (N8). Stable : appairage par proximité UE pour les relais, UWB « par ici », Wi-Fi Aware pour les fichiers.

### Modules Shield et Resilience
Leur découpage par phase est détaillé dans `SHIELD-SECURITY-AUDIT.md` §10 et `RESILIENCE.md` §7. En résumé : la bêta Shield se limite au VPN vers sa propre passerelle + DNS chiffré ; le MVP Resilience couvre détection de connexion, basculement BLE/LAN/Nostr, états de message et indicateurs honnêtes.

## 2. Estimation des coûts (ordres de grandeur à vérifier au moment de l'achat)

### Matériel de laboratoire
| Poste | Quantité | Prix unitaire indicatif | Total |
|---|---|---|---|
| iPhone d'occasion (un ancien éligible iOS 26, un récent) | 3 | 150–400 € | ~900 € |
| Android variés (Pixel, Samsung, Xiaomi : surcouches différentes) | 4 | 100–300 € | ~800 € |
| Cartes LoRa (Heltec V3/V4, RAK4631, LilyGo T-Deck) | 6 | 25–80 € | ~300 € |
| Raspberry Pi 5 + alimentation + carte SD + HAT LoRa | 2 | 120–180 € | ~300 € |
| ESP32-C6/S3 nus (relais BLE) | 5 | 8–15 € | ~60 € |
| Batteries USB, antennes, boîtiers | — | — | ~150 € |
| **Total matériel** | | | **≈ 2 500 €** |

### Abonnements et hébergement
| Poste | Coût |
|---|---|
| Apple Developer Program | 99 €/an |
| Google Play Console | 25 $ une fois |
| Relais Nostr + site + CI (petit VPS) | 5–15 €/mois |
| CI macOS pour builds iOS (GitHub Actions, minutes macOS) | 0–50 €/mois selon volume |
| Nom de domaine | ~15 €/an |

### Maintenance et sécurité
| Poste | Ordre de grandeur |
|---|---|
| Audit de sécurité externe (cœur crypto + protocole) | 15 000–40 000 € — à financer (NLnet / NGI, Fondation OTF, Prototype Fund selon éligibilité) |
| Maintenance continue (mises à jour iOS/Android annuelles, dépendances) | 0,3–0,5 équivalent temps plein |

## 3. Plan de tests reproductibles sur appareils réels

### Principes
- Chaque test a un **identifiant**, un **protocole écrit**, une **version exacte** de l'app, de l'OS et du modèle d'appareil.
- Les apps produisent des **journaux JSON horodatés** (envoi, réception, relais, état arrière-plan) récupérés par script (`adb` côté Android, export de fichier côté iOS).
- Chaque résultat est archivé dans `docs/tests/` avec les journaux bruts. Un test non archivé n'existe pas.
- Résultats négatifs publiés au même titre que les positifs.

### États d'application à couvrir (iOS et Android)
1. Premier plan, écran allumé
2. Arrière-plan, écran allumé
3. Écran verrouillé < 5 min
4. Écran verrouillé > 30 min
5. Mode économie d'énergie actif
6. Application fermée par l'utilisateur
7. Après redémarrage, sans ouvrir l'app

### Scénarios
| Id | Scénario | Mesures |
|---|---|---|
| T1 | Deux appareils à 1, 5, 10, 20, 40 m (intérieur et extérieur) | Taux de livraison, latence, RSSI |
| T2 | Chaîne linéaire de N sauts (N = 2 à 7) | Livraison, latence par saut |
| T3 | Partition puis fusion de deux groupes | Messages rattrapés, doublons |
| T4 | 30 appareils dans une salle (simulation spectacle/festival) | Saturation, consommation |
| T5 | Batterie sur 8 h, relais actif | % batterie/heure par modèle |
| T6 | Relais hostile (nœud modifié : rejoue, modifie, inonde, jette) | Détection et contournement |
| T7 | Passerelle intermittente (coupures Internet aléatoires) | Synchro sans perte ni doublon |
| T8 | LoRa : message court sur 1, 3, 5 km | Livraison, temps d'antenne consommé |

### Matrice minimale d'appareils
- iOS : un iPhone 12 (minimum Wi-Fi Aware), un iPhone récent, un iPad.
- Android : un Pixel (Android de référence), un Samsung, un Xiaomi ou Oppo (gestion d'énergie agressive), un appareil d'entrée de gamme.
- Desktop : un Mac Apple Silicon, un PC Windows 11, un portable Linux.
- Embarqué : Raspberry Pi 5, deux ESP32, deux cartes LoRa par firmware (Meshtastic, MeshCore).
