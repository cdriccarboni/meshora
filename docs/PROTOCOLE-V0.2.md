# Protocole MESHORA V0.2 — format commun web, Android et relais

> Spécification **descriptive** de ce qui est implémenté et testé (web `prototype/src`, Android `android/app`, relais `tools/relay/server.js` et relais de référence `relay/cloudflare`, conformité vérifiée par `tools/audit/relay-conformance.ts`). Toute modification doit garder les trois implémentations alignées et passer `tools/audit/interop-android.sh`.

## 1. Identité

| Élément | Valeur |
|---|---|
| Paire de clés | ECDSA P-256 (secp256r1) ; la même paire sert à l'ECDH (limite connue, voir §6) |
| Clé publique | SPKI DER, en hexadécimal minuscule (`publicKeyHex`) |
| Empreinte | 32 premiers caractères hex de SHA-256(SPKI), par blocs de 4 séparés par `:` |
| Identifiant | `msh_` + 12 premiers caractères hex de SHA-256(SPKI) (48 bits) |
| Signature | ECDSA P-256 / SHA-256, format **IEEE P1363** (r‖s, 64 octets), en hex |

## 2. Enveloppe chiffrée

```
{ id, senderPublicKeyHex, recipientPublicKeyHex, ephemeralPublicKeyHex, ivHex, ciphertextHex, signatureHex, timestamp }
```
- Clé éphémère P-256 → ECDH avec la clé du destinataire → secret de 32 octets utilisé **directement** comme clé AES-256-GCM (IV 12 octets, étiquette 128 bits).
- Signature de l'expéditeur sur la chaîne UTF-8 : `id|senderPublicKeyHex|recipientPublicKeyHex|ephemeralPublicKeyHex|ivHex|ciphertextHex|timestamp`.
- Le destinataire vérifie la signature **avant** de déchiffrer. Un message de salon = une enveloppe par destinataire.

## 3. Accusé de réception signé (version 2)

```
SignedAck { messageId, senderPublicKeyHex, recipientPublicKeyHex, envelopeHash, timestamp, signatureHex }
```
- `envelopeHash` = SHA-256 (hex) de la chaîne UTF-8 `envelope.signatureHex` (la signature couvre tous les champs de l'enveloppe).
- Signature du destinataire sur `ACK2|messageId|senderPublicKeyHex|recipientPublicKeyHex|envelopeHash|timestamp`.
- **Règle « Délivré »** : l'expéditeur n'accepte l'accusé que si `senderPublicKeyHex` est sa propre clé, si `envelopeHash` est l'empreinte d'une enveloppe qu'il a **réellement émise** pour ce message, vers ce `recipientPublicKeyHex`, et si la signature est valide.
- Le destinataire identifie un message reçu par **(expéditeur, identifiant)** : un tiers qui réutilise un identifiant ne peut ni faire écarter le vrai message ni le faire passer à « Délivré » (banc T11). Il réémet l'accusé à chaque réception valide, au plus une fois par 30 s et par message.

## 4. Relais WebSocket (`wss://`, ou `ws://` en local)

| Sens | Paquet | Contenu |
|---|---|---|
| relais → client | `MESHORA_CHALLENGE` | `{nonce (32 hex), room}` dès l'ouverture |
| client → relais | `MESHORA_HELLO` | `{senderId, senderAlias, publicKey, helloSignature}` ; signature de `MESHORA-HELLO|v1|<room>|<nonce>|<publicKeyHex>` ; `senderId` doit valoir l'identifiant dérivé ; sinon fermeture 1008 |
| relais → clients du salon | `MESHORA_PEERS` | `{peers:[{id, alias, publicKey, verified:false}]}` ; chaque client revérifie `id` = identifiant dérivé de `publicKey` |
| client ↔ relais | `MESHORA_ENVELOPE` | `{envelope}` ; le relais exige `senderPublicKeyHex` = clé authentifiée de la connexion, remet au(x) client(s) de `recipientPublicKeyHex` ou met en boîte aux lettres (24 h, 50/destinataire, 1000/salon, mémoire vive ; un renvoi de même expéditeur et même identifiant remplace la copie en attente) |
| client ↔ relais | `MESHORA_ACK` | `{ack:{messageId, recipientId, timestamp, transport, signedAck}}` ; le relais exige `signedAck.recipientPublicKeyHex` = clé authentifiée et ne remet l'accusé **qu'aux connexions de `signedAck.senderPublicKeyHex`** |

Refusé : `MESHORA_MSG` (texte en clair), trames non masquées, fragmentées ou > 256 Kio, Origin hors liste blanche, > 60 paquets / 10 s. Salon : `[A-Za-z0-9_-]{1,64}`.

## 5. États d'un message (expéditeur)

`QUEUED`/`queued` (dans l'Outbox, non émis) → `SENT`/`sent` (au moins une enveloppe acceptée par un transport) → `DELIVERED`/`delivered` (accusé signé valide, §3). Les messages `QUEUED` et `SENT` restent dans l'Outbox. Renvoi avec attente progressive par message (15 s, 30 s, 1 min… plafonnée à 10 min), au plus 20 messages par passe ; renvoi immédiat quand le destinataire (re)devient présent. Le destinataire déduplique par (expéditeur, `id`).

## 4 bis. Passerelle par les voisins (V0.4, relais `meshora-relay-dev` uniquement)

| Sens | Paquet | Contenu |
|---|---|---|
| client → relais | `MESHORA_FORWARD` | `{envelope}` ou `{signedAck}` d'un **tiers** (voisin Bluetooth sans Internet). Le relais vérifie lui-même la signature de l'auteur (chaîne §2) ou du destinataire (chaîne §3) ; enveloppe acceptée si horodatée entre −48 h et +10 min ; puis même acheminement que `MESHORA_ENVELOPE` / `MESHORA_ACK` |
| client → relais | `MESHORA_SERVE` | `{delegation:{publicKey, gateway, alias, timestamp, signature}}` : le détenteur de `publicKey` autorise la connexion `gateway` (= clé authentifiée de l'émetteur) à recevoir son courrier dans ce salon. Signature de `MESHORA-DELEGATE|v1|<salon>|<publicKey>|<gateway>|<timestamp>`, âge ≤ 10 min, validité 15 min renouvelable, 16 clés servies au plus par connexion. La boîte aux lettres de `publicKey` est remise à la passerelle ; le membre est annoncé dans `MESHORA_PEERS` avec `viaGateway` |

Bluetooth : annonce signée `MESHORA-ANNOUNCE|v1g|…` pour une passerelle active ; délégation dans une trame scellée de type intérieur `DELEGATE` (5). Le courrier reste chiffré pour le destinataire : la passerelle ne le lit pas.

## 5 bis. Invitations et groupes (V0.3)

- **Groupe** = salon du relais. Chaque appareil crée au premier lancement un code aléatoire `g` + 12 caractères (alphabet sans 0/o/1/l, 60 bits) ; plus de salon public par défaut.
- **Lien d'invitation** : `https://<site>/app/#join=<groupe>&k=<clé publique SPKI hex>&n=<nom>[&r=<relais wss>]` ou `meshora://join#…` (application Android). Paramètres dans le **fragment** : jamais transmis au serveur du site. `r` n'apparaît que si l'invitant n'utilise pas le relais de référence ; seul `wss://` est accepté (ou `ws://` local d'essai).
- **Acceptation** : confirmation explicite ; l'invitant devient un contact **vérifié** (sa clé a voyagé hors du relais). Un pair annoncé par le relais n'est « vérifié » que si sa clé est identique à une clé reçue par invitation : un relais malveillant ne peut pas substituer la clé d'un contact vérifié, il ne peut qu'ajouter un pair non vérifié.
- **Relais de référence** : Android et web s'y connectent sans saisie (`BuildConfig.DEFAULT_RELAY_URL`, `DEFAULT_RELAY_URL` côté web) ; un autre relais peut être choisi dans les réglages avancés.
- **Clés publiques** : tout point hors de la courbe P-256 est rejeté (WebCrypto, relais, et Android depuis la V0.3).

## 6. Limites connues (à traiter avant tout usage réel)

1. Pas de KDF (HKDF) sur le secret ECDH ; même paire de clés pour ECDSA et ECDH.
2. Vérification hors bande **seulement par invitation** (V0.3) : pour un pair rencontré dans le groupe sans invitation, un relais malveillant peut substituer la clé.
3. Identifiant de 48 bits.
4. Pas de confidentialité persistante côté expéditeur, pas de rembourrage des tailles.
5. Le relais voit adresses IP, horaires, tailles, clés publiques et salons.
6. Bluetooth LE : implémenté à titre **expérimental**, non testé entre téléphones (docs/MESH-NATIF-V0.3.md, docs/BLUETOOTH-V0.3.md) ; Wi-Fi Direct non implémenté.
7. Un groupe = un salon : un appareil n'est que dans un groupe à la fois (V0.3).
