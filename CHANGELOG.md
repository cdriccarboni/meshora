# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · versions : [SemVer](https://semver.org/lang/fr/).

## [0.4.0-dev] — non publié (branche `claude/v0.4-suite`)
### Ajouté
- **Effacement d'urgence** : Android (écran Identité, confirmation obligatoire ; destruction de la clé d'emballage du magasin de clés Android, des préférences, du cache, puis `clearApplicationUserData`) et web (Paramètres ; stockage local, IndexedDB, caches, service worker). Nouvelle identité au redémarrage.
- **Passerelle Internet par les voisins Bluetooth** (expérimental, désactivée par défaut) : un téléphone sans Internet délègue sa réception à un voisin connecté (délégation signée, 10 min, liée au groupe et à la passerelle) ; le relais vérifie lui-même les signatures des enveloppes et accusés transmis (`MESHORA_FORWARD`, `MESHORA_SERVE`). La passerelle ne lit rien.
- Banc de conformité du relais : 16 vérifications (C14 à C16 pour la passerelle) ; relais de développement séparé `meshora-relay-dev`.
- **Confidentialité persistante, étape A** (branche `claude/v0.4-prekeys`) : prékeys de réception signées, tournant chaque semaine, effacées 7 jours après leur échéance ; enveloppe v3 (ECDH vers la prékey + HKDF-SHA256 + AES-256-GCM) sur web, Android et relais ; repli v2 automatique vers les anciens clients. Spécification : `docs/PROTOCOLE-V0.4-PROPOSITION.md` §6. Étapes B (double cliquet) et C (MLS) : propositions.
### Corrigé
- Les rapports d'essai `docs/tests/**/*.log` cités comme preuves étaient exclus par `.gitignore` et n'avaient jamais été publiés ; ils sont désormais versionnés (ceux produits sur le Mac restent à ajouter).

## [0.3.0-preview] — non publié
### Ajouté
- **Relais de référence** sur Cloudflare Workers + Durable Objects (`relay/cloudflare`), préproduction : adresse stable, sans compte, boîte aux lettres persistante 24 h, limites de débit, aucune journalisation ; banc de conformité `tools/audit/relay-conformance.ts` (13 vérifications).
- **Android 0.3.0-beta1** : connexion automatique, invitations par QR code et lien, contacts vérifiés, discussions par personne, interface anglais/français, erreurs compréhensibles, clé privée chiffrée par le magasin de clés Android.
- **Application web** : connexion automatique, groupe privé par navigateur, invitations `#join=`.
- Page « Découvrir » : schéma SVG accessible et adaptatif (téléphones, ordinateur, relais, montre, routeur, mini-PC, relais communautaires) distinguant vérifié / en développement / vision future, avec légende et lecture en texte.
- Page « Installer » : application Android d'essai 0.2.1-beta (lien vérifié : provenance, version, empreinte, certificat), version d'essai Bluetooth pour testeurs, application web, iPhone prévu.
- Application web : liaison Bluetooth navigateur ↔ téléphone Android (Web Bluetooth, alpha).
### Sécurité
- Bluetooth : trames scellées par la clé du groupe (AES-256-GCM, clé journalière HKDF) — plus de nom, de clé publique ni de type de message lisibles hors du groupe ; identifiants de trame non reliables (Android 0.3.0-beta2, web).
- Web sur Android : invitation par bandeau « Ouvrir dans l'application » (geste réel) au lieu d'une redirection bloquée par Chrome.
- Android : rejet des clés publiques hors de la courbe P-256 (le KeyFactory Java ne le vérifiait pas).
- Bluetooth : avertissement explicite — les appareils proches voient le nom affiché et la clé publique.
### Modifié
- Page Installer : APK 0.3.0-beta1 « en validation », plus d'adresse de relais à saisir.
- Textes du site alignés sur l'état réel (messagerie par Internet vérifiée le 26/10/2026 ; Bluetooth en essai ; plus de promesses non démontrées).

## [0.2.0-preview] — non publié
### Modifié
- Identité visuelle alignée sur le logo officiel du prototype V0.2 (Google AI Studio) : symbole, favicon (variante petite taille), icônes PWA, image de partage, palette `#121316` / `#60A5FA`, police Plus Jakarta Sans.
### Ajouté
- Contrôle de construction : toute fonction de détresse (SOS) dans `/app` bloque la publication sans validation explicite.
- `docs/LICENSING.md` : analyse AGPL-3.0-or-later et compatibilité.

## [0.1.0-preview] — non publié
### Ajouté
- Site public bilingue : accueil, Découvrir, Installer, État réel, Confidentialité.
- Logo orbital, favicon, icônes PWA, image de partage.
- Construction vérifiée (`scripts/build_site.py`) : liens internes, absence de secrets, aucun lien de téléchargement non publié.
- Emplacement réservé `/app` pour la démo de l'interface (Google AI Studio).
