# Changelog — MESHORA

Toutes les modifications notables apportées au projet MESHORA sont consignées dans ce document.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [0.2.0] - V.0.2 - 2026-10-25

### 🚀 Nouveaux Ajouts V.0.2 — Cartographie de Résilience & Repères Dynamiques

#### Visualiseur Cartographique Hors-Ligne & Repères SVG Dynamiques
- **Rendu dynamique SVG selon le type de point (`renderDynamicSvgMarker`)** :
  - `node` : Architecture hexagonale avec antenne d'émission radio et ondes d'écho concentriques animées (relais LoRa, passerelles).
  - `emergency-service` : Badge octogonal à haute visibilité intégrant les glyphes vectoriels spécialisés (croix médicale de premier secours, goutte d'eau potable, éclair d'énergie solaire, balise radio PMR446) avec indicateur d'état opérationnel.
  - `safe-zone` : Zone de sécurité avec double anneau de périmètre de protection translucide (`fillOpacity: 0.16`), bouclier de sanctuaire et icône de refuge.
- **Ergonomie tactile optimisée pour le terrain** :
  - Cibles tactiles agrandies à $\ge 44 \times 44\text{px}$ pour éviter les erreurs de manipulation sur mobile.
  - Support natif des gestes de pincement (pinch-to-zoom) et double-tap pour zoomer.
  - Bouton dédié **« Recentrer » (`LocateFixed`)** sautant instantanément à la dernière position connue de l'utilisateur avec animation d'onde radar.
- **Persistance & Ajout Hors-Ligne** :
  - Sauvegarde et chargement instantané des repères dans le stockage local persistant (100% hors-ligne, zéro dépendance API externe).

---

## [0.1.0] - v0.1 - 2026-10-25

### ✨ Initialisation du Prototype v0.1

#### Architecture & Moteur
- **Architecture quadrilatère** : Découplage strict des modules **Mesh**, **Connect**, **Shield** et **Resilience**.
- **Transport local réel** :
  - Implémentation du transport direct `BroadcastChannel` pour une communication inter-onglets et inter-fenêtres sans latence ni serveur externe.
  - Implémentation du relais local WebSocket pour synchronisation multi-appareils sur le même réseau local.
- **Stockage local persistant & Outbox** :
  - Moteur de stockage `IndexedDB` avec repli gracieux sur `localStorage`.
  - File d'attente d'envoi hors-ligne (`OutboxQueue`) garantissant zéro perte silencieuse de message lors de déconnexions inopinées.
  - Horodatage et acquittement d'envoi (`En attente` ➔ `Relayé` ➔ `Délivré`).
- **Sentinelle réseau (NetworkSentinel)** :
  - Détection dynamique des trois états fondamentaux : *Connecté*, *Réseau local*, *Hors ligne*.
  - Mode simulation de coupure réseau pour tester la résilience et la continuité en temps réel.
- **Module MESHORA Shield** :
  - Panneau de contrôle VPN et de protection réseau.
  - Règle stricte de vérité d'affichage : pas de faux voyant de sécurité sans tunnel WireGuard réel.
  - Adaptateurs WireGuard, Android `VpnService` et iOS `NEPacketTunnelProvider` clairement identifiés en stubs extensibles avec mention « Nécessite un module natif ».
- **Module MESHORA Resilience** :
  - Basculement intelligent vers les transports disponibles avec boîte de dialogue de consentement explicite pour toute passerelle inconnue.
  - Fiches et cartes de secours locales vectorielles mises en cache hors-ligne.
  - Protocole d'échange de fichiers P2P en morceaux (chunks) horodatés.
  - Mode Économie d'Énergie (fréquence de découverte adaptative, réduction des animations).
  - Système d'alertes communautaires vérifiables avec signature de l'émetteur.
- **Interface & Expérience Utilisateur** :
  - Identité orbitale minimaliste monochrome et bleu doux.
  - 10 vues complètes : Accueil, Messages, Appareils, Réseau, Passerelles, Services, Shield, Résilience, Découvrir & Installer, Paramètres.
  - Support bilingue intégral Français / Anglais commutable en un clic.
  - Thème sombre et thème clair.
  - Support PWA complet : `manifest.json`, Service Worker `/sw.js`, icônes et bouton d'installation in-app avec guide pour iOS Safari.
  - Console de tests automatisés interactive intégrée dans l'interface pour vérifier les invariants de sécurité et de persistance.
