# MESHORA — Licences : constat et compatibilité

> Version 0.1 — 25 octobre 2026. **Analyse technique, pas un avis juridique.** La décision définitive revient au porteur du projet, idéalement après l'avis d'un juriste spécialisé en logiciel libre.

## 1. Constat

| Élément | Licence actuelle | Source |
|---|---|---|
| Prototype Google AI Studio V0.2 (`OrbitalLogo.tsx`, `App.tsx`…) | **AGPL-3.0-or-later** (fichier `LICENSE` + en-têtes SPDX) | ZIP de passation V0.2 |
| Logo officiel (`public/icon.svg`) | Sans en-tête ; fourni avec le prototype AGPL | ZIP V0.2 |
| Documentation, contrats, site et script de construction (dépôt `cdriccarboni/meshora`) | **Aucune licence déclarée** pour l'instant (tous droits réservés par défaut) | Ce dépôt |
| Proposition antérieure (ARCHITECTURE ADR-10) | Apache-2.0 ou MPL-2.0 pour le cœur | Retirée en attendant cette revue |

**Décision provisoire du porteur du projet (25/10/2026) : option B** (§4). Les fichiers de licence ne sont pas encore créés : ils le seront après la vérification des droits et des dépendances (§6–7).

## 2. Ce que l'AGPL-3.0 implique concrètement

1. **Copyleft fort** : toute version modifiée distribuée doit l'être sous AGPL, avec son code source.
2. **Clause réseau (article 13)** : si une version modifiée est **proposée à des utilisateurs via un réseau** (par exemple l'application web servie sous `/app`), ces utilisateurs doivent pouvoir obtenir le code source correspondant.
   - Conséquence directe : **un `/app` public basé sur le prototype AGPL, avec un dépôt privé, pose question.** Si tout le code appartient au porteur du projet, celui-ci n'est pas lié par sa propre licence ; mais dès qu'un contributeur extérieur ajoute du code AGPL, l'obligation s'applique. Recommandation : publier le code source de `/app` (dépôt public ou archive) au plus tard au lancement public, et afficher un lien « Code source » dans l'application.
3. **App Store** : des applications AGPL y sont publiées (par exemple Signal), mais la compatibilité entre les conditions d'Apple et la GPL est discutée depuis des années (retrait de VLC en 2011). Une parade classique : le titulaire des droits ajoute une **permission supplémentaire** (article 7 de la GPLv3) autorisant la distribution via les stores. Cela suppose de détenir les droits sur tout le code, donc une politique de contribution claire (DCO ou accord de contributeur).
4. **Code généré par IA** : la titularité des droits sur du code produit par un outil d'IA reste juridiquement incertaine selon les pays ; à mentionner dans la politique de contribution.

## 3. Compatibilité avec les briques étudiées

| Brique (voir AUDIT.md) | Licence | Intégrable dans un projet AGPL-3.0 ? |
|---|---|---|
| Bitchat iOS / Android | Unlicense / MIT | ✅ Oui (licences permissives) |
| MeshCore | MIT | ✅ Oui |
| Meshtastic (firmware, apps) | GPL-3.0 | ✅ Oui (GPLv3 et AGPLv3 combinables, article 13) |
| Briar | GPL-3.0 / AGPL | ✅ Oui |
| Reticulum, implémentation de référence | « Reticulum License » (MIT + restrictions) | ❌ Non : restrictions supplémentaires incompatibles avec la GPL |
| RetiNet, Leviculum (Reticulum) | AGPL-3.0 | ✅ Oui |
| Reticulum-rs | MIT | ✅ Oui |
| libsodium | ISC | ✅ Oui |
| WireGuard (bibliothèques apps) | MIT / Apache-2.0 [C] | ✅ Oui (Apache-2.0 compatible avec GPLv3/AGPLv3, dans ce sens uniquement) |
| NetBird clients / serveur | BSD-3 / AGPL-3.0 | ✅ Oui |
| React, Vite, Tailwind, lucide-react, motion (prototype) | MIT / ISC [C] | ✅ Oui |

L'AGPL est donc **compatible avec toutes les briques retenues**, et même plus compatible que Apache-2.0 vis-à-vis de Meshtastic et des forks Reticulum. Le sens inverse ne fonctionne pas : du code AGPL ne peut pas être intégré dans un cœur Apache-2.0 ou MPL-2.0.

## 4. Options de décision

| Option | Avantages | Inconvénients |
|---|---|---|
| **A. Tout en AGPL-3.0-or-later** (applications, cœur, site) | Cohérent avec le prototype ; protège contre les forks fermés, y compris les services en ligne ; compatible avec Meshtastic et les forks Reticulum | Freine l'adoption par des fabricants et intégrateurs ; frictions App Store à traiter (article 7) |
| **B. Applications AGPL, contrats et spécification permissifs** (`contracts/` en Apache-2.0 ou MIT, spécification de l'enveloppe et du protocole Nearby en CC-BY-4.0) | Les applications restent protégées ; d'autres projets (y compris firmware ESP32 sous licence permissive) peuvent implémenter le protocole MESHORA librement | Deux régimes à documenter |
| **C. Reprendre Apache-2.0 / MPL-2.0 partout** | Adoption maximale | Exige que le titulaire des droits re-licencie le prototype ; perd la protection réseau ; Meshtastic (GPL) ne peut plus être intégré |

**Recommandation technique : option B.** Elle respecte le choix AGPL du prototype et garde l'**interopérabilité** (la raison d'être de MESHORA) : un protocole ouvert à tous, des applications protégées.

## 5. Actions avant toute décision définitive

1. Confirmer que le porteur du projet détient les droits sur l'intégralité du code du prototype (aucun code tiers copié sous une autre licence).
2. Choisir l'option (A, B ou C) et l'inscrire dans un fichier `LICENSE` à la racine, ainsi que des fichiers `LICENSE` par dossier si l'option B est retenue.
3. Adopter une politique de contribution (DCO) avant d'accepter des contributions extérieures.
4. Prévoir le lien « Code source » dans `/app` et la publication du code au lancement public (article 13).
5. Si l'option A ou B est retenue pour iOS : rédiger la permission supplémentaire pour la distribution via les stores.

## 6. Vérification des droits et des dépendances (25 octobre 2026)

### 6.1 Droits sur le contenu du dépôt `cdriccarboni/meshora`
| Vérification | Résultat |
|---|---|
| Auteurs des commits | 13 commits, tous produits par Claude dans les sessions du porteur du projet |
| Code ou texte tiers copié | Aucun fichier tiers ; aucun en-tête de copyright ou de licence étranger dans `site/`, `contracts/`, `scripts/` |
| Dépendances du site | **Aucune** : le site est en HTML/CSS/JS sans bibliothèque ; le script de construction n'utilise que la bibliothèque standard Python (licence PSF, non redistribuée) |
| Polices | Aucune police redistribuée (Plus Jakarta Sans / Inter utilisées seulement si installées sur l'appareil) |
| Logo et icônes | Dérivés du logo du prototype, validé par le porteur du projet ; variante favicon validée |
| Titularité des contenus générés par IA | Les conditions d'utilisation d'Anthropic et de Google attribuent en principe les contenus générés à l'utilisateur [C, à vérifier dans les conditions applicables au compte] ; la protection par le droit d'auteur de contenus générés par IA reste incertaine selon les pays |

### 6.2 Dépendances d'exécution déclarées par le prototype V0.2 (`package.json`)
Licences relevées sur le registre npm le 25/10/2026 (dernière version publiée de chaque paquet) :

| Paquet | Licence | Compatible AGPL-3.0 |
|---|---|---|
| react, react-dom | MIT | ✅ |
| vite, @vitejs/plugin-react, @tailwindcss/vite | MIT | ✅ |
| motion | MIT | ✅ |
| express | MIT | ✅ |
| lucide-react | ISC | ✅ |
| dotenv | BSD-2-Clause | ✅ |
| @google/genai | Apache-2.0 | ✅ (sens Apache → AGPL) — mais dépendance à retirer de la version publiée (COORDINATION §5, A3) |

Limites : les versions vérifiées sont les dernières publiées, pas forcément celles qu'installe le prototype ; le ZIP ne contient **pas** de `package-lock.json`, donc les **dépendances indirectes ne sont pas vérifiées**.

## 7. Reste à faire avant de créer les fichiers de licence

| # | Action | Responsable |
|---|---|---|
| L1 | Fournir le dépôt complet du prototype avec `package-lock.json` ; produire la liste des licences de toutes les dépendances (ex. `npx license-checker --production --summary`) et l'archiver dans `docs/tests/` | Antigravity |
| L2 | Confirmer qu'aucun fichier du prototype n'a été copié d'un projet tiers (images, cartes, sons des « alertes audio » de la V0.2 en particulier) | Antigravity + porteur du projet |
| L3 | Confirmer la titularité des contenus générés (conditions des comptes Google AI Studio et Claude utilisés) | Porteur du projet |
| L4 | Créer les fichiers : `LICENSE` (AGPL-3.0-or-later) à la racine pour les applications ; `contracts/LICENSE` (Apache-2.0 ou MIT, à choisir) ; spécifications de protocole (`docs/NEARBY.md` §3, enveloppe de `ARCHITECTURE.md`) sous CC-BY-4.0 ; en-têtes SPDX | Claude, après L1–L3 |
| L5 | Ajouter une politique de contribution (DCO) et, pour iOS, la permission supplémentaire de distribution via les stores (article 7 GPLv3) | Claude (rédaction) + validation du porteur |
