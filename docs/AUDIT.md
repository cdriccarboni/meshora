# MESHORA — Audit technique

> Version 0.1 — 25 octobre 2026 — rédigé par Claude (rôle : audit et architecture).
> Ce document distingue systématiquement trois niveaux de preuve :
> **[S]** sourcé (documentation officielle ou source fiable citée en bas de page),
> **[C]** connaissance générale du domaine, non revérifiée pour cette version,
> **[T]** hypothèse qui DOIT être tranchée par un test sur appareils réels (voir ROADMAP, phase 0).
> Aucune ligne marquée [C] ou [T] ne doit être présentée comme validée.

---

## 0. Synthèse en dix lignes

1. **Ne pas inventer un nouveau mesh radio.** Les briques existent : Meshtastic / MeshCore pour LoRa, Reticulum pour l'interconnexion multi-supports, Bitchat pour le mesh Bluetooth entre téléphones, Nostr pour la synchronisation différée via Internet.
2. **La vraie valeur de MESHORA est la couche d'interopérabilité** : une enveloppe de message commune, une identité commune, des adaptateurs vers chaque réseau, et des passerelles.
3. **L'iPhone est le maillon contraint.** Un iPhone relaie correctement quand l'application est au premier plan ; en arrière-plan c'est partiel et bridé ; quand l'utilisateur a fermé l'application (balayage), il ne relaie plus rien. [S/C, voir §4]
4. **Wi-Fi Aware arrive sur iOS 26 mais n'est pas un mesh opportuniste** : appairage obligatoire par code à six chiffres, capacité soumise à autorisation d'Apple, interopérabilité Android ↔ iPhone non démontrée publiquement à ce jour. [S]
5. **Le seul transport téléphone ↔ téléphone Android ↔ iPhone éprouvé à grande échelle sans infrastructure est le Bluetooth LE en GATT applicatif** (Bitchat : plusieurs centaines de milliers de téléchargements, interop Android/iOS depuis la v1.1.1). [S]
6. **Un prototype PWA/web ne peut pas faire de mesh sur iPhone** : Safari n'expose pas Web Bluetooth, et aucun navigateur n'expose l'émission d'annonces BLE. Le prototype AI Studio doit être pensé comme maquette d'interface + simulateur. [C, à confirmer en 10 minutes sur un iPhone]
7. **Licences fragmentées** : MeshCore MIT, Bitchat iOS Unlicense / Android MIT, Reticulum référence sous licence maison restrictive, forks AGPL. Ce choix conditionne ce qu'on peut embarquer. [S]
8. **Nostr est le meilleur candidat pour la synchronisation Internet** (identité par clé, relais remplaçables, auto-hébergeables), Mastodon et Bluesky en *ponts de publication* seulement.
9. **Sécurité : aucune crypto maison.** libsodium / Noise / MLS. Bitchat a connu une faille d'usurpation d'identité en bêta : le modèle de menace doit couvrir les relais hostiles dès le MVP.
10. **Priorité absolue : une phase 0 d'expérimentations mesurées (6 semaines)** avant toute promesse publique.

---

## 1. Cartographie des projets existants

| Projet | Rôle | Plateformes | Licence | Maintenance (oct. 2026) | Réutilisation pour MESHORA |
|---|---|---|---|---|---|
| **Meshtastic** | Mesh LoRa par inondation gérée, téléphone relié en BLE/USB à une radio | Firmware ESP32/nRF52/RP2040 ; apps Android, Apple, web, CLI Python | GPL-3.0 [C, à reconfirmer pour les protobufs] | Très actif, plus grande communauté LoRa [C] | **Pont**, pas intégration : piloter une radio Meshtastic via son API (protobufs sur BLE/série/TCP). Ne pas embarquer de code GPL dans un cœur sous licence permissive. |
| **MeshCore** | Mesh LoRa avec répéteurs dédiés et routage par chemin appris | Firmware multi-cartes ; clients Android, iOS, web, Node, Python | MIT [S] | Actif, forks nombreux (UI tactiles, firmwares autonomes) [S] | **Pont** via firmware « companion » (BLE/USB/Wi-Fi) [S]. Licence permissive : réutilisation de code possible. |
| **Reticulum (RNS) + LXMF** | Pile réseau chiffrée indépendante du support (LoRa, série, TCP, UDP, I2P…) ; LXMF = messagerie avec nœuds de propagation (stockage-relais) | Python (référence), forks Python et Rust | Protocole dans le domaine public depuis 2016 ; implémentation de référence sous « Reticulum License » (MIT + clauses restrictives, dont anti-IA) qui bloque Debian/F-Droid ; RetiNet AGPL-3.0 ; implémentation Rust « Leviculum » passée de MIT à AGPL-3.0 en mars 2026 ; Reticulum-rs (Beechat) MIT [S] | Mainteneur historique en retrait depuis fin 2025, communauté qui s'organise autour de forks [S] | **Pont** via démon sur passerelle (Raspberry Pi). Excellente source d'inspiration (adressage par hachage de clé, annonces, propagation). Pas comme cœur mobile : pas d'implémentation iOS mature, gouvernance incertaine. |
| **Bitchat** | Messagerie mesh BLE entre téléphones, repli Internet via Nostr | iOS/macOS (Swift), Android (Kotlin) | iOS : Unlicense (domaine public) ; Android : MIT [S] | Actif ; ~360 000 téléchargements fin sept. 2025 ; usage réel lors de coupures (Népal, Madagascar, Ouganda, Iran) ; retiré de l'App Store chinois en avril 2026 [S] | **Candidat n°1 pour le transport téléphone ↔ téléphone.** Licences compatibles avec tout. Chiffrement Noise sur le mesh, 7 sauts max. Attention : enveloppe Nostr propriétaire (pas NIP-17/44/59), aucun audit externe, faille d'usurpation en bêta [S]. |
| **Briar** | Messagerie P2P Bluetooth / Wi-Fi / Tor / clé USB | Android, desktop ; **pas d'iOS prévu** (« Probably not ») [S] | GPL-3.0+ (Android), AGPL (desktop) [S] | Lent (dernière stable listée : 1.5.9, janv. 2024) [S] | Référence de conception (modèle de menace sérieux, audit). Inutilisable pour l'exigence iPhone. |
| **Bridgefy** (SDK) | Mesh BLE commercial | Android, iOS | Propriétaire [C] | — | Contre-exemple : failles cryptographiques publiées par des chercheurs en 2020–2021 [C]. À ne pas reprendre. |
| **Google Nearby Connections** | Découverte + bascule BT → Wi-Fi | Android (Play Services) ; portage open source iOS/Linux/Windows en v0.0.1, figé depuis 2021, « pas un produit officiellement supporté » [S] | — | Abandonné côté iOS [S] | **À écarter pour l'interop iPhone.** Utilisable sur Android ↔ Android seulement, avec dépendance Google Play Services (contraire au principe d'indépendance). |
| **Apple Multipeer Connectivity** | P2P Apple ↔ Apple (Wi-Fi/AWDL + BT) | iOS, macOS | Propriétaire, API système | Maintenu | **Apple ↔ Apple uniquement.** Optionnel pour transferts volumineux entre iPhones au premier plan. |
| **Wi-Fi Aware (NAN)** | P2P Wi-Fi sans point d'accès | Android 8+ (selon matériel) ; iOS/iPadOS 26 sur iPhone 12+ ; pas watchOS ni macOS [S] | Standard Wi-Fi Alliance | Neuf sur iOS | **Expérimental.** Sur iOS : appairage obligatoire par PIN à 6 chiffres, aucun lien de données ouvert, capacité gérée à demander à Apple [S]. Interop Android ↔ iOS : aucun résultat public trouvé [S]. Utile plus tard pour gros transferts entre pairs déjà appairés. |
| **Yggdrasil** | Réseau IPv6 chiffré auto-organisé (overlay) | Linux, macOS, Windows, Android, iOS (via VPN) [C] | LGPL-3.0 [C] | Actif, statut « alpha » assumé [C] | Option pour relier les passerelles entre elles. Pas pour le hors-ligne téléphone. |
| **cjdns** | Overlay IPv6 chiffré | Linux surtout | GPL-3.0 [C] | Faible activité [C] | À écarter. |
| **libp2p** | Boîte à outils P2P (transports, DHT, pubsub) | Go, Rust, JS… | MIT/Apache-2.0 [C] | Très actif [C] | Utile pour passerelles/desktop (gossipsub). Lourd pour BLE et microcontrôleurs. |
| **IPFS** | Stockage adressé par contenu | — | MIT/Apache-2.0 [C] | Actif [C] | Hors périmètre MVP. Éventuellement pièces jointes volumineuses côté passerelle. |
| **Nostr** | Événements signés (secp256k1/Schnorr) diffusés via relais simples | Universel | Protocole ouvert (NIPs) ; relais variés [C] | Très actif [C] | **Synchronisation différée Internet.** Messages privés via NIP-17/NIP-44/NIP-59 [C]. Relais auto-hébergeable. |
| **ActivityPub / Mastodon** | Fédération par serveurs | — | Mastodon AGPL-3.0 [C] | Actif | **Pont de publication** via API Mastodon (OAuth) depuis une passerelle. |
| **AT Protocol / Bluesky** | Réseau social à dépôts de données portables | — | Spécification ouverte, implémentations MIT/Apache [C] | Actif | **Pont de publication** via API (OAuth ou mot de passe d'application). |
| **Bridgy Fed** | Pont ActivityPub ↔ Bluesky (et autres) | Service web | Open source [C] | Actif [C] | **À réutiliser plutôt que de reconstruire un pont**. |
| **Thread / Matter** | Mesh IPv6 basse conso (Thread) + couche applicative domotique (Matter) | Box domotiques, quelques téléphones avec radio Thread [C] | Spécifications ouvertes sous adhésion (CSA) [C] | Actif | **Hors périmètre messagerie.** Les apps mobiles n'ont pas d'accès brut à la radio Thread. Intégration éventuelle via Home Assistant plus tard. |
| **ESP-NOW** | Trames Wi-Fi courtes sans association entre puces Espressif | ESP32/ESP8266 | Propriétaire Espressif (SDK gratuit) [C] | Actif | Utile entre capteurs ESP32 d'un même site. Pas de téléphone. |
| **LoRa** (couche physique) | Radio longue portée très bas débit | Modules SX126x/SX127x/LR11xx | — | — | Via Meshtastic / MeshCore / Reticulum (RNode). Jamais en direct depuis un téléphone. |

### Constats

- **Aucun projet ne couvre tout.** Le paysage se découpe en trois îlots qui ne se parlent pas : téléphones en BLE (Bitchat, Briar), LoRa (Meshtastic, MeshCore — eux-mêmes incompatibles entre eux), et réseaux sociaux Internet. MESHORA a une raison d'exister précisément dans les ponts.
- **Le risque principal de MESHORA serait d'ajouter un quatrième îlot.** D'où la règle : chaque nouveau protocole MESHORA doit justifier qu'aucun existant ne convient.

---

## 2. Bluetooth : le transport central

| Option | Android ↔ Android | iPhone ↔ iPhone | Android ↔ iPhone | Verdict |
|---|---|---|---|---|
| BLE GATT applicatif (central + périphérique) | Oui | Oui | **Oui** (prouvé par Bitchat) [S] | **Retenu.** |
| BLE annonces seules (advertising) | Oui | Oui au premier plan ; en arrière-plan les UUID passent dans une « zone de débordement » lisible seulement par iOS [C] | Partiel, très dégradé en arrière-plan [T] | Découverte uniquement. |
| **Bluetooth Mesh** (spécification SIG) | Possible via pile applicative | Pas d'accès système, pile à réimplémenter au-dessus de GATT (proxy) [C] | Théorique | **Écarté** : conçu pour l'éclairage/domotique (messages minuscules, provisionnement centralisé), mauvais pour la messagerie. |
| Bluetooth classique (RFCOMM) | Oui | **Non** (réservé aux accessoires MFi) [C] | Non | Écarté. |

Ordres de grandeur réalistes [C, à mesurer en phase 0] : portée utile 10–40 m en intérieur, 50–100 m en champ libre ; débit applicatif de quelques dizaines de ko/s ; nombre de connexions simultanées limité (à mesurer par modèle).

## 3. Wi-Fi

- **Wi-Fi infrastructure (même routeur, sans Internet)** : le plus simple et le plus performant. mDNS/Bonjour + TCP/UDP. Fonctionne partout, y compris iPhone, desktop, Raspberry Pi. **Retenu pour le MVP** (« mode salle » : un routeur Wi-Fi alimenté par batterie suffit).
- **Wi-Fi Direct** : Android seulement ; iOS ne l'expose pas [C]. Écarté pour l'interop.
- **Wi-Fi Aware** : voir tableau §1. Expérimental, phase bêta au plus tôt.
- **Multipeer Connectivity** : Apple ↔ Apple, optionnel.

## 4. Point critique : Apple

| Question | Constat | Niveau |
|---|---|---|
| BLE en arrière-plan (central) | Autorisé avec le mode `bluetooth-central`, mais le scan doit cibler des UUID de service précis, les doublons sont fusionnés, la fréquence de scan est réduite. | [C] — doc Core Bluetooth « Background Processing » |
| BLE en arrière-plan (périphérique) | Autorisé avec `bluetooth-peripheral`, mais le nom local disparaît et les UUID passent en zone de débordement visible des seuls appareils iOS qui scannent explicitement cet UUID. Android ne les voit pas nativement. | [C] → **[T] critique** |
| Découverte d'un iPhone en arrière-plan par un Android | Très dégradée. Contournement connu : l'Android annonce, l'iPhone (central) le trouve et se connecte. Les connexions déjà établies survivent au passage en arrière-plan. | [T] |
| Relais quand l'application est fermée par l'utilisateur | **Non.** Un balayage dans le sélecteur d'apps empêche la relance par les événements Bluetooth. La restauration d'état ne couvre que les arrêts décidés par le système. | [C] — à démontrer quand même par test |
| Relais en arrière-plan, écran verrouillé | Possible sur connexions existantes, avec latence et coupures ; durée non garantie. | [T] |
| Multipeer Connectivity | Apple seulement ; sessions suspendues en arrière-plan. | [C] |
| Wi-Fi | Pas de Wi-Fi Direct ; Wi-Fi Aware avec appairage PIN et capacité gérée ; pas de scan Wi-Fi libre. | [S] |
| Contraintes App Store | Modes d'arrière-plan à justifier par la fonction réelle ; détourner la localisation ou VoIP pour maintenir l'app éveillée mène au rejet ; messagerie chiffrée : déclaration d'export du chiffrement ; risque de retrait par pays (précédent Bitchat en Chine). | [C] + [S] pour le précédent |
| Android ↔ iPhone en conditions réelles | Prouvé au premier plan par Bitchat depuis la v1.1.1. Le comportement en arrière-plan n'est documenté nulle part de façon fiable. | [S] / [T] |
| PWA / Safari | Pas de Web Bluetooth sur iOS (tous les navigateurs iOS utilisent WebKit). Aucune API web pour émettre des annonces BLE, sur aucune plateforme. | [C] — vérification triviale |

**Conclusion Apple :** MESHORA peut promettre sur iPhone « messagerie de proximité fiable application ouverte, relais opportuniste en arrière-plan ». Il ne peut pas promettre « l'iPhone dans votre poche relaie le réseau en permanence ». Toute communication publique devra le dire.

## 5. Radios longue portée et objets

- **LoRa** : le bon outil pour la portée (kilomètres) mais pas pour le débit (quelques centaines d'octets par paquet, secondes de temps d'antenne en facteur d'étalement élevé). En Europe (bande 868 MHz), le **rapport cyclique réglementaire est de 1 % sur la plupart des sous-bandes** [C], soit environ 36 s d'émission par heure et par appareil : LoRa transporte du texte court, jamais d'images.
- **Stratégie** : le téléphone ne parle jamais LoRa directement ; il parle à une radio compagnon (Meshtastic ou MeshCore) en BLE/USB, ou à une passerelle Raspberry Pi qui fait le pont.
- **Radioamateur** : le chiffrement est interdit dans de nombreux pays sous licence amateur [S, Reticulum]. MESHORA reste sur les bandes ISM sans licence.
- **Montres** : watchOS sans mesh BLE d'arrière-plan exploitable [C] ; Wear OS plus ouvert. Les montres sont des **terminaux d'affichage** reliés au téléphone, pas des relais.
- **Microcontrôleurs** : ESP32 (BLE + Wi-Fi + ESP-NOW + LoRa externe) et nRF52 (BLE + LoRa) sont des relais fixes idéaux, alimentés en permanence, qui compensent la faiblesse des iPhones en arrière-plan.

## 6. Réutiliser plutôt que réinventer — recommandations

| Besoin | Réutiliser | Écrire nous-mêmes |
|---|---|---|
| Transport téléphone ↔ téléphone | Format et logique BLE de Bitchat (Unlicense/MIT) ; tester d'abord l'**interopérabilité directe avec Bitchat** | Adaptateur dans le cœur MESHORA |
| Cryptographie | libsodium, Noise Protocol Framework (XX), plus tard MLS (RFC 9420) | Rien |
| LoRa | Firmwares Meshtastic et MeshCore inchangés | Ponts côté passerelle/app |
| Interconnexion multi-supports | Reticulum (protocole public) via démon sur passerelle | Pont |
| Synchro Internet | Nostr (relais existants + un relais auto-hébergé) | Client Nostr dans la passerelle |
| Réseaux sociaux | API Mastodon et Bluesky, Bridgy Fed | Module de publication |
| Spécification de l'enveloppe | CBOR (RFC 8949), idées du Bundle Protocol DTN (RFC 9171) | **La seule pièce vraiment nouvelle** |

---

## Sources consultées (25 octobre 2026)

- Apple, documentation du framework Wi-Fi Aware : https://developer.apple.com/documentation/wifiaware
- Espressif, « Connect ESP with an iPhone directly using Wi-Fi Aware » (août 2026) : https://developer.espressif.com/blog/2026/08/wifi-aware-esp-to-iphone/
- Forum Apple, appel à tests d'interop Wi-Fi Aware Android ↔ iOS 26 (sept. 2026, sans réponse) : https://developer.apple.com/forums/thread/845528
- MacRumors, Wi-Fi Aware dans iOS 26 : https://www.macrumors.com/2025/06/21/ios-26-adding-two-new-wi-fi-features/
- Macwelt, Wi-Fi Aware absent de watchOS et macOS : https://www.macwelt.de/article/2823825/ios-26-apple-offnet-airplay-fur-dritte-auf-druck-der-eu.html
- Bitchat, dépôt officiel : https://github.com/permissionlesstech/bitchat
- Wikipédia, BitChat : https://en.wikipedia.org/wiki/BitChat
- heise, Bitchat Mesh et l'interop Android (v1.1.1) : https://heise.de/-10504261
- FOSDEM 2026, Reticulum community meetup (licences, forks) : https://fosdem.org/2026/schedule/event/9NCWUR-reticulum_community_meetup_implementations_migration_and_future
- Gigazine, retrait du mainteneur de Reticulum : https://wbgsv0a.gigazine.net/gsc_news/en/20260120-reticulum-network-stack
- Leviculum (Reticulum en Rust, passage AGPL) : https://zff.dev/Lew_Palm/Leviculum
- MeshCore FAQ (licence MIT, clients) : https://github.com/meshcore-dev/MeshCore/blob/main/docs/faq.md
- Wikipédia, Briar : https://en.wikipedia.org/wiki/Briar_(software)
- google/nearby (portage iOS v0.0.1) : https://swiftpackageregistry.com/google/nearby

Points [C] à sourcer en priorité avant la bêta : licence exacte des protobufs Meshtastic ; textes Apple « Core Bluetooth Background Processing » ; règles ETSI EN 300 220 pour le 868 MHz ; état de Bridgy Fed vis-à-vis de Nostr.
