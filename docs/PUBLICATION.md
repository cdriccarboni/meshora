# MESHORA — Exigences de publication web

> Version 0.1 — 25 octobre 2026. Responsable : Claude (architecture, sécurité, cohérence).
> Objectif : une personne reçoit un lien MESHORA, découvre l'outil, l'essaie et peut l'installer facilement — **sans jamais être induite en erreur sur ce qui fonctionne réellement**.

## 1. Répartition des rôles

| Rôle | Agent | Livrables |
|---|---|---|
| Architecture, contrats, sécurité, cohérence | **Claude** | Ce document, `contracts/`, contenu et structure de `site/`, script de construction et ses contrôles (`scripts/build_site.py`), revue des PR |
| Intégration, tests, préparation Cloudflare | **Antigravity** | Projet Cloudflare Pages, domaine, CI, tests de bout en bout, intégration du ZIP AI Studio dans `/app` |
| Interface et prototype | **Google AI Studio** | Application web servie sous `/app` |
| Décision | **Porteur du projet** | Validation des aperçus, fusions, mise en production |

Aucun agent ne développe ce qu'un autre a en charge. Si un livrable manque, on le signale dans la PR plutôt que de le recréer.

## 2. Structure publique

| Chemin | Contenu | Source |
|---|---|---|
| `/` | Accueil (FR) | `site/pages/fr-home.html` |
| `/en/` | Home (EN) | `site/pages/en-home.html` |
| `/fr/decouvrir/`, `/en/discover/` | Découvrir / Discover | `site/pages/` |
| `/fr/installer/`, `/en/install/` | Installer / Install | `site/pages/` |
| `/fr/etat/`, `/en/status/` | État réel des fonctions, généré depuis `docs/STATUS.md` | script de construction |
| `/app/` | Application web (prototype AI Studio). **Réservé** : page d'attente tant que le ZIP n'est pas intégré | AI Studio, intégré par Antigravity |
| `/version.json` | Version, date et commit de construction | script de construction |
| `/manifest.webmanifest`, `/assets/icons/` | PWA | `site/` |
| `/robots.txt`, `/sitemap.xml` | Référencement | script de construction |

Le dépôt GitHub restant **privé**, le site ne renvoie jamais vers des pages GitHub : la documentation publique est servie sur le site lui-même.

## 3. Règles de contenu (bloquantes)

1. **Pas de lien de téléchargement** pour une application qui n'est pas réellement publiée sur un store ou en version signée. Le fichier `site/releases.json` liste les versions publiées ; il est vide aujourd'hui, et la page Installer affiche « Pas encore disponible » pour chaque plateforme.
2. **Une interface de messagerie n'est pas une messagerie qui fonctionne.** La messagerie ne peut être annoncée comme opérationnelle qu'après le test M1 (§7) réussi et archivé. D'ici là, `/app` porte la bannière « Prototype — réseau simulé ».
3. Aucune fonction n'est présentée comme disponible si `docs/STATUS.md` ne la marque pas ✅.
4. Pas de promesse d'anonymat, de fonctionnement « en toutes circonstances » ni de VPN qui créerait une connexion.
5. Libellés et ton conformes à `DESIGN.md` (aucune esthétique survivaliste, statuts sans jargon).

## 4. Installation (PWA)

| Plateforme | Ce qui est réellement possible | Texte affiché |
|---|---|---|
| Android (Chrome) | Installation PWA par invite du navigateur | Bouton « Installer l'application web » si l'événement `beforeinstallprompt` est disponible |
| iPhone / iPad (Safari) | Ajout à l'écran d'accueil via le bouton Partager ; pas d'invite automatique | Instructions en deux étapes |
| macOS / Windows / Linux (Chrome, Edge) | Installation PWA depuis la barre d'adresse | Bouton si disponible |
| Firefox desktop | Pas d'installation PWA | « Ouvrez la démo dans le navigateur » |

La PWA donne accès à **la démo de l'interface**. Les fonctions Bluetooth, VPN et Wi-Fi Aware exigent les applications natives (voir `COORDINATION.md` §3) et ne sont pas présentées comme disponibles dans la PWA.

Exigences pour l'application `/app` (AI Studio / Antigravity) :
- portée du service worker limitée à `/app/` ; aucun service worker sur les pages du site ;
- manifeste propre à l'application (`/app/manifest.webmanifest`, `start_url` et `scope` = `/app/`), mêmes icônes ;
- au démarrage, lecture de `/version.json` : si la version diffère de celle en cache, afficher « Nouvelle version disponible — Mettre à jour » (jamais de rechargement forcé pendant une saisie).

## 5. Versions et mises à jour

- Fichier `VERSION` à la racine du dépôt, en semver. Suffixe `-preview` tant que rien n'est en production.
- `/version.json` est généré à chaque construction : `{version, builtAt, commit, channel}` (`channel` = `preview` ou `production`).
- La version est affichée en pied de page.
- Chaque version publiée est décrite dans `CHANGELOG.md` (format Keep a Changelog).

## 6. Sécurité et confidentialité du site

| Exigence | Mise en œuvre |
|---|---|
| Aucun secret dans le dépôt ou le site | Le script de construction échoue s'il détecte un motif de secret (clés API, jetons, clés privées) dans `site/` ou dans le résultat |
| Aucun traceur, aucune analytique tierce | Aucun script externe ; police Inter auto-hébergée ou police système (pas d'appel à Google Fonts en production) |
| En-têtes de sécurité | `_headers` : Content-Security-Policy stricte, `Referrer-Policy: no-referrer`, `Permissions-Policy` minimale, `X-Content-Type-Options`, `frame-ancestors 'none'` |
| Aperçus non indexés | `X-Robots-Tag: noindex` sur tous les déploiements tant que la production n'est pas validée |
| Partage | API Web Share du système, sinon copie du lien ; aucun bouton de réseau social tiers qui charge un script |
| Liens internes valides | Le script de construction vérifie chaque lien interne et échoue en cas de lien cassé |

## 7. Critère « messagerie opérationnelle » (test M1)

La messagerie de `/app` n'est déclarée opérationnelle que si **toutes** les conditions suivantes sont vérifiées et archivées dans `docs/tests/M1-<date>.md` :

1. Deux **clients distincts** : deux appareils physiques, deux navigateurs ou installations, deux identités générées séparément.
2. Un message envoyé par A est reçu par B **et** inversement, par un transport réel (pas de simulateur, pas d'état partagé dans le même navigateur), avec capture du trafic.
3. Le contenu est **chiffré de bout en bout** : la capture réseau ou relais ne montre aucun texte en clair ; clés générées sur l'appareil.
4. Le contact est vérifiable (QR ou empreinte) et un message altéré en transit est rejeté.
5. Les états de message (`RESILIENCE.md` §3) correspondent à la réalité observée, y compris un échec de livraison notifié.
6. Revue de sécurité du code de messagerie par Claude, sans point bloquant ouvert.

Tant que M1 n'est pas réussi, le site dit : « Démo de l'interface. Les messages ne sont pas encore réellement envoyés. »

## 8. Intégration du ZIP Google AI Studio

1. Créer la branche `ai-studio/import-AAAAMMJJ` depuis `main` (ou depuis la branche de site en cours).
2. Décompresser **uniquement** dans `prototype/` : jamais à la racine, jamais dans `docs/`, `contracts/` ou `site/`.
3. Vérifier : absence de secrets (clés d'API Gemini en particulier), dépendances, licence, conformité au contrat `contracts/typescript/meshora-contracts.ts`.
4. Construire l'application avec `base` = `/app/` et copier la sortie dans le dossier publié `/app/` au moment de la construction du site.
5. Ouvrir une PR distincte ; Claude fait la revue de cohérence et de sécurité.

Toute clé d'API présente dans le ZIP doit être retirée et révoquée ; une application publique ne contient jamais de clé d'un service payant.

## 9. Cloudflare Pages

| Paramètre | Valeur |
|---|---|
| Projet | `meshora` |
| Branche de production | `main` (aucune mise en production sans accord) |
| Commande de construction | `python3 scripts/build_site.py` |
| Dossier publié | `dist` |
| Variables | `SITE_URL` (URL publique), `MESHORA_CHANNEL` (`preview` ou `production`) |
| Aperçus | Une URL par branche ; partage pour validation |

Les aperçus Cloudflare Pages sont accessibles à toute personne qui connaît l'URL. Ils ne sont pas indexés (`noindex`), mais ils ne doivent contenir que ce qui pourrait être public.

## 10. Liste de contrôle avant mise en production

- [ ] Aperçu validé par le porteur du projet (FR/EN, mobile, clair/sombre)
- [ ] `python3 scripts/build_site.py` sans erreur (liens, secrets)
- [ ] Aucun lien de téléchargement sans version publiée
- [ ] `/app` : bannière prototype présente, ou test M1 réussi
- [ ] En-têtes de sécurité vérifiés sur l'URL d'aperçu
- [ ] Domaine définitif choisi ; `SITE_URL` renseigné ; `noindex` retiré seulement en production
- [ ] Mentions légales et politique de confidentialité (aucune donnée collectée) publiées
- [ ] Fusion vers `main` validée explicitement
