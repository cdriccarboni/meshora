# Site MESHORA (structure bilingue)

Pages statiques, sans dépendance de build, conformes à `docs/DESIGN.md`.

```
site/
  index.html              redirection selon la langue du navigateur
  assets/logo.svg         logo orbital (clair/sombre automatique)
  assets/meshora.css      jetons de couleur, typographie, composants
  fr/decouvrir/           Découvrir
  fr/installer/           Installer
  en/discover/            Discover
  en/install/             Install
```

Règles :
- Toute page existe en FR et en EN, reliées par `hreflang`.
- La page Installer n'affiche un lien de téléchargement que pour une version marquée ✅ dans `docs/STATUS.md`.
- Ce dossier est indépendant du prototype Google AI Studio : celui-ci garde son propre dossier et ses propres branches.
