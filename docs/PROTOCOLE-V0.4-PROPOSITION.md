# Protocole MESHORA V0.4 — proposition : séparation des clés, HKDF, confidentialité persistante

> **Statut : proposition à valider, non implémentée.** Corrige les limites 1 et 4 de `docs/PROTOCOLE-V0.2.md` §6, seul retard de sécurité notable de MESHORA face à Bitchat (`docs/audits/BITCHAT-VS-MESHORA-V0.3.md`). Doit rester compatible avec WebCrypto (navigateurs, iPhone par Safari) : P-256, ECDSA, ECDH, HKDF, AES-GCM — pas de X25519 imposé.

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
4. **Effacement** des prékeys privées 14 jours après leur expiration (délai de grâce pour le courrier différé de 24 h et les téléphones restés hors ligne).
5. **Négociation** : on n'envoie une enveloppe v3 que si l'on connaît une prékey valide du destinataire ; sinon v2 (comme aujourd'hui). Les anciennes versions ignorent proprement les champs inconnus. Le relais n'a **rien à changer** pour les enveloppes (il ne les lit pas) ; il relaie seulement la prékey dans la liste des pairs.

**Gain** : confidentialité persistante **à la semaine** — le vol d'un téléphone ne révèle plus les messages captés plus de ~3 semaines avant. Coût : quelques centaines de lignes par plateforme, vecteurs de test communs (comme `group-seal-vectors.json`).

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
