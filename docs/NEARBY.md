# MESHORA Nearby — Découverte d'appareils proches, simple et respectueuse de la vie privée

> Version 0.1 — 25 octobre 2026. Chantier prioritaire rattaché au pilier **Mesh** (découverte) et au pilier **Resilience** (communication sans Internet).
> Convention de preuve : **[S]** sourcé (liste en fin de document) · **[C]** connaissance du domaine, à revérifier · **[T]** à trancher par test sur appareils physiques.

## 0. Question centrale et réponse courte

**Comment offrir une expérience aussi simple que Localiser, mais pour communiquer entre appareils compatibles, avec une architecture ouverte ?**

1. **Find My (Apple) et Find Hub (Google) sont des modèles d'expérience, pas des transports.** Ce sont des réseaux fermés, réservés aux fabricants d'accessoires certifiés. Aucun des deux n'offre aux applications une API pour y faire circuler des données [S]. MESHORA ne les utilisera pas et ne tentera pas de les détourner.
2. **Ce qu'on reprend de Localiser, ce sont ses principes :**
   - un appairage unique, en personne ;
   - des identifiants Bluetooth qui changent régulièrement ;
   - seul le propriétaire (ici, un contact appairé) sait reconnaître ces identifiants ;
   - tout est chiffré de bout en bout ;
   - des alertes contre le suivi non consenti.
3. **Le parcours MESHORA Nearby :**
   - on s'ajoute **une fois**, en face à face (QR code, ou contact NFC sur Android) ;
   - ensuite, les téléphones **se reconnaissent automatiquement** quand ils sont proches, sans révéler leur identité aux inconnus ;
   - les messages passent directement en Bluetooth ou par le réseau local.
4. **La limite iOS décisive :** une application iPhone ne peut pas placer de données personnalisées dans ses annonces Bluetooth [C]. L'identifiant tournant doit donc être lu **après une courte connexion** Bluetooth. C'est la principale inconnue à mesurer (tests N2 à N4).

---

## 1. Programmes officiels Apple et Google (objectif 1)

| Programme | Pour qui | Ce qu'il permet | Ce qu'il ne permet pas | Pertinence MESHORA |
|---|---|---|---|---|
| **Apple Find My Network Accessory Program** (via MFi) | Fabricants d'accessoires sous licence, certification et outils de test Apple [S, annonce 2021] | Faire localiser un **accessoire** par le réseau Localiser et l'afficher dans l'app Localiser | Aucune API pour qu'une app envoie des messages via le réseau ; pas d'usage pour la communication | **Aucune** pour la messagerie. Envisageable seulement si MESHORA fabrique un jour un relais matériel qui doit pouvoir être retrouvé, ce qui est hors périmètre |
| **Google Find Hub Network** (ex-Find My Device, renommé en 2025 ; réseau élargi depuis avril 2024) [S] | Fabricants d'accessoires : formulaire de proposition, identifiant de modèle, accord de confidentialité, intégrateur système, certification en laboratoire tiers, validation du badge [S] | Localisation d'accessoires et de téléphones par le réseau Android | **« Google does not provide a specific SDK or API »** pour cette intégration [S] ; aucun transport de données pour les applications | **Aucune** pour la messagerie. Même conclusion |
| **Google Fast Pair** | Fabricants d'accessoires (casques, traceurs) [S] | Appairage en une touche sur Android | Rien entre téléphones | Inspiration pour l'expérience d'appairage d'un futur relais matériel |
| **Apple, appairage déclenché par proximité (UE)** | Organisations inscrites au programme développeur, accessoires vendus sous leur marque dans l'UE, iPhone sous iOS 26.5 ou ultérieur, avenant contractuel, auto-certification et enregistrement auprès d'Apple, application compagnon obligatoire [S] | Une fiche d'appairage s'affiche quand l'iPhone détecte un accessoire en mode appairage ; l'appli termine l'installation via AccessorySetupKit [S] | Téléphone ↔ téléphone ; usage hors UE | **Bêta/stable** : appairage d'un relais MESHORA (ESP32, Raspberry Pi) aussi simple que des écouteurs, pour les utilisateurs européens. Suppose un compte « organisation » (voir SHIELD §8) |
| **Recherche académique** sur le transport de données via Localiser (preuves de concept publiées) [C] | — | — | Hors des conditions d'utilisation, fragile, contraire à l'esprit du réseau | **Interdit dans MESHORA.** Mentionné uniquement pour être écarté explicitement |

**Conclusion :** aucun programme officiel ne permet de faire communiquer des téléphones via ces réseaux. MESHORA construit sa propre découverte sur des **API système documentées** et des **standards ouverts** (Bluetooth LE, mDNS, Wi-Fi Aware).

---

## 2. API publiques et équivalents (objectifs 2 et 3)

### 2.1 Apple
| API | Rôle | Limites clés | Usage MESHORA |
|---|---|---|---|
| **Core Bluetooth** (`CBCentralManager`, `CBPeripheralManager`) | BLE central et périphérique | Annonces limitées au nom local et aux UUID de service, **sans données de service ni données fabricant** [C] ; en arrière-plan, le nom disparaît et les UUID passent en zone de débordement [C] ; scan en arrière-plan uniquement sur des UUID connus [C] | **Transport principal** de Nearby |
| **AccessorySetupKit** (iOS 18+) | Sélecteur système d'accessoires ; l'app n'accède qu'aux accessoires choisis par l'utilisateur, sans demander l'autorisation Bluetooth globale [C] | Conçu pour des **accessoires**, pas pour des téléphones pairs [C] | Appairage des **relais matériels et objets** MESHORA |
| **DeviceDiscoveryUI** | Sélecteur système pour se connecter à une app sur un autre appareil Apple, via le framework Network [C] ; utilisé aussi pour appairer en Wi-Fi Aware sous iOS 26 [S] | Écosystème Apple principalement [C] | Optionnel, d'Apple à Apple |
| **Wi-Fi Aware** (iOS 26, iPhone 12 et ultérieur) | Pair à pair Wi-Fi | Appairage par code PIN obligatoire, capacité gérée par Apple, interopérabilité Android non prouvée [S, voir AUDIT] | Gros fichiers entre appareils **déjà appairés** (stable) |
| **Multipeer Connectivity** | Pair à pair entre appareils Apple | Apple uniquement | Optionnel |
| **Nearby Interaction** (puce UWB) | Distance et direction précises | Session à établir via un autre canal ; UWB tiers à certifier [C] | Plus tard : flèche « par ici » vers un contact, comme Localiser |
| **Core NFC** | Lecture de tags NFC | Pas d'émulation de carte entre deux iPhone pour une app [C] | Lire un tag NFC MESHORA (relais, affiche) |

### 2.2 Android
| API | Rôle | Limites clés | Usage MESHORA |
|---|---|---|---|
| **BluetoothLeAdvertiser / BluetoothLeScanner** | Annonces et scans BLE, **avec données de service** | Permissions `BLUETOOTH_SCAN` (avec `neverForLocation`), `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT` (Android 12 et ultérieur) [C] ; service au premier plan pour fonctionner durablement [C] | **Transport principal** |
| **CompanionDeviceManager** | Association système avec un appareil, sans permission de localisation ; observation de présence en arrière-plan [C] | Pensé pour des accessoires | Relais matériels, montres |
| **Wi-Fi Aware (NAN)** | Pair à pair Wi-Fi | Dépend du matériel [C] | Gros fichiers (stable) |
| **Nearby Connections** | Découverte et transfert | Dépend des services Google Play [C] ; portage iOS abandonné [S, AUDIT] | **Écarté** |
| **Fast Pair** | Appairage d'accessoires | Programme partenaire [S] | Inspiration pour l'expérience |
| **NFC / HCE** | Toucher pour échanger | Android ↔ Android ; Android → iPhone en lecture de tag [C, T] | Ajout d'un contact par contact physique |
| **UWB** (certains modèles) | Distance et direction | Rare, API récente [C] | Plus tard |

### 2.3 Desktop, objets, montres
- macOS : Core Bluetooth (pas de restriction d'arrière-plan pour une app active).
- Windows : WinRT Bluetooth LE ; le rôle périphérique est à vérifier par adaptateur [T].
- Linux et Raspberry Pi : BlueZ ; rôle de **relais fixe** idéal.
- ESP32 et nRF52 : relais BLE fixes, appairés via AccessorySetupKit (iOS) et CompanionDeviceManager (Android).
- Montres : voir §6.

---

## 3. Protocole de découverte MESHORA Nearby (objectifs 4 et 5)

### 3.1 Principes
- **Aucun identifiant stable diffusé.** Ni nom, ni numéro, ni clé publique en clair.
- **Reconnaissance réservée aux contacts appairés.** Un inconnu ne voit qu'un appareil MESHORA anonyme, et seulement si l'utilisateur l'a rendu visible à tous.
- **Le système d'exploitation randomise déjà l'adresse Bluetooth** (adresse privée résoluble) [C]. MESHORA ajoute son propre identifiant tournant au niveau applicatif.
- **Standards uniquement :** HMAC-SHA-256 (RFC 2104), X25519 pour le secret partagé, Noise XX pour la session (voir SECURITY). Pas de cryptographie maison.

### 3.2 Appairage initial (une fois, en personne)
1. A affiche un QR code : clé publique d'identité, et clé éphémère X25519 d'appairage.
2. B scanne le code. Les deux appareils établissent une session Noise XX par Bluetooth ou par le réseau local et vérifient les clés.
3. Dans cette session chiffrée, chacun transmet à l'autre sa **clé de balise** `k_beacon` (32 octets aléatoires, une par appareil, générée localement). C'est elle qui permet de reconnaître ses identifiants tournants.
4. Alternatives au QR : contact NFC (Android), ou nombres de sécurité lus à voix haute.

### 3.3 Identifiant tournant
- Époque de 15 minutes, alignée sur la rotation habituelle des adresses Bluetooth [C], et dans la fourchette du brouillon DULT pour un appareil proche de son propriétaire [S].
- `EphID = tronque_16_octets(HMAC-SHA-256(k_beacon, "meshora-nearby-v1" ‖ numéro_d_époque))`. Un seul EphID est diffusé par époque, quel que soit le nombre de contacts.
- **Révocation :** retirer un contact déclenche la génération d'une nouvelle `k_beacon`, transmise chiffrée aux contacts restants (en direct ou via la synchro différée). Le contact retiré ne peut plus calculer mes EphID. Même principe que les clés partagées des accessoires Localiser [C].
- Chaque appareil précalcule, pour chaque contact, les EphID de l'époque courante et des deux époques voisines (dérive d'horloge). Un contact se reconnaît par simple recherche dans une table.
- Coût : 300 contacts × 3 époques = 900 HMAC tous les quarts d'heure, ce qui est négligeable [C, mesure N9].
- Limite assumée : tous mes contacts reconnaissent les mêmes EphID, donc deux contacts peuvent savoir qu'ils m'ont vu au même endroit en comparant leurs observations. Ils me connaissent déjà ; le risque est documenté.

### 3.4 Où placer l'EphID
| Émetteur | Méthode | Raison |
|---|---|---|
| **Android** | Dans les données de service de l'annonce, sous l'UUID de service MESHORA | Lisible sans connexion, économe |
| **iPhone au premier plan** | UUID de service MESHORA fixe dans l'annonce, puis **EphID lu dans une caractéristique GATT** après une courte connexion. Option à tester : EphID encodé dans le nom local | iOS n'autorise pas les données de service dans les annonces d'une app [C] |
| **iPhone en arrière-plan** | UUID en zone de débordement : seul un iPhone qui scanne cet UUID le voit ; un Android peut le voir via le contournement « l'Android annonce, l'iPhone se connecte » | Comportement à mesurer (N3, N4) |
| **Relais fixe ESP32 ou Pi** | Données de service, comme Android | Pas de restriction |

**Point important :** l'UUID de service MESHORA fixe révèle qu'un appareil utilise MESHORA, mais pas **qui**. C'est le même compromis que pour toute application Bluetooth. Il est documenté, et l'utilisateur peut choisir d'être invisible.

### 3.5 Modes de visibilité (inspirés d'AirDrop)
| Mode | Annonce | Défaut |
|---|---|---|
| **Invisible** | Aucune annonce ; écoute seulement si l'utilisateur la lance | — |
| **Mes contacts** | EphID reconnaissables uniquement par les contacts appairés | **Oui** |
| **Tout le monde, 10 minutes** | Identifiant aléatoire (non dérivé de `k_beacon`) + nom choisi, pour ajouter quelqu'un ou rejoindre un groupe | Revient automatiquement à « Mes contacts » |

### 3.6 Permissions minimales
| Plateforme | Permissions | Demandée quand |
|---|---|---|
| iOS | Bluetooth (`NSBluetoothAlwaysUsageDescription`) ; caméra pour le QR ; réseau local pour le LAN | Au premier « Chercher autour de moi » |
| Android 12 et ultérieur | `BLUETOOTH_SCAN` avec `neverForLocation`, `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT`, notification du service au premier plan | Idem |
| Jamais demandé | Localisation, contacts du téléphone, micro, suivi publicitaire | — |

### 3.7 Consommation énergétique
- Profils de Resilience (normal, économie, veille relais) appliqués à Nearby : fréquence des annonces et cycle de scan (Android : modes basse consommation ou équilibré [C]).
- Pas de connexion GATT vers un appareil déjà reconnu durant la même époque.
- Sur iPhone, le système régule déjà fortement l'arrière-plan : la consommation dépendra surtout de l'usage au premier plan.
- Mesures publiées par modèle (N8).

---

## 4. Expérience « aussi simple que Localiser »

| Localiser / Find Hub | MESHORA Nearby |
|---|---|
| Accessoire appairé une fois | Contact ajouté une fois, en personne (QR ou contact NFC) |
| Retrouvé automatiquement, sans action | Reconnu automatiquement quand il est proche : « Léa est à proximité » (seulement si les deux l'ont accepté) |
| Liste « Appareils » | Onglet **Se connecter**, section « Autour de moi » : contacts proches, relais, passerelle |
| Faire sonner | Plus tard : « Faire signe » (notification douce chez le contact) |
| Flèche de direction (UWB) | Plus tard : distance et direction via Nearby Interaction / UWB, si les deux appareils en disposent |
| Chiffré, Apple et Google ne voient pas la position | Chiffré de bout en bout, **aucun serveur ne sait qui est proche de qui** |

**Différence assumée :** MESHORA ne localise pas des appareils perdus et ne remonte **aucune position** vers un réseau. Il sert à communiquer, pas à retrouver.

---

## 5. Protection contre le suivi non consenti (objectif 7)

| Risque | Mesure |
|---|---|
| Suivre une personne grâce aux annonces de son téléphone | EphID tournant toutes les 15 minutes, non relié entre époques sans `k_beacon` ; mode Invisible ; aucune donnée personnelle dans les annonces |
| Cacher un relais MESHORA (ESP32 alimenté) sur quelqu'un pour le pister | Les relais n'ont pas de fonction de localisation et ne remontent aucune position. Tout futur **matériel MESHORA** assez petit pour servir de traceur devra respecter les exigences DULT : identifiants tournants, mode « séparé », alerte des non-propriétaires [S, brouillon] |
| Reconnaissance d'un contact devenu indésirable (ex-conjoint, par exemple) | « Ne plus être visible de ce contact » : renouvellement immédiat de ma `k_beacon` et redistribution aux autres contacts, **sans notifier** la personne retirée. Effet dès l'époque suivante. Les contacts qui n'ont pas encore reçu la nouvelle clé ne me reconnaissent plus temporairement (délai mesuré en N6) |
| « Est à proximité » utilisé comme outil de surveillance | Réciprocité : un contact ne peut voir que l'autre est proche que si **les deux** ont activé l'option. Désactivable par contact. Aucun historique de proximité conservé par défaut |
| Corrélation par l'UUID de service fixe | Documentée ; mode Invisible ; étude d'une rotation de l'UUID pour Android (impossible en arrière-plan sur iOS, où l'UUID doit être connu à l'avance) |
| Faux appareil qui rejoue un EphID capté | Un EphID ne sert qu'à **déclencher** une session Noise authentifiée ; sans la clé, l'attaquant ne peut pas terminer la poignée de main |

Le projet suivra les travaux du groupe IETF DULT (brouillon de modèle de menace, version 05, août 2026, informatif, pas encore une RFC [S]).

---

## 6. Montres et objets connectés (objectif 6)

| Appareil | Rôle Nearby | Moyen |
|---|---|---|
| Apple Watch | Affichage et réponse rapide via l'iPhone | WatchConnectivity [C] ; aucune annonce propre |
| Wear OS | Affichage via le téléphone ; BLE propre possible [T] | Data Layer API ou BLE |
| Relais ESP32 / nRF52 | Relais fixe, découverte permanente, compense l'arrière-plan iOS | Appairage AccessorySetupKit (iOS), CompanionDeviceManager (Android), appairage par proximité UE (stable) |
| Raspberry Pi | Relais et passerelle | Appairage QR (voir SHIELD §3.2) |
| Objets domotiques (Matter, Thread) | Hors messagerie ; éventuellement « annonces » via Home Assistant | Plus tard |

---

## 7. Plan de tests réels (objectif 8)

Appareils minimaux : iPhone 12 (ou plus récent) sous iOS 26, un iPhone sous iOS 17, un Pixel, un Samsung, un Xiaomi, un relais ESP32-S3, un Raspberry Pi 5, un Mac. Journaux JSON horodatés, rapports dans `docs/tests/`.

| Id | Test | Mesure / critère |
|---|---|---|
| N1 | Appairage QR entre Android et iPhone | Taux de réussite, temps médian (< 15 s visé) |
| N2 | iPhone au premier plan vu par Android : UUID puis lecture GATT de l'EphID | Délai de reconnaissance, réussite sur 100 essais |
| N3 | iPhone en arrière-plan, écran verrouillé, vu par un autre iPhone puis par un Android | Reconnaissance oui/non, délai, sur 1 h |
| N4 | Contournement « l'Android annonce, l'iPhone se connecte » en arrière-plan | Taux de reconnaissance |
| N5 | Rotation : capture par un sniffer BLE (nRF52) sur 24 h | Aucun identifiant applicatif stable au-delà de 15 min ; corrélation par l'adresse système documentée |
| N6 | Contact retiré | Ne me reconnaît plus dès l'époque suivante ; délai de réception de la nouvelle clé par les autres contacts mesuré |
| N7 | Mode « Tout le monde, 10 minutes » | Retour automatique vérifié |
| N8 | Consommation sur 8 h par profil et par modèle | % de batterie par heure publié |
| N9 | 300 contacts simulés | Temps de calcul des tables EphID sur un téléphone d'entrée de gamme et sur un ESP32 |
| N10 | Relais ESP32 appairé via AccessorySetupKit et CompanionDeviceManager | Parcours sans permission Bluetooth globale (iOS) ; présence détectée en arrière-plan (Android) |
| N11 | Rejeu d'un EphID capté | Poignée de main refusée |
| N12 | Utilisabilité : 10 personnes ajoutent un contact puis s'échangent un message sans Internet | ≥ 9 réussissent sans aide |

---

## 8. Décisions proposées

- **NB-1** : aucune utilisation des réseaux Find My et Find Hub ; les programmes ne concernent que les accessoires.
- **NB-2** : la découverte repose sur un UUID de service MESHORA fixe et un EphID tournant (HMAC d'une clé de balise par appareil, 15 minutes, renouvelée à chaque retrait de contact) ; données de service sur Android et sur les relais, lecture GATT sur iPhone.
- **NB-3** : visibilité par défaut « Mes contacts » ; « Tout le monde » limité à 10 minutes ; option Invisible.
- **NB-4** : aucune position transmise ni conservée ; « est à proximité » réciproque et désactivable.
- **NB-5** : relais et objets appairés via AccessorySetupKit et CompanionDeviceManager ; appairage par proximité UE étudié pour la stable.
- **NB-6** : UWB, Wi-Fi Aware et « Faire signe » reportés après validation des tests N1 à N12.

## Sources consultées (25 octobre 2026)

- Google, Partner Integration Guide for Google's Find Hub Network : https://developers.google.com/nearby/fast-pair/landing-page-find-hub?hl=en
- Google, Fast Pair : https://developers.google.com/nearby/fast-pair
- Wikipédia, Find Hub : https://en.wikipedia.org/wiki/Find_Hub
- Apple, Proximity-triggered pairing in the European Union : https://developer.apple.com/proximity-pairing/
- MacRumors, appairage de type AirPods pour les appareils tiers dans l'UE : https://macrumors.com/2025/12/22/ios-26-3-dma-airpods-pairing
- AppleInsider, programme Find My pour les accessoires tiers (2021) : https://appleinsider.com/articles/21/04/07/apple-announces-find-my-network-for-third-party-accessories
- IETF, draft-ietf-dult-threat-model-05 (août 2026) : https://datatracker.ietf.org/doc/html/draft-ietf-dult-threat-model-05
- Apple, documentation Wi-Fi Aware : https://developer.apple.com/documentation/wifiaware

Points [C] à sourcer en priorité : clés d'annonce autorisées par `CBPeripheralManager` ; garanties de confidentialité d'AccessorySetupKit ; observation de présence de CompanionDeviceManager ; intervalle de rotation des adresses privées résolubles sur iOS et Android.
