# Vérification de l'audit Bitchat (`REA-BITCHAT.md`) et plan d'audit approfondi

| | |
|---|---|
| Date | 26 octobre 2026 |
| Auteur | Claude (contre-audit) |
| Document vérifié | `docs/audits/REA-BITCHAT.md` (PR #7, `f990e03`), rédigé par Antigravity sous l'en-tête « REA » |
| Référence | Issue #6 (mission REA) |
| Méthode | Lecture des sources primaires : dépôts GitHub, fichiers de licence, `WHITEPAPER.md` de Bitchat. **Aucun essai sur téléphone, aucune revue de code ligne à ligne.** |

## 0. Verdict

`REA-BITCHAT.md` donne une bonne orientation (licences, contraintes iOS, prudence sur la réutilisation), mais **ne remplit pas encore la mission de l'issue #6** : aucun essai reproductible, aucune revue de code, aucune séparation entre faits vérifiés et hypothèses, et plusieurs affirmations sont fausses ou sans source. L'audit approfondi reste **à faire par REA** ; ce document fournit la base vérifiée et le protocole.

## 1. Vérification des affirmations

Légende : ✅ vérifié dans une source primaire · ⚠️ inexact ou incomplet · ❌ contredit par la source · ❓ sans source, non vérifiable en l'état

| Affirmation de `REA-BITCHAT.md` | Statut | Source primaire et correction |
|---|---|---|
| `permissionlesstech/bitchat` (iOS/macOS) sous Unlicense | ✅ | README et fichier de licence du dépôt : domaine public (Unlicense) |
| `permissionlesstech/bitchat-android` sous GPL-3.0 | ✅ | `LICENSE.md` : GNU GPL v3. Attention : le README du même dépôt dit « released into the public domain » ; **le fichier de licence prime** ; la contradiction est à signaler et à lever auprès des auteurs avant toute réutilisation |
| TTL de 7 sauts | ✅ | Whitepaper : TTL initial 7 ; plafonné à 5 pour les diffusions des nœuds denses (≥ 6 liens) |
| Compression LZ4 | ✅ | README iOS |
| Noise XX, X25519, ChaCha20-Poly1305 | ✅ | Whitepaper : Noise `XX` (Curve25519, ChaCha20-Poly1305, SHA-256) pour les sessions en direct ; clé Ed25519 séparée pour signer les paquets |
| « Confidentialité persistante parfaite » | ⚠️ | Vrai pour les sessions en direct seulement. Le courrier différé (Noise `X`) et les messages privés via Nostr **n'ont pas** de confidentialité persistante (whitepaper) |
| Store-and-forward « Spray-and-Wait » | ❌ | Le whitepaper décrit des enveloppes « courrier » scellées (Noise `X`), étiquette de destinataire tournante de 16 octets dérivée de la clé et du jour UTC, ≤ 16 Kio, ≤ 24 h, quotas par déposant ; pas de « Spray-and-Wait » |
| « Aucune limitation de débit » | ❌ | Le whitepaper liste : plafonds de TTL, déduplication, quotas par déposant, limites de connexions et d'annonces |
| Identifiants de routage visibles par un observateur radio | ✅ (plus grave qu'écrit) | Identifiant de pair de 8 octets **non rotatif** (empreinte de la clé statique), annonces en clair avec pseudonyme, clés publiques et **jusqu'à 10 voisins directs** ; le whitepaper reconnaît que les métadonnées sont le point faible |
| > 60 % de pertes au-delà de 15 terminaux | ❓ | Aucune source ni mesure. À retirer ou à mesurer (essai B-T6 ci-dessous) |
| Pas de preuve de travail, attaque d'épuisement de batterie | ❓ | Hypothèse plausible, non démontrée : à tester (B-T7) |
| Fragmentation, MTU 23 à 512 octets | ⚠️ | Whitepaper : fragments d'environ 469 octets, réassemblage 30 s, 1 Mio max, 128 réassemblages simultanés |
| « Reticulum / MeshCore », licence MIT | ❌ | **Deux projets distincts.** MeshCore (`meshcore-dev/MeshCore`, C++ embarqué LoRa) : MIT ✅. Reticulum (`markqvist/Reticulum`) : « Reticulum License », texte MIT **avec deux restrictions d'usage** (interdiction d'usage destiné à nuire aux personnes ; interdiction d'usage dans des jeux de données d'entraînement d'IA). Ce n'est donc pas une licence libre au sens courant : **incompatible avec une réutilisation dans MESHORA sans analyse juridique** |
| Meshtastic firmware GPL-3.0 | ✅ | Dépôt `meshtastic/firmware` |
| libp2p (rust-libp2p) MIT / Apache-2.0 | ⚠️ | `libp2p/rust-libp2p` : MIT. Les autres implémentations (go-libp2p, js-libp2p) ont leurs propres licences permissives : vérifier celle de l'implémentation retenue |
| « Spécification unifiée MESHORA (0xFE60) », « service standardisé » | ❌ | Les UUID 16 bits de la plage 0xFDxx–0xFExx sont attribués par le Bluetooth SIG à des membres ; MESHORA n'a aucune attribution. Utiliser un UUID 128 bits aléatoire |
| Avertissements de Bitchat | ➕ manquant | Aucune revue de sécurité tierce mentionnée ; le dépôt signale des demandes de retrait ; les builds hors App Store « ne peuvent pas être vérifiés » sauf via le manifeste de hachages par version |

## 2. Matrice P0 / P1 / P2 (pour MESHORA)

| Id | Gravité | Point | Recommandation |
|---|---|---|---|
| B-P0-1 | P0 | Réutiliser du code `bitchat-android` imposerait la GPL-3.0 à l'application Android | Aucune copie de code. Réimplémentation à partir de spécifications ; consigner la provenance de chaque module |
| B-P0-2 | P0 | Reticulum n'est pas sous licence libre standard | Ne pas intégrer de code Reticulum ; l'interopérabilité de protocole seule est à étudier (le protocole est déclaré dans le domaine public depuis 2016) |
| B-P0-3 | P0 | Identifiant BLE persistant et voisinage annoncé en clair = traçage physique des personnes | MESHORA : identifiants tournants (voir `docs/NEARBY.md`, k_beacon), pas de liste de voisins en clair, rembourrage systématique |
| B-P1-1 | P1 | Courrier différé sans confidentialité persistante | Prévoir des clés de pré-session (prekeys) avant d'activer le store-and-forward BLE |
| B-P1-2 | P1 | Inondation BLE : saturation, épuisement de batterie | Quotas par pair, plafond de TTL selon la densité, retransmission avec temporisation aléatoire ; mesures sur appareils |
| B-P1-3 | P1 | iOS : pas de balayage continu en arrière-plan, application tuée = nœud mort | Ne rien promettre côté iOS en arrière-plan ; essais dédiés |
| B-P1-4 | P1 | UUID 16 bits non attribué | UUID 128 bits aléatoire pour le service MESHORA |
| B-P2-1 | P2 | Contradiction de licence README / LICENSE de `bitchat-android` | Demande de clarification aux auteurs avant toute réutilisation |
| B-P2-2 | P2 | Messages Nostr de Bitchat non conformes aux NIP-17/44/59 | Si MESHORA utilise Nostr : formats standard (NIP-44/59) uniquement |

## 3. Protocole d'audit approfondi à exécuter par REA (reproductible)

Matériel : 3 téléphones Android récents (dont un d'entrée de gamme), 1 iPhone, sans carte SIM ni Wi-Fi pour les essais hors Internet ; versions **publiées** de Bitchat, hachages vérifiés contre le manifeste de la version.

| Essai | Mesure | Critère |
|---|---|---|
| B-T1 | Découverte A↔B à 1, 5, 10, 20 m (intérieur), délai de première détection | Médiane et dispersion sur 20 essais |
| B-T2 | Relais A→B→C (A et C hors de portée l'un de l'autre) | Taux de remise, latence, nombre de sauts observés |
| B-T3 | Destinataire absent puis présent (courrier différé) | Remise, délai, expiration à 24 h |
| B-T4 | Arrière-plan Android (écran éteint 30 min) et iOS (application en arrière-plan, puis tuée) | Le nœud relaie-t-il encore ? |
| B-T5 | Consommation : 2 h écran éteint, avec/sans Bitchat | % de batterie, même appareil, même luminosité |
| B-T6 | Densité : 3 puis tous les appareils disponibles, rafale de 100 messages | Taux de perte mesuré (remplace l'affirmation « > 60 % ») |
| B-T7 | Attaquant : rejeu d'un paquet capturé, injection en rafale, usurpation de pseudonyme | Rejet ou non, effet sur la batterie des voisins |
| B-T8 | Écoute passive (nRF Connect ou renifleur BLE) | Ce qui est lisible en clair : identifiant, pseudonyme, voisins, tailles |

Chaque essai : appareils, versions d'OS et d'application, données brutes et captures dans `docs/tests/`. Séparer **fait mesuré**, **hypothèse**, **non testé**.

## 4. Comparaison synthétique (sources primaires)

| | Bitchat | Meshtastic | MeshCore | Reticulum | libp2p |
|---|---|---|---|---|---|
| Support | Téléphone seul (BLE) + Nostr | Boîtier LoRa externe | Boîtier LoRa externe | Agnostique (LoRa, IP, série…) | IP (TCP, QUIC, WebRTC, WebSocket) |
| Licence | Unlicense (iOS) / GPL-3.0 (Android) | GPL-3.0 | MIT | Reticulum License (MIT + restrictions d'usage) | MIT (rust-libp2p) ; autres implémentations à vérifier |
| Réutilisation de code par MESHORA | iOS possible (domaine public) ; Android non | Non (GPL) | Oui (MIT) | Non sans avis juridique | Oui |
| Usage recommandé pour MESHORA | Référence de conception BLE (lecture du whitepaper) | Passerelle LoRa externe via son API / protocole | Passerelle LoRa alternative, réutilisable | Étude de conception seulement | Transport Internet (GossipSub) côté relais/ordinateur |

## 5. Ce qui est vérifié ici, et ce qui ne l'est pas

Vérifié : licences, paramètres de protocole publiés, limites reconnues par les auteurs. **Non vérifié** : comportement réel sur appareils, consommation, portée, code source (seuls README, licences et whitepaper ont été lus).

## Sources

- https://github.com/permissionlesstech/bitchat (README, licence)
- https://github.com/permissionlesstech/bitchat/blob/main/WHITEPAPER.md
- https://github.com/permissionlesstech/bitchat-android et `LICENSE.md`
- https://github.com/meshcore-dev/MeshCore
- https://github.com/markqvist/Reticulum et `LICENSE`
- https://devzone.nordicsemi.com/f/nordic-q-a/112054/sig-member-service-uuid-vs-vendor-specific-uuid/488699 (UUID 16 bits réservés aux membres du SIG)
