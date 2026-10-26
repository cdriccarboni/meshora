# Journal des versions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · versions : [SemVer](https://semver.org/lang/fr/).

## [0.3.0-preview] — non publié
### Ajouté
- Page « Découvrir » : schéma SVG accessible et adaptatif (téléphones, ordinateur, relais, montre, routeur, mini-PC, relais communautaires) distinguant vérifié / en développement / vision future, avec légende et lecture en texte.
- Page « Installer » : application Android d'essai 0.2.1-beta (lien vérifié : provenance, version, empreinte, certificat), version d'essai Bluetooth pour testeurs, application web, iPhone prévu.
- Application web : liaison Bluetooth navigateur ↔ téléphone Android (Web Bluetooth, alpha).
### Modifié
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
