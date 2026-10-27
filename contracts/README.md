# Contrats techniques MESHORA

Types partagés entre l'interface (Google AI Studio), le futur cœur natif (Rust) et les agents d'intégration.

| Fichier | Contenu |
|---|---|
| `typescript/meshora-contracts.ts` | Types et adaptateur `MeshoraAdapter` (v0.1.0), équivalent Rust indicatif en fin de fichier |

Règles de version :
- `CONTRACT_VERSION` suit semver ; une rupture incrémente le majeur.
- Toute modification passe par une PR dédiée ; le prototype ne modifie pas ce fichier sur sa propre branche, il propose une PR `contracts/*`.
- Le fichier est vérifié par `tsc --strict --noEmit` avant chaque PR.
