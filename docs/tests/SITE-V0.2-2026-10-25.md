# Rapport de tests — Site public MESHORA, harmonisation V0.2

| | |
|---|---|
| Date | 25 octobre 2026 |
| Branche / commit testé | `web/public-site` @ `0c4e259` (PR #2) |
| Version du site | `0.2.0-preview` |
| Aperçu | https://web-public-site.meshora.pages.dev (déploiement `4bc1d667`) |
| Production | `meshora.pages.dev` — **non déployée** (404 vérifié) |
| Testé par | Claude |
| Périmètre | Site statique (`site/`, `scripts/build_site.py`). **Hors périmètre** : le prototype `/app` (page d'attente seulement), la messagerie, toute fonction réseau MESHORA. |

## 1. Environnements

| Environnement | Détail |
|---|---|
| Construction | Python 3 (bibliothèque standard), conteneur Linux ; reconstruction identique sur macOS (Python 3.9.6) avant déploiement |
| Navigateur automatisé | Chromium (Playwright), fenêtres 1100 × 900 et 375 × 812, `prefers-color-scheme` clair et sombre, `prefers-reduced-motion` |
| Serveur local | `python3 -m http.server` sur `dist/`, avec injection de la CSP de production sur chaque document |
| En ligne | `curl` depuis macOS vers l'aperçu Cloudflare Pages |
| Déploiement | `wrangler 4.152.0`, projet `meshora` (unique), branche `web-public-site` |

## 2. Résultats

### 2.1 Construction et garde-fous (`scripts/build_site.py`)
| Id | Test | Résultat |
|---|---|---|
| B1 | Construction normale | ✅ `OK — MESHORA 0.2.0-preview — 10 pages + /app` |
| B2 | Négatif : clé API Google factice injectée | ✅ Refus (« Secret possible (clé API Google) ») |
| B3 | Négatif : lien interne inexistant | ✅ Refus (« Lien interne cassé ») |
| B4 | Négatif : lien `.apk` non déclaré dans `releases.json` | ✅ Refus (« Lien de téléchargement non publié ») |
| B5 | Négatif : prototype factice contenant « SOS Rapide » et « Signal de détresse diffusé » dans `/app` | ✅ Refus (« Fonction de détresse « SOS » dans /app … sans validation ») |
| B6 | Même prototype avec `docs/tests/EMERGENCY-APPROVAL.md` présent | ✅ Accepté (la validation explicite débloque, comme prévu) |
| B7 | Ressources externes (scripts, styles, images, iframes) dans les pages | ✅ Aucune |

B2 à B6 ont été exécutés sur une copie jetable du dépôt, supprimée ensuite.

### 2.2 Navigateur (serveur local, CSP de production)
| Id | Test | Résultat |
|---|---|---|
| N1 | 11 pages (`/`, `/en/`, Découvrir, Installer, État, Confidentialité FR/EN, `/app/`) | ✅ 0 erreur ou avertissement console, 0 réponse ≥ 400, 0 image cassée |
| N2 | Mode clair / sombre (accueil, Installer, `/app`) | ✅ Contrôle visuel : logo, couleurs et contrastes conformes |
| N3 | Mobile 375 px (accueil, Discover, État) | ✅ Aucun débordement horizontal |
| N4 | Animation du logo, préférences par défaut | ✅ Le logo tourne (deux captures à 2 s d'écart différentes) |
| N5 | Animation avec « réduire les animations » | ✅ Le logo reste immobile |
| N6 | Icônes déclarées par le manifeste (192, 512, maskable 512, SVG) | ✅ Toutes en 200 |
| N7 | Bouton Partager sans API de partage native | ✅ Repli : lien copié, message « Lien copié » (test du 25/10, PR #2 initiale) |
| N8 | Bouton « Installer » quand l'application n'existe pas encore | ✅ Absent (comportement voulu) |

### 2.3 Identité visuelle
| Id | Test | Résultat |
|---|---|---|
| V1 | `site/assets/icons/icon.svg` identique au fichier officiel `public/icon.svg` (V0.2) | ✅ Identique octet pour octet (`cmp`) |
| V2 | Lisibilité 16 / 32 px : logo complet vs variante favicon | ✅ Logo complet illisible à 16 px (un point) ; variante reconnaissable — **variante validée par le porteur du projet le 25/10/2026** |
| V3 | Zone de sécurité de l'icône maskable (rayon 40 %) | ✅ Élément le plus éloigné à 47,9 / 128 (limite 51,2) |
| V4 | Dimensions des PNG | ✅ 32, 180, 192, 512, 512 px |
| V5 | Contrastes texte (WCAG AA ≥ 4,5:1) | ✅ Accent clair `#2563EB` 5,17 ; accent sombre `#60A5FA` 7,31 ; textes secondaires ≥ 6,3 ; boutons primaires 5,17 (clair) et 7,31 (sombre). Le `#3B82F6` officiel (3,68 sur blanc) est réservé aux graphismes |

### 2.4 En ligne (aperçu Cloudflare Pages)
| Id | Test | Résultat |
|---|---|---|
| L1 | 11 pages | ✅ 200 |
| L2 | Adresse inexistante | ✅ 404 réelle |
| L3 | `version.json` | ✅ `0.2.0-preview`, canal `preview`, commit `0c4e259` |
| L4 | Empreintes SHA-256 de 8 fichiers graphiques servis vs dépôt | ✅ Toutes identiques |
| L5 | En-têtes de sécurité | ✅ CSP stricte, HSTS, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options` |
| L6 | Non-indexation de l'aperçu | ✅ `X-Robots-Tag: noindex, nofollow`, `robots.txt` bloquant |
| L7 | Production | ✅ `meshora.pages.dev` → 404 (rien publié) |
| L8 | Nombre de projets Cloudflare Pages `meshora` | ✅ 1 |

## 3. Non testé (et pourquoi)

| Élément | Raison |
|---|---|
| Rendu sur iPhone et Android physiques | Aucun appareil physique dans cet environnement ; à faire lors de la validation de l'aperçu |
| Safari, Firefox | Seul Chromium est automatisé ici |
| Invite d'installation PWA réelle | Volontairement désactivée tant que `/app` n'existe pas |
| Lecteurs d'écran (VoiceOver, TalkBack) | Non disponibles ; structure vérifiée (titres, `alt`, `aria-label`, langue des pages) |
| Prototype `/app`, messagerie, transports | Hors périmètre (Antigravity) ; voir `STATUS.md` et `COORDINATION.md` §5 |

## 4. Conclusion

Tous les tests du périmètre « site public » sont réussis. Aucune mise en production, aucune fusion. La PR #2 reste ouverte pour l'intégration future de l'application.
