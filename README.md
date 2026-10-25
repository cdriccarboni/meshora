# MESHORA

**Un réseau qui relie les autres.** — *A network that connects the others.*

MESHORA est une infrastructure de communication libre et ouverte : vos appareils communiquent entre eux, avec ou sans Internet, et se relient aux réseaux que vous utilisez déjà.

## Les quatre piliers

| Pilier | Rôle |
|---|---|
| **MESHORA Mesh** | Communications locales : Bluetooth LE, réseau local, relais mesh |
| **MESHORA Connect** | Connexions et passerelles Internet disponibles |
| **MESHORA Shield** | VPN facultatif, chiffrement, confidentialité |
| **MESHORA Resilience** | Continuité des communications, stockage hors ligne, synchronisation différée |

Une passerelle ou un VPN ne crée jamais une connexion qui n'existe pas : ils utilisent celles qui sont disponibles.

## État du projet

**En conception. Aucune fonctionnalité n'est encore testée sur appareil.** L'état réel de chaque fonction est tenu dans `docs/STATUS.md`.

## Organisation du dépôt

| Branche | Responsable | Contenu |
|---|---|---|
| `main` | Validation humaine uniquement | Version de référence |
| `docs/*` | Claude | Audit, architecture, sécurité, documentation, contrats d'interface |
| `ai-studio/*` | Google AI Studio | Interface et prototype |
| `integration/*` | Agents locaux | Intégration et tests sur appareils |

Règles :
- Toute modification passe par une pull request ; aucune fusion sans accord du porteur du projet.
- Aucun agent ne supprime ni ne réécrit le travail d'un autre.
- Une fonction n'est déclarée opérationnelle qu'avec un rapport de test dans `docs/tests/`.
