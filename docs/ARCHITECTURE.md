# MESHORA — Architecture

> Version 0.1 — 25 octobre 2026. Les décisions marquées **ADR-n** sont proposées, à valider par le porteur du projet. Les niveaux de preuve [S]/[C]/[T] renvoient à `AUDIT.md`.

## 1. Principe directeur

MESHORA n'est pas un réseau de plus. C'est **une enveloppe de message, une identité et un jeu d'adaptateurs** qui laissent circuler un même message entre des îlots qui ne se parlent pas aujourd'hui : téléphones en Bluetooth, réseaux LoRa, réseau local, Internet (Nostr), réseaux sociaux (Mastodon, Bluesky).

```
                 ┌──────────────────────────────────────────────┐
                 │                 Applications                  │
                 │  iOS (Swift) · Android (Kotlin) · Desktop     │
                 │  (Tauri) · CLI · Démon passerelle (Linux/Pi)  │
                 └───────────────▲──────────────────────────────┘
                                 │ liaison FFI (UniFFI)
┌────────────────────────────────┴─────────────────────────────────┐
│                      meshora-core (Rust)                          │
│  Identité & clés │ Enveloppe (CBOR) │ Chiffrement (libsodium/Noise)│
│  Magasin local (SQLite) │ Stockage-relais (DTN) │ Dédup & quotas  │
│  Routage opportuniste (inondation bornée + accusés) │ Synchro     │
└──────▲──────────▲───────────▲────────────▲───────────▲───────────┘
       │          │           │            │           │  interface « Transport »
  ┌────┴───┐ ┌────┴───┐ ┌─────┴────┐ ┌─────┴─────┐ ┌───┴──────────┐
  │ BLE    │ │ LAN    │ │ Radio    │ │ Reticulum │ │ Internet     │
  │ GATT   │ │ mDNS + │ │ compagnon│ │ (démon)   │ │ Nostr relais │
  │(natif) │ │ TCP/UDP│ │ Meshtastic│ │           │ │              │
  │        │ │        │ │ MeshCore │ │           │ │              │
  └────────┘ └────────┘ └──────────┘ └───────────┘ └──────┬───────┘
                                                           │ passerelle seulement
                                                  ┌────────┴────────┐
                                                  │ Ponts sociaux   │
                                                  │ Mastodon/Bluesky│
                                                  └─────────────────┘
```

Les transports BLE et Wi-Fi Aware sont **natifs** (Swift / Kotlin) car ils dépendent des API système ; ils remontent des octets au cœur. Tout le reste (logique, crypto, stockage) est dans le cœur partagé, écrit une seule fois.

## 2. Décisions architecturales prioritaires

### ADR-1 — Le prototype web n'est pas le produit
Un prototype web ou PWA ne peut pas faire de Bluetooth sur iPhone ni émettre d'annonces BLE nulle part [C]. **Le prototype Google AI Studio sert à l'interface et à un simulateur de réseau**, branché sur la même interface `Transport` que les vrais adaptateurs. Aucune démonstration du prototype web ne doit être présentée comme « mesh fonctionnel ».

### ADR-2 — Cœur unique en Rust, interfaces natives
- Cœur `meshora-core` en Rust, exposé à Swift et Kotlin via UniFFI, compilable pour Linux ARM (Raspberry Pi) et, en version réduite `no_std`, pour ESP32 plus tard.
- Desktop : Tauri (réutilise le cœur Rust, poids léger) ; BLE desktop via `btleplug` [C, à valider côté périphérique sous Windows].
- Raison : un seul code de crypto et de routage audité, au lieu de trois.

### ADR-3 — Une enveloppe binaire compacte, pas un protocole de routage nouveau
```
Enveloppe MESHORA v0 (CBOR, RFC 8949)
  v        : version (u8)
  id       : 16 octets (hachage BLAKE2b du contenu chiffré) → déduplication
  type     : texte | accusé | annonce | événement Nostr encapsulé | fichier-fragment
  dst      : étiquette de destinataire (16 octets, rotative, voir SECURITY)
  src_sig  : signature Ed25519 de l'émetteur (dans la charge chiffrée pour les messages privés)
  ttl_hops : sauts restants (défaut 7, max 7)
  expire   : horodatage d'expiration (défaut 72 h)
  payload  : charge chiffrée (XChaCha20-Poly1305)
```
- Taille cible : < 200 octets d'en-tête+texte court pour passer dans **un** paquet LoRa ; fragmentation au-delà, refusée sur LoRa.
- Inspiration : Bundle Protocol DTN (RFC 9171) pour le stockage-relais, sans en adopter la complexité.

### ADR-4 — Routage : inondation bornée + stockage-relais, rien de plus au MVP
- Chaque nœud garde les messages non expirés, les transmet à tout nouveau voisin qui ne les a pas (échange de listes d'identifiants compactes), décrémente `ttl_hops`, refuse les doublons.
- Accusés de réception de bout en bout pour arrêter la diffusion.
- Pas de table de routage au MVP : les réseaux visés (dizaines à quelques centaines de nœuds) le supportent ; au-delà, voir ROADMAP (routage par intérêt ou Reticulum).

### ADR-5 — Transports retenus par phase
| Phase | Transports |
|---|---|
| MVP | BLE GATT (Android, iOS), LAN (mDNS/TCP), Internet via Nostr (passerelle ou téléphone connecté) |
| Bêta | Radio compagnon Meshtastic et MeshCore (BLE/USB), desktop, démon passerelle Raspberry Pi |
| Stable | Pont Reticulum, Wi-Fi Aware (si tests positifs), Multipeer (Apple ↔ Apple, gros fichiers) |
| Écarté | Bluetooth Mesh SIG, Wi-Fi Direct, Nearby Connections, cjdns, LoRa direct depuis téléphone |

### ADR-6 — Interopérabilité Bitchat testée avant de figer le format BLE
Si le protocole BLE de Bitchat peut être parlé tel quel (licences le permettent), MESHORA rejoint d'emblée un réseau existant au lieu d'en créer un. Le test E3 (ROADMAP) tranche. Sinon, format MESHORA propre sur un UUID de service distinct.

### ADR-7 — Nostr comme colonne vertébrale Internet
- Quand un nœud a Internet, il publie les enveloppes en attente sous forme d'événements Nostr et récupère celles qui lui sont destinées.
- Messages privés : NIP-17 / NIP-44 / NIP-59 [C] (contrairement à Bitchat, qui utilise un format maison non standard [S]).
- Relais : publics + un relais MESHORA auto-hébergé ; aucun relais n'est obligatoire.
- Identité : la clé Nostr (secp256k1) est **dérivée/liée** à l'identité MESHORA (Ed25519) par une attestation signée — pas de clé unique pour tout.

### ADR-8 — Mastodon et Bluesky : publication déléguée, jamais de stockage des secrets sur des tiers
- Un utilisateur peut marquer un message « à publier ». La première passerelle qui le voit et **qui détient un jeton délégué par cet utilisateur** le publie.
- Par défaut, seule la passerelle personnelle de l'utilisateur (son Pi, son ordinateur) détient ses jetons. Aucune passerelle publique ne publie au nom d'autrui.
- Réutiliser Bridgy Fed pour la fédération croisée plutôt qu'écrire des ponts.

### ADR-9 — Aucune dépendance obligatoire à un fournisseur d'IA ou de cloud
Aucune fonction cœur n'appelle de service externe. Les services optionnels (traduction, résumé) passeront par une interface remplaçable, désactivée par défaut, et pourront tourner en local.

### ADR-10 — Licences
**Décision provisoire (25/10/2026) : option B** — applications sous AGPL-3.0-or-later, contrats et protocole sous licences permissives. Fichiers de licence à finaliser après la vérification des droits et des dépendances (`LICENSING.md` §6–7). La proposition ci-dessous est abandonnée.

Proposition initiale (suspendue) : **spécification sous CC-BY-4.0, cœur et SDK sous Apache-2.0 ou MPL-2.0** (adoption maximale, microcontrôleurs, compatibilité App Store), applications sous la même licence ou GPL-3.0 au choix du porteur. Conséquence : pas d'inclusion de code GPL (Meshtastic, Briar) ou AGPL (forks Reticulum) dans le cœur — uniquement dialogue via leurs API/protocoles.

## 3. Modules et interfaces

| Module | Responsabilité | Interface publique |
|---|---|---|
| `identity` | Clés racine, clés d'appareil, attestations, vérification par QR | `create()`, `export_backup()`, `verify(qr)` |
| `envelope` | Sérialisation CBOR, signature, chiffrement | `seal(msg, to)`, `open(bytes)` |
| `store` | SQLite : messages, file de relais, pairs vus | — |
| `relay` | Dédup, quotas par pair, TTL, expiration, échange d'inventaires | `on_peer(peer)`, `on_bytes(peer, bytes)` |
| `transport` (trait) | Abstraction de chaque support | `start()`, `send(peer, bytes)`, `mtu()`, `cost()`, évènements `peer_up/down`, `bytes_in` |
| `sync-nostr` | Publication / récupération via relais | `flush()`, `pull(since)` |
| `bridge-*` | Meshtastic, MeshCore, Reticulum, Mastodon, Bluesky | adaptateurs `transport` ou `publisher` |
| `sim` | Transport simulé (latence, pertes, partitions) | utilisé par le prototype web et les tests |

Chaque transport déclare son **MTU** et son **coût** (énergie, temps d'antenne). Le relais refuse d'envoyer une pièce jointe sur LoRa, par exemple.

## 4. Rôles de nœuds

| Rôle | Exemples | Disponibilité | Rôle réseau |
|---|---|---|---|
| Terminal | iPhone, montre | Intermittente | Envoie/reçoit, relais opportuniste |
| Relais mobile | Téléphone Android avec service au premier plan | Bonne | Relais BLE continu |
| Relais fixe | ESP32 / nRF52 alimentés, Raspberry Pi | Permanente | Comble la faiblesse iOS en arrière-plan |
| Passerelle | Pi ou ordinateur avec Internet | Permanente | Nostr, ponts sociaux, LoRa, Reticulum |

**Conséquence de conception :** un déploiement fiable (salle, festival, quartier) repose sur **quelques relais fixes**, pas sur la bonne volonté des iPhones en poche.

## 5. Passerelles Internet

### Fonctionnement
1. Un nœud qui obtient Internet (téléphone sur 4G, Pi sur box) devient passerelle **pour les enveloppes qu'il transporte déjà**.
2. Il publie les enveloppes en attente vers 2 à 3 relais Nostr (dont un auto-hébergé), et récupère celles qui visent les étiquettes de destinataire de ses contacts et des messages publics suivis.
3. Il réinjecte dans le mesh local ce qu'il a récupéré.

### Limites (à afficher, pas à cacher)
| Limite | Effet |
|---|---|
| Latence imprévisible | Un message peut mettre des heures si personne ne passe par une zone connectée |
| Portails captifs, réseaux filtrés | La passerelle peut croire être en ligne sans l'être ; vérifier la joignabilité réelle d'un relais |
| Coupure ou censure d'Internet | Les relais Nostr peuvent être bloqués ; multiplier les relais, permettre des relais en IP directe ou via Tor plus tard |
| Débit asymétrique | Une passerelle LoRa ne peut pas réinjecter un flux Internet volumineux : filtrage par priorité (contacts vérifiés, messages directs) |
| Confiance | Une passerelle voit les étiquettes et les volumes ; elle ne lit pas les contenus privés |
| Coût des données mobiles | Option « passerelle seulement en Wi-Fi » par défaut sur téléphone |
| Spam entrant | Filtrage : seuls les messages de contacts ou de canaux suivis descendent dans le mesh |

## 6. Stratégie Mastodon, Bluesky et Nostr

| Réseau | Rôle pour MESHORA | Identité | Lecture | Écriture | Priorité |
|---|---|---|---|---|---|
| **Nostr** | Colonne vertébrale de synchro | Clé liée à l'identité MESHORA, sans serveur | Oui (abonnements filtrés) | Oui, par n'importe quelle passerelle (événement déjà signé) | MVP |
| **Mastodon** | Publication publique et réception de mentions | Compte existant de l'utilisateur (OAuth) | Bêta : mentions et messages directs vers la passerelle personnelle | Oui, par la passerelle personnelle uniquement | Bêta |
| **Bluesky** | Publication publique | Compte existant (OAuth ou mot de passe d'application) | Plus tard | Oui, par la passerelle personnelle uniquement | Bêta |
| **Ponts croisés** | Ne pas les réécrire | — | — | Bridgy Fed (ActivityPub ↔ Bluesky) ; ponts Nostr ↔ ActivityPub existants à évaluer [C] | — |

Principe : **MESHORA transporte, il ne remplace pas.** Un message rédigé hors ligne au festival peut finir sur le compte Mastodon de l'auteur quand sa passerelle personnelle le voit passer. Les messages privés ne sortent jamais vers Mastodon ou Bluesky (pas de chiffrement de bout en bout adapté) ; ils restent dans MESHORA/Nostr.

## 7. Modules complémentaires

- **Shield** (VPN WireGuard personnel, DNS chiffré, Tor optionnel) : voir `SHIELD-SECURITY-AUDIT.md`. Indépendant du mesh, optionnel, activé avec consentement.
- **Resilience** (détection de pannes, basculement, états de message, passerelles signées, fichiers, cartes hors ligne, alertes, indicateurs honnêtes) : voir `RESILIENCE.md`, qui contient aussi le **contrat d'interface TypeScript** que le prototype doit respecter.
- **Nearby** (découverte privée des contacts proches, identifiants tournants, appairage de relais, anti-pistage) : voir `NEARBY.md`. Chantier prioritaire du pilier Mesh.
- L'état réel de chaque fonction est tenu dans `STATUS.md`.

## 8. Consignes pour le prototype Google AI Studio

1. Coder l'interface contre une interface `Transport` simulée identique au §3.
2. Afficher en clair l'état réel de chaque transport (« BLE indisponible dans le navigateur »).
3. Ne pas implémenter de crypto dans le prototype ; simuler l'état « vérifié / non vérifié ».
4. Travailler sur sa propre branche (`ai-studio/*`) ; la documentation vit sur `docs/*`.
