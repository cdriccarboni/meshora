# Site public MESHORA

Sources du site publié sur Cloudflare Pages. Exigences : `docs/PUBLICATION.md`. Design : `docs/DESIGN.md`.

```
site/
  pages/*.html         contenu de chaque page (métadonnées JSON en tête, FR et EN)
  assets/              style, script (partage, installation), logo, icônes, image de partage
  app-placeholder/     page d'attente servie sous /app tant que le prototype n'est pas intégré
  releases.json        versions natives réellement publiées (vide : aucun lien de téléchargement)
  manifest.webmanifest, _headers, _redirects
```

Construction : `SITE_URL=https://… MESHORA_CHANNEL=preview python3 scripts/build_site.py` → `dist/`.
La construction échoue en cas de lien interne cassé, de secret détecté ou de lien de téléchargement non publié.
