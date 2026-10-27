# MESHORA V0.2 — PASSATION ANTIGRAVITY

Dossier Mac M4 : `/Users/cedriccarboni/Projets/MESHORA`
Dépôt : `cdriccarboni/meshora` (privé). GitHub est la source de vérité.

## Mission
- Lire `docs/COORDINATION.md` et `docs/PUBLICATION.md` sur les branches Claude.
- Intégrer ce prototype Google AI Studio V0.2 dans `prototype/` sur une branche dédiée `ai-studio/prototype-v0`, sans toucher à `main`, PR #1 ou PR #2.
- Préserver le logo officiel Google AI Studio : `src/components/OrbitalLogo.tsx` et `public/icon.svg`.
- Faire fonctionner `/app` sur une prévisualisation Cloudflare existante, sans créer un deuxième projet Pages.
- Exécuter `npm install` (après inspection des scripts/dépendances), `npm run lint`, `npm test`, `npm run build` et documenter les résultats. Ne pas prétendre les avoir exécutés sans preuves.
- Tester réellement entre deux navigateurs/appareils, puis sur Android ↔ iPhone. Distinguer simulations et transports réels.

## Différences notables V0.2
Ajouts : `OfflineMapViewer`, `DynamicMapMarker`, `EmergencyBroadcastPanel`, `QuickSOSButton`, `offlineRouter`, `audioAlert`.
Fichiers modifiés : résilience, transports, traductions, tests, package et docs.
Le `bun.lock` présent dans l'archive antérieure n'est plus inclus.

## Vigilance
Ne pas présenter un bouton SOS comme un appel d'urgence garanti, ni une carte en cache comme des données géographiques validées.
Aucun message Bluetooth inter-téléphones n'est confirmé par le ZIP.
Licence du prototype : AGPL-3.0-or-later, à concilier avec les décisions de Claude.
Pas de merge ni déploiement public sans accord.
