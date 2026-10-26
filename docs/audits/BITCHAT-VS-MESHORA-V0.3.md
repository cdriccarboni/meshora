# Bitchat face à MESHORA V0.3 — analyse des sources, écarts et plan « mieux que Bitchat »

| | |
|---|---|
| Date | 27 octobre 2026 |
| Auteur | Claude (demande du directeur artistique, 26/10, 23 h 25 : « REA sur Bitchat, intégrer Tor, mêmes fonctions en mieux, retrouver Internet ») |
| Sources lues | `permissionlesstech/bitchat-android` @ `eed8819` (26/10/2026) ; `permissionlesstech/bitchat` (iOS/macOS) @ `04995f6` (25/10/2026) : README, arborescence, `docs/`, `net/` (Tor), extraits de `protocol/`, `mesh/`, `noise/` |
| Méthode | Lecture du **code source public**, aucune décompilation : les sources sont publiques, la rétro-ingénierie des binaires n'apporte rien de plus. **Aucun code copié** (voir §5). Aucun essai de Bitchat sur téléphone (protocole REA B-T1…B-T8 toujours ouvert). |
| Complète | `docs/audits/CONTRE-AUDIT-REA-BITCHAT.md` (licences, whitepaper, plan d'essais) |

## 1. Fonctions : Bitchat (sources) / MESHORA V0.3 (état réel)

Légende MESHORA : ✅ vérifié sur appareil · 🔧 implémenté, vérifié automatiquement · 🧪 expérimental, non testé sur téléphone · 📐 conçu · ⬜ absent

| Fonction | Bitchat (Android, d'après les sources) | MESHORA V0.3 | Écart / avantage |
|---|---|---|---|
| Messagerie par Internet | Nostr (relais publics tiers, liste quotidienne) pour messages privés entre « favoris mutuels » et salons géographiques | Relais MESHORA dédié (Cloudflare), authentification par défi signé, boîte aux lettres 24 h ; ✅ 0.2.1 Pixel ↔ Mac, 🔧 0.3 contre l'adresse réelle | MESHORA : relais qui **vérifie l'identité de l'expéditeur** et ne remet l'accusé qu'à l'expéditeur ; fonctionne **dans un navigateur** (iPhone compris) sans installation |
| Maillage Bluetooth multi-sauts | Oui, 7 sauts, routage par la source (v2), fragmentation, compression, cycles d'activité, service de premier plan | 🧪 7 sauts, fragmentation, déduplication, limiteur ; application ouverte seulement | Bitchat en avance (maturité, arrière-plan) |
| Wi-Fi Aware (débit local supérieur) | Oui (appareils compatibles) | ⬜ | À faire |
| Chiffrement de bout en bout | Noise XX (X25519, ChaCha20-Poly1305), **confidentialité persistante** en session directe | ECDH éphémère + AES-256-GCM par message, signatures ECDSA ; **pas de confidentialité persistante** côté destinataire | Bitchat en avance : priorité P1 |
| Accusés de réception | Accusés de remise/lecture (sur Nostr : automatiques, critiqués en interne, H6) | **Signés par le destinataire, liés à l'empreinte de l'enveloppe émise** (banc T3/T4/T11) | MESHORA plus strict |
| Vérification des identités | Empreintes, favoris | Invitation hors relais (QR/lien) → contact **vérifié** ; clés hors courbe rejetées | Équivalent ; MESHORA lie l'invitation au groupe |
| Groupes / salons | Salons par sujet, mot de passe (Argon2id + AES-GCM), salons géographiques (geohash) | 🔧 un groupe privé par appareil (code 60 bits), invitations | Bitchat plus riche ; salons géographiques = risque de localisation (H7/H8 de leur revue) |
| Tor | Arti (Tor en Rust), AAR compilé sur mesure, tout le trafic HTTP/WebSocket par SOCKS | 🧪 **branche `claude/tor-option`** : tor-android 0.4.9.12 (Maven Central), échec fermé ; relais joignable par 5/5 sorties Tor et authentification réussie à travers Tor (ordinateur, 27/10) | Parité de principe ; à tester sur téléphone |
| Effacement d'urgence | Triple tape → effacement total | ⬜ | À faire (simple) |
| Médias, messages vocaux, fichiers, voix en direct | Oui | ⬜ | Plus tard |
| Partage de l'application hors ligne | Point d'accès Wi-Fi + serveur web local + QR code pour installer l'APK sans Internet | ⬜ | **Très utile pour MESHORA** (diffusion en zone coupée) |
| Montre (Wear OS) | Oui | ⬜ (vision « montre » sur le site) | Plus tard |
| Constructions reproductibles | Oui (conteneur épinglé) | ⬜ ; signature vérifiée, empreintes publiées | À faire avant Google Play |
| Numéros d'urgence | — | Accès direct 112 / 15, avertissement | MESHORA |
| Application web | — | 🔧 connexion automatique, invitations | MESHORA |

## 2. Ce que la revue de sécurité interne de Bitchat apprend à MESHORA

Bitchat publie une revue (`docs/security-review-jul-27.md`). Vérification au commit `eed8819` : les points critiques C1 (secrets Noise dans les journaux) et C2 (bombe de décompression), et H3 (messages déchiffrés dans les journaux) **sont corrigés** (plus de journalisation dans `SymmetricState`, décompression bornée). Leçons appliquées ou à appliquer à MESHORA :

| Leçon (référence Bitchat) | MESHORA V0.3 |
|---|---|
| Aucun secret ni texte clair dans les journaux (C1, H3) | ✅ aucun appel `Log`/`println` dans l'application Android ; relais sans journalisation |
| Taille annoncée par l'attaquant jamais allouée telle quelle (C2) | ✅ pas de compression ; réassemblage borné (64 Kio, 64 messages, 30 s) |
| Liaison clé de signature ↔ clé de chiffrement (H2) | ✅ une seule paire de clés (limite §6.1 du protocole, à séparer avec HKDF en V0.4) |
| Notifications sans contenu sur l'écran verrouillé (H4) | ✅ pas de notification de message aujourd'hui ; règle à respecter quand elles viendront (`VISIBILITY_PRIVATE`) |
| Vérifier toutes les signatures reçues d'un relais (H5) | ✅ HELLO, enveloppes, accusés et annonces Bluetooth vérifiés ; le relais lui-même vérifie le HELLO |
| Accusés automatiques = oracle de présence (H6) | ⚠️ MESHORA accuse automatiquement aussi, mais seulement aux membres du groupe ; option « accusés désactivés » à prévoir |
| Identifiants stables = traçage (H8, et B-P0-3) | ⚠️ annonce Bluetooth en clair (clé + nom) : averti dans l'interface ; balise chiffrée par le groupe proposée (`docs/BLUETOOTH-V0.3.md` §3) |
| Files et acteurs par pair non bornés (H9) | ✅ limiteur borné (éviction LRU), relais : 64 connexions/salon, 60 paquets/10 s |

## 3. « Retrouver Internet » : passerelle par les voisins (conception, non implémentée)

Objectif réaliste : **un téléphone qui a encore Internet achemine les messages MESHORA de ses voisins Bluetooth qui n'en ont plus**, dans les deux sens. Ce n'est pas un partage de connexion (navigation web impossible aux débits Bluetooth LE ; Android le réserve au partage de connexion du système).

Obstacle actuel : le relais n'accepte une enveloppe **que de la connexion de son expéditeur** (règle anti-usurpation). Proposition V0.4 :

1. Nouveau paquet `MESHORA_FORWARD {envelope}` : le relais **vérifie lui-même la signature ECDSA de l'enveloppe** (`id|sender|recipient|eph|iv|ct|ts`) au lieu de comparer à la connexion ; une enveloppe valide est remise ou mise en boîte aux lettres, quel que soit le porteur. C'est plus fort que la règle actuelle (la preuve voyage avec le message).
2. Côté téléphone passerelle : une enveloppe reçue par Bluetooth, destinée à une clé **absente du maillage**, est déposée sur le relais (au plus N par minute et par expéditeur). Réciproquement, le courrier en attente pour un voisin Bluetooth sans Internet lui est remis par le maillage : le relais remettrait à la passerelle les enveloppes destinées aux membres du groupe qu'elle déclare servir, **chiffrées pour eux, illisibles pour elle**.
3. Accusés : même chemin, déjà signés par le destinataire.
4. Consentement : réglage explicite « Servir de passerelle pour mon groupe », désactivé par défaut (batterie, données mobiles).

Essais nécessaires : P4 (relais 2 sauts) réussi d'abord, puis A (sans Internet) → B (passerelle) → relais → C (ailleurs, par Internet).

## 4. Plan « mieux que Bitchat » (proposé, à valider)

| Priorité | Chantier | Pourquoi |
|---|---|---|
| P0 | Essai 0.3.0-beta1 sur Pixel ; essais Bluetooth P1–P4 avec deux téléphones | Rien ne compte sans essai réel |
| P1 | Confidentialité persistante (clés de pré-session ou double cliquet) + séparation des clés (HKDF) | Seul retard de sécurité notable sur Bitchat |
| P1 | Mode Tor sur téléphone (branche prête) | Parité ; vérifié sur ordinateur |
| P1 | Effacement d'urgence | Simple, attendu |
| P2 | Balise Bluetooth chiffrée par le groupe | **Mieux que Bitchat** (leur identifiant de pair est stable) |
| P2 | Passerelle Internet par les voisins (§3) | **Va plus loin que Bitchat** |
| P2 | Partage de l'APK hors ligne (point d'accès + QR) | Diffusion en zone sinistrée |
| P3 | Plusieurs groupes, médias, messages vocaux, Wi-Fi Aware, montre | Confort |

## 5. Licences

- `bitchat-android` : **GPL-3.0** (fichier `LICENSE.md` ; le README dit encore « domaine public » : contradiction déjà signalée). `bitchat` (iOS) : domaine public (Unlicense).
- MESHORA est sous **AGPL-3.0-or-later** (en-têtes SPDX ; licence racine encore à décider, option B). La GPL-3.0 et l'AGPL-3.0 sont **compatibles** (article 13 des deux licences) : du code Android de Bitchat *pourrait* être combiné, à condition de garder la GPL pour ces parties et d'attribuer les auteurs. **Choix actuel : aucun code copié**, réimplémentation à partir des spécifications, tant que la licence racine n'est pas fixée.
- tor-android (Guardian Project) : BSD 3 clauses ; Tor : BSD 3 clauses. Compatibles.

## Sources
- https://github.com/permissionlesstech/bitchat-android (README, `LICENSE.md`, `docs/security-review-jul-27.md`, `docs/SOURCE_ROUTING.md`, `app/src/main/java/com/bitchat/android/net/`)
- https://github.com/permissionlesstech/bitchat (README, `WHITEPAPER.md`)
- https://github.com/guardianproject/tor-android (version 0.4.9.12, API `TorService`)
- https://check.torproject.org/api/ip (vérification des sorties Tor pendant l'essai)
