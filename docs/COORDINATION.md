# MESHORA — Coordination des agents

> Version 0.1 — 25 octobre 2026. GitHub (`cdriccarboni/meshora`) est la **source de vérité unique**.

## 1. Rôles

| Agent | Responsabilité | Branches | Ne fait pas |
|---|---|---|---|
| **Porteur du projet** | Décisions, validation, fusion vers `main` | — | — |
| **Claude** | Audit, architecture, sécurité, documentation, contrats d'interface (`contracts/`), structure du site (`site/`) | `docs/*`, `contracts/*` | Construire l'interface du prototype |
| **Google AI Studio** | Interface et prototype (adaptateurs simulés `Sim*`) | `ai-studio/*` | Modifier `docs/` ou `contracts/` directement (propose une PR) |
| **Pi Desktop / agents locaux** | Intégration, builds natifs, tests sur appareils physiques, rapports dans `docs/tests/` | `integration/*`, `tests/*` | Déclarer une fonction opérationnelle sans rapport archivé |

## 2. Règles de collaboration

1. Toute modification passe par une pull request vers `main`. **Aucune fusion sans accord explicite du porteur du projet.**
2. Aucun agent ne supprime, ne renomme ni ne réécrit les fichiers d'un autre agent. Un désaccord se traite par commentaire de PR.
3. Dossiers réservés :
   - `docs/`, `contracts/`, `site/` → Claude
   - `prototype/` → Google AI Studio (à créer par lui)
   - `native/`, `gateway/`, `docs/tests/` → agents d'intégration
4. Les contrats (`contracts/typescript/meshora-contracts.ts`) sont le point de jonction : le prototype les importe, le cœur natif les respecte. Changement = PR `contracts/*` + incrément de version.
5. `docs/STATUS.md` est mis à jour par la PR qui change l'état réel d'une fonction : 🎭 par AI Studio pour ce qu'il simule, ✅ uniquement par un agent de test avec rapport.
6. Aucun déploiement public, aucune publication sur un store, aucune suppression sans validation explicite.

## 3. Ce qui ne peut pas être fait dans une PWA

Les fonctions suivantes exigent des applications **natives** ; le prototype web les simule seulement :
- Bluetooth LE (central et périphérique), relais BLE en arrière-plan — impossible sur iPhone en web, et l'émission d'annonces BLE est impossible en web sur toutes les plateformes.
- VPN WireGuard (extension réseau iOS/macOS, `VpnService` Android).
- Wi-Fi Aware, Multipeer Connectivity.
- Accès aux radios LoRa compagnon en Bluetooth sur iPhone.

Ce qu'une PWA peut faire réellement : interface, stockage local, synchronisation Nostr via WebSocket quand Internet est disponible, LAN via un serveur local de passerelle, Web Serial / Web Bluetooth central sur Chrome desktop et Android uniquement [C].

## 4. Prochaines étapes pour Google AI Studio

1. Créer `prototype/` sur une branche `ai-studio/prototype-v0` ; ne rien modifier hors de ce dossier.
2. Importer `contracts/typescript/meshora-contracts.ts` et implémenter `SimMeshoraAdapter` (pannes, latences, partitions réglables ; tous les `MessageState`, dont `expired` et `storage_full`).
3. Appliquer `docs/DESIGN.md` : jetons de couleur, Inter, clair/sombre, trois onglets **Se connecter / Communiquer / Découvrir**, libellés FR/EN du §8, nom « Continuité ».
4. Afficher la bannière discrète « Prototype — réseau simulé » tant que `adapter.simulated === true`.
5. Écran de consentement « passerelle inconnue » (sans option « toujours » cochée) et écran « Diagnostic » listant transports, preuves et limites de plateforme.
6. Réutiliser `site/assets/logo.svg`, `site/assets/icons/` et `site/manifest.webmanifest` plutôt que de recréer une identité.
7. Ouvrir une PR vers `main` avec captures clair/sombre et FR/EN ; mettre à jour `docs/STATUS.md` en 🎭 pour les fonctions simulées.

## 5. Prochaines étapes pour les agents locaux

Phase 0 de `ROADMAP.md` : expériences E1 à E9 sur appareils physiques, en commençant par **E1** (constat PWA/iPhone), **E2** et **E3** (BLE Android ↔ iPhone, compatibilité Bitchat). Rapports dans `docs/tests/`.
