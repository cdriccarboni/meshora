# Protocole MESHORA V0.4 — proposition : séparation des clés, HKDF, confidentialité persistante

> **Statut (27/10/2026) : étape A IMPLÉMENTÉE sur la branche `claude/v0.4-prekeys` (web, Android, relais Node et Cloudflare), non intégrée, non déployée.** Étapes B et C : propositions. Spécification exacte de l'étape A : §6.
>
> Statut initial : proposition. Corrige les limites 1 et 4 de `docs/PROTOCOLE-V0.2.md` §6, seul retard de sécurité notable de MESHORA face à Bitchat (`docs/audits/BITCHAT-VS-MESHORA-V0.3.md`). Doit rester compatible avec WebCrypto (navigateurs, iPhone par Safari) : P-256, ECDSA, ECDH, HKDF, AES-GCM — pas de X25519 imposé.

## 1. Problème aujourd'hui (V0.2/V0.3)

| Limite | Conséquence concrète |
|---|---|
| Le secret ECDH est utilisé **directement** comme clé AES (pas de HKDF) | Pas de séparation de domaine ; pratique déconseillée (NIST SP 800-56C) |
| **Même paire de clés** pour signer (ECDSA) et déchiffrer (ECDH) | Une faiblesse de l'un touche l'autre ; impossible de faire tourner la clé de chiffrement sans changer d'identité |
| Clé de **destinataire statique** | Si la clé privée d'un téléphone est volée, **tous les messages passés captés** (relais, radio) qui lui étaient destinés deviennent lisibles. L'expéditeur, lui, utilise déjà une clé éphémère |

## 2. Proposition par étapes

### Étape A — V0.4 (petite, testable, compatible)
1. **Clé d'identité** (ECDSA P-256) : ne sert plus qu'à signer. Inchangée → identifiants, contacts vérifiés et invitations restent valides.
2. **Clés de réception tournantes** (« prékeys » ECDH P-256) : une nouvelle paire chaque semaine, **signée par la clé d'identité** :
   `PREKEY|v1|<clé d'identité>|<prékey publique>|<id>|<valide jusqu'au>`.
   Publiée : dans le HELLO au relais (le relais la redistribue dans `MESHORA_PEERS`), dans l'annonce Bluetooth scellée, et dans le lien d'invitation (champ optionnel `p=`).
3. **Enveloppe v3** : `ECDH(éphémère, prékey du destinataire)` → **HKDF-SHA256** (sel = 32 octets aléatoires transmis, info = `MESHORA-ENV|v3|<expéditeur>|<destinataire>|<id prékey>`) → clé AES-256-GCM. Champs ajoutés : `v: 3`, `prekeyId`, `saltHex`. La signature de l'expéditeur couvre aussi ces champs.
4. **Effacement** des prékeys privées 7 jours après leur échéance (délai de grâce pour le courrier différé de 24 h et les téléphones restés hors ligne) — voir §6 pour les durées retenues.
5. **Négociation** : on n'envoie une enveloppe v3 que si l'on connaît une prékey valide du destinataire ; sinon v2 (comme aujourd'hui). Les anciennes versions ignorent proprement les champs inconnus. Le relais n'a **rien à changer** pour les enveloppes (il ne les lit pas) ; il relaie seulement la prékey dans la liste des pairs.

**Gain** : confidentialité persistante **à la semaine** — le vol d'un téléphone ne révèle plus les messages v3 captés plus de ~2 semaines avant (au plus 15 jours : 8 jours de validité + 7 jours de grâce). Coût : quelques centaines de lignes par plateforme, vecteurs de test communs (comme `group-seal-vectors.json`).

### Étape B — V0.5 : double cliquet pour les conversations à deux
Après le premier message (étape A), dérivation d'une clé par message (« Double Ratchet », spécification publique de Signal, réimplémentée — pas de code copié) : confidentialité persistante **par message** et récupération après compromission. Difficulté : messages hors ordre et différés (fenêtre de clés sautées bornée), multi-appareils.

### Étape C — plus tard : groupes
Pour des groupes nombreux, étudier **MLS (RFC 9420)** plutôt que d'inventer : arbre de clés, ajout/retrait de membres avec confidentialité persistante. Bibliothèques existantes (OpenMLS, Rust/Apache-2.0/MIT) : coût d'intégration Android + web (WebAssembly) à évaluer.

## 3. Ce qui ne change pas
Identité, empreintes, invitations, accusés v2 (signés par la clé d'identité), relais, scellement Bluetooth, passerelle.

## 4. Essais exigés avant d'activer l'étape A
- Vecteurs HKDF/enveloppe v3 identiques Python / Kotlin / TypeScript.
- Interopérabilité v2 ↔ v3 (ancien client ↔ nouveau) sur le relais réel.
- Rotation simulée (horloge avancée) : un message chiffré pour une prékey effacée n'est plus déchiffrable ; un message reçu dans le délai de grâce l'est.
- Courrier différé 24 h et passerelle Bluetooth avec enveloppes v3.

## 5. Décision demandée
Valider l'étape A pour la V0.4 (recommandé), et le principe des étapes B et C.

## 6. Spécification de l'étape A (implémentée)

Durées : nouvelle prékey tous les **7 jours** ; échéance annoncée **8 jours** après sa création ; clé privée **effacée 7 jours après l'échéance** ; une prékey annoncée n'est acceptée que si son échéance est future et à moins de 30 jours.

| Élément | Format |
|---|---|
| Prékey | `{publicKeyHex (SPKI P-256, 91 octets), id, expiresAt, signatureHex}` |
| `id` | 16 premiers caractères hex du SHA-256 de la prékey SPKI |
| Chaîne signée (clé d'identité) | `PREKEY\|v1\|<identité>\|<prékey>\|<id>\|<expiresAt>` |
| Enveloppe v3 | champs v2 + `v: 3`, `prekeyId`, `saltHex` (32 octets aléatoires) |
| Clé de message | `HKDF-SHA256(ikm = ECDH(éphémère, prékey) [32 octets], sel = saltHex, info = "MESHORA-ENV\|v3\|<expéditeur>\|<destinataire>\|<prekeyId>")` → AES-256-GCM, IV 12 octets |
| Chaîne signée (expéditeur) | `ENV3\|id\|expéditeur\|destinataire\|prekeyId\|éphémère\|sel\|iv\|chiffré\|horodatage` |
| Accusé | inchangé (ACK2 ; empreinte = SHA-256 de la signature de l'enveloppe) |

Distribution :
- **Relais** : champ `prekey` du `MESHORA_HELLO`. Le relais le **vérifie** (forme, identifiant, signature, échéance) et l'ajoute à l'entrée du pair dans `MESHORA_PEERS`. Une prékey invalide est ignorée sans fermer la connexion. `MESHORA_PREKEY {prekey}` sert à la rotation sans reconnexion ; une prékey plus ancienne est refusée.
- **Passerelle** : champ `prekey` facultatif de `MESHORA_SERVE` (prékey du déléguant) ; `MESHORA_FORWARD` vérifie aussi les signatures `ENV3`.
- **Bluetooth (Android)** : champ `prekey` dans une annonce sur trois et dans la délégation, à l'intérieur de la trame scellée.

Règles des clients :
- Une enveloppe v3 n'est écrite que vers une identité dont une prékey **vérifiée et non échue** est connue ; sinon v2. Une prékey vue est gardée jusqu'à son échéance, sans jamais revenir à une plus ancienne.
- Annoncer une prékey vaut déclaration « je sais lire le v3 » : un ancien client n'en annonce pas et continue de recevoir du v2.
- Un ancien client qui reçoit du v3 le rejette (signature v2 invalide) : aucun accusé, le message reste « Envoyé », pas « Délivré ».

Effacement d'urgence : supprime aussi les prékeys (web : stockage local ; Android : préférences `meshora_prekeys` + clé d'emballage du magasin de clés).

### Limites connues de l'étape A
- **Repli imposé** : un relais malveillant peut retirer les prékeys de `MESHORA_PEERS` pour forcer le v2. Atténuation : une prékey déjà connue reste utilisée jusqu'à son échéance (pas seulement tant que le relais l'annonce).
- Les messages **v2** (anciens clients, ou expéditeur sans prékey connue) restent lisibles avec la clé d'identité, comme aujourd'hui.
- Web : les prékeys privées sont dans le stockage local du navigateur, comme la clé d'identité (pas de magasin matériel). Android : chiffrées par le magasin de clés.
- Pas encore de champ `p=` dans les invitations : la première conversation passe par le relais ou le Bluetooth pour apprendre la prékey.
- La confidentialité persistante est **hebdomadaire**, pas par message (étape B).

### Essais (27/10/2026, sans le Mac)

| Essai | Résultat |
|---|---|
| Vecteurs Python → TypeScript (`prototype/tests/prekey.test.ts`) | 33/33, avec rotation et effacement simulés |
| Vecteurs Python → Kotlin, et Kotlin → TypeScript (compilateur Kotlin 2.0.21) | 12/12 et 1/1 (`docs/tests/v0.4/android-crypto-v3-kotlinc.log`) |
| Compilation de `TransportManager`, `WebSocketTransport`, `PrekeyStore`, crypto et maillage | sans erreur (okhttp et Android remplacés par des bouchons) |
| Conformité du relais Node, avec C17 (prékeys et vrai code web en v3) | 17/17 |
| Vrai code du relais Cloudflare exécuté hors wrangler | 11/11 (dont 16 clés servies avec prékeys : pièce jointe ≤ 11,8 Kio sur 16 Kio) |
| **À faire sur le Mac** | tests unitaires Android (`PrekeyTest`, `GatewayInteropTest`, `LiveRelayInteropTest` avec v3 réel), `wrangler dev` + conformité 17/17, relais dev, APK |
