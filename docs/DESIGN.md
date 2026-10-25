# MESHORA — Directive de design

> Version 1.0 — 25 octobre 2026. **S'applique à toutes les pages, applications et supports MESHORA**, y compris le prototype Google AI Studio.
> En cas d'écart, ce document prime sur les libellés d'interface cités dans les autres documents techniques : ceux-ci décrivent des **états internes**, pas le texte affiché.

## 1. Intention

MESHORA doit être **assez beau et simple pour servir tous les jours, même quand tout fonctionne**. La robustesse est une qualité discrète, comme une bonne serrure : on ne la remarque pas, on lui fait confiance.

**Mots-clés :** minimaliste, élégant, technologique, accessible, rassurant.
**À proscrire :** esthétique survivaliste, militaire, tactique, cyberpunk, « hacker », camouflage, couleurs agressives, alarmes permanentes, discours anxiogène.

## 2. Logo

- Un **motif orbital simple** : un point central et un anneau elliptique d'un seul trait, éventuellement un second point en orbite. Évoque des appareils qui gravitent et se relient, sans réseau « en toile d'araignée ».
- Monochrome d'abord (graphite sur clair, blanc cassé sur sombre) ; version bleu doux en accent.
- Lisible à 16 px (favicon, barre d'état) : pas plus de deux formes, trait ≥ 1,5 px à cette taille.
- Mot-symbole « MESHORA » en capitales, approche légèrement ouverte, même famille que l'interface.
- Interdits : éclairs, boucliers agressifs, radars, cibles, antennes stylisées, dégradés néon.

## 3. Couleurs

Toutes les paires texte/fond ci-dessous ont été calculées ≥ 4,5:1 (WCAG 2.1 AA, texte normal).

| Rôle | Clair | Sombre | Contraste (clair / sombre, sur fond principal) |
|---|---|---|---|
| Fond principal | `#FFFFFF` | `#14171C` | — |
| Fond secondaire (cartes) | `#F6F7F9` | `#1D2128` | — |
| Texte principal (graphite) | `#2A2E35` | `#E8EBF0` | 13,6 / 15,0 |
| Texte secondaire | `#5A616C` | `#A9B0BB` | 6,3 / 8,2 |
| Accent bleu doux | `#3566C8` | `#8DB0F5` | 5,4 / 8,3 |
| État « tout va bien » | `#2F7A5B` | `#7CC4A2` | 5,2 / 8,8 |
| État « à noter » (ambre doux, jamais orange vif) | `#8A5A12` | `#E2B66B` | 5,9 / 9,5 |
| Erreur réelle uniquement | `#A8433A` | `#E39A92` | 6,0 / 8,0 |

Règles :
- Le bleu est la seule couleur d'accent. Le vert, l'ambre et la terre cuite servent **uniquement** aux statuts, en petites touches (pastille, icône), jamais en aplats plein écran.
- La couleur n'est jamais le seul porteur d'information : toujours un mot et une icône.
- Thème clair et sombre suivent le réglage du système par défaut, modifiable dans l'app.

## 4. Typographie

- **Inter** (licence libre OFL) pour toute l'interface, avec repli sur les polices système (SF Pro, Roboto, Segoe UI).
- Taille de base 16 px (17 pt sur iOS), interlignage 1,5. Respect de la taille de texte choisie dans le système (Dynamic Type, échelle Android).
- Chiffres tabulaires pour les compteurs et les heures.
- Pas de police à chasse fixe dans l'interface grand public (réservée à l'écran de diagnostic avancé).

## 5. Mouvement

- Animations courtes (150–250 ms), douces (ease-out), **utiles** : confirmer une action, montrer qu'un message progresse, signaler un changement de connexion.
- Animation signature : l'anneau du logo qui tourne lentement pendant une recherche de connexion, puis se fige quand c'est établi.
- Aucun clignotement, aucune pulsation rouge, aucune vibration répétée.
- `prefers-reduced-motion` / « Réduire les animations » respecté partout.

## 6. Navigation : trois actions

| Onglet FR | EN | Contient |
|---|---|---|
| **Se connecter** | **Connect** | État de la connexion en une phrase, appareils et relais proches, ma passerelle, protection (Shield), continuité de connexion |
| **Communiquer** | **Talk** | Conversations, groupes, envoi de fichiers |
| **Découvrir** | **Discover** | Autour de moi, cartes et documents disponibles hors connexion, annonces de la communauté |

Les réglages sont accessibles depuis l'avatar, pas comme quatrième onglet. Les fonctions avancées sont repliées par défaut.

## 7. Le Mode Résilience présenté comme une continuité intelligente

- Nom affiché : **« Continuité »** (EN **« Continuity »**), jamais « mode urgence », « mode survie », « mode dégradé » ni « hors réseau ».
- Message type : « Vos messages continuent de circuler, même sans Internet. » (EN « Your messages keep flowing, even without internet. »)
- La continuité est **toujours active en arrière-plan** et ne s'annonce que lorsqu'elle sert : une ligne discrète, pas une bannière plein écran.
- Les « alertes communautaires » deviennent **« Annonces de la communauté »** (EN « Community notices »), avec le nom de l'émetteur et sa vérification.

## 8. Statuts sans jargon (FR / EN)

Libellés à utiliser dans l'interface. Les états internes correspondants sont définis dans `RESILIENCE.md` §3–4.

### Connexion
| État interne | FR | EN | Couleur |
|---|---|---|---|
| `internet: verified` | Connecté à Internet | Connected to the internet | vert |
| `internet: unverified` | Vérification de la connexion… | Checking connection… | neutre |
| `internet: offline` + voisins > 0 | Sans Internet — vos messages passent par les appareils proches | No internet — messages travel through nearby devices | ambre doux |
| `internet: offline` + voisins = 0 | Sans connexion pour le moment — vos messages partiront dès que possible | Not connected right now — messages will be sent as soon as possible | ambre doux |

### Protection
| État interne | FR | EN |
|---|---|---|
| `e2e: verified` | Privé · contact vérifié | Private · verified contact |
| `e2e: unverified` | Privé · contact à vérifier | Private · contact not yet verified |
| `e2e: public` | Public | Public |
| `vpn: on_verified` | Navigation protégée par votre passerelle | Browsing protected by your home gateway |
| `vpn: off` | Navigation directe | Direct browsing |
| `vpn: on_unverified` / `error` | Protection en cours de rétablissement | Restoring protection |
| `tor: on` | Adresse masquée (Tor) | Address hidden (Tor) |

### Messages
| État interne | FR | EN |
|---|---|---|
| `queued` | En attente d'envoi | Waiting to send |
| `handed_to_peer` | En route via un appareil proche | On its way via a nearby device |
| `published_nostr` | En route via Internet | On its way via the internet |
| `delivered` | Reçu | Delivered |
| `read` | Lu | Read |
| `expired` | Pas encore reçu — renvoyer ? | Not delivered yet — resend? |
| `rejected` | Trop volumineux pour ce réseau — envoyer plus tard ? | Too large for this network — send later? |
| `storage_full` | Espace presque plein — rien n'a été supprimé | Storage almost full — nothing was deleted |

### Consentement passerelle inconnue
> **Utiliser cette passerelle ?**
> « [nom] » propose d'acheminer vos messages vers Internet. Vos messages restent privés, mais elle verra quand vous l'utilisez.
> [Utiliser cette fois] [Non merci]

EN : *Use this gateway? "[name]" offers to carry your messages to the internet. Your messages stay private, but it will see when you use it.* [Use this time] [No thanks]

### Vocabulaire
| Éviter | Préférer |
|---|---|
| panne, coupure, urgence, survie, crise | sans Internet, continuité |
| nœud, pair, relais mesh, topologie | appareil proche, passerelle |
| chiffrement E2E, clé publique | privé, vérifié |
| VPN, tunnel (dans les écrans principaux) | protection, navigation protégée |
| alerte, menace, danger | annonce, à noter |

Le vocabulaire technique reste disponible dans l'écran « Diagnostic » pour qui le souhaite.

## 9. Bilinguisme

- Français et anglais dès la première version ; langue du système par défaut, changeable dans l'app.
- Toutes les chaînes dans des fichiers de traduction (aucune chaîne en dur), clés partagées entre plateformes.
- Prévoir +30 % de longueur pour le français dans les mises en page.

## 10. Accessibilité

- WCAG 2.1 AA minimum ; cibles tactiles ≥ 44 × 44 pt.
- Lecteurs d'écran : chaque statut a un libellé parlé complet (« Privé, contact vérifié »).
- Pas d'information transmise par la seule couleur ou le seul mouvement.

## 11. Consignes au prototype Google AI Studio

1. Appliquer les jetons de couleur et la typographie ci-dessus, thèmes clair et sombre.
2. Structurer la navigation en trois onglets : Se connecter / Communiquer / Découvrir.
3. Utiliser exclusivement les libellés du §8, en FR et EN.
4. Bannière « Prototype — réseau simulé » discrète (texte secondaire, pas de couleur d'alerte).
5. Soumettre les maquettes dans une PR dédiée pour revue de cohérence avec cette directive.
