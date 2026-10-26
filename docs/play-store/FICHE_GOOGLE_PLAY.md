# MESHORA — Fiche de Présentation Google Play (Bêta Fermée)

## Métadonnées Générales

- **Nom de l'application :** MESHORA
- **Catégorie :** Communication / Outils
- **Type :** Application gratuite (aucun achat intégré, aucune publicité)
- **Classification du contenu :** PEGI 3 / Tout public
- **Package ID :** `org.meshora.app`
- **Version :** `0.2.0-beta` (versionCode `2`)
- **Contact support :** `support@meshora.org`

---

## Fiche en Français (FR)

### Titre (max 30 caractères)
MESHORA : Messagerie Résiliente

### Description courte (max 80 caractères)
Messagerie chiffrée de bout en bout et réseau maillé civil résilient décentralisé.

### Description complète (max 4000 caractères)
MESHORA est une infrastructure de communication civile libre, souveraine et conçue pour maintenir les échanges humains essentiels même en cas de panne de réseau centralisé ou de situation de crise.

Cette version Bêta Fermée (V0.2) permet de tester sur appareils Android natifs les fondations techniques du protocole :

1. CHIFFREMENT DE BOUT EN BOUT SOUVERAIN (E2EE)
- Génération locale de paires de clés asymétriques ECDSA P-256 (NIST).
- Dérivation éphémère de clés de session ECDH + chiffrement symétrique AES-256-GCM.
- Empreinte cryptographique vérifiable (SHA-256) pour authentifier vos contacts.
- Zéro texte en clair et zéro métadonnée indiscrète sur le fil réseau.

2. RÈGLE DE VÉRITÉ & ACCUSÉS DE RÉCEPTION SIGNÉS
- Statut d'acheminement strict : « En attente (Outbox) », « Émis », « Délivré ».
- Un message n'est marqué « Délivré » QUE lorsqu'un accusé de réception signé par la clé privée du destinataire est cryptographiquement vérifié par l'expéditeur.
- Rétention systématique dans l'Outbox locale en cas de coupure de réseau.

3. TRANSPORTS RÉSEAU RÉELS & HYBRIDES
- Relais WebSocket aveugle pour échanges directs et multi-appareils (Mac, Android, navigateurs).
- Architecture native Bluetooth LE (Service standardisé 0xFE60) en cours de validation pour le maillage physique direct hors-Internet.

4. VIE PRIVÉE ABSOLUE & ZÉRO TRACKING
- Aucun compte utilisateur obligatoire, aucun numéro de téléphone, aucune adresse e-mail exigée.
- Zéro régie publicitaire, zéro SDK de pistage, zéro analyse comportementale.
- Données chiffrées stockées exclusivement sur votre téléphone.

AVERTISSEMENT VITAL ET RÉGLEMENTAIRE :
MESHORA est un réseau d'entraide civil décentralisé. En cas d'urgence médicale ou de détresse vitale immédiate, composez toujours le 112 ou le 15 par téléphone cellulaire ou satellite.

---

## Fiche en Anglais (EN)

### Title (max 30 characters)
MESHORA: Resilient Mesh Chat

### Short description (max 80 characters)
End-to-end encrypted messaging and decentralized civil mesh communication network.

### Full description (max 4000 characters)
MESHORA is an open, sovereign civil communication platform engineered to preserve vital human connections during infrastructure disruptions or network blackouts.

This Closed Beta release (V0.2) brings native Kotlin and Jetpack Compose performance to Android devices:

- True End-to-End Encryption (ECDSA P-256, ECDH, AES-256-GCM).
- Cryptographically signed delivery acknowledgments (SignedAck).
- Offline-first Outbox retention queue.
- Hybrid transport architecture (WebSocket relay + native Bluetooth LE GATT 0xFE60).
- Zero user accounts, zero ads, zero telemetry trackers.
