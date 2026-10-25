# MESHORA — Prototype v0.1 : Architecture Quadrilatère (Mesh, Connect, Shield, Resilience)

Plan d'implémentation de MESHORA v0.1 (« Un réseau qui relie les autres »), une application libre multi-réseaux et PWA mobile-first intégrant les quatre piliers officiels : **MESHORA Mesh**, **MESHORA Connect**, **MESHORA Shield** et **MESHORA Resilience**.

### User Review & Critical Decisions

> [!IMPORTANT]
> Les directives et ajouts officiels sont consolidés dans ce plan d'architecture modulaire :
> - **Les 4 modules officiels** :
>   1. **MESHORA Mesh** — Communiquer localement sans dépendance réseau central.
>   2. **MESHORA Connect** — Utiliser intelligemment les passerelles et réseaux disponibles.
>   3. **MESHORA Shield** — Protéger les communications (intégration VPN WireGuard / modules natifs, vérité absolue sur l'état de chiffrement).
>   4. **MESHORA Resilience** — Détection automatique de rupture, basculement consenti vers transports disponibles, messages hors ligne sans perte, cartes/documents d'urgence locaux, partage de fichiers de pair à pair, mode économie d'énergie et alertes vérifiables.
> - **Règles impératives de sécurité & résilience** :
>   - *Consentement explicite* : Aucun basculement automatique vers une passerelle inconnue ou tierce sans approbation de l'utilisateur.
>   - *Zéro perte silencieuse* : Chaque message hors-ligne est persisté (IndexedDB/localStorage), horodaté, numéroté et suivi jusqu'à acquittement.
>   - *Vérité d'affichage* : Aucun statut "VPN actif" ou "Chiffré" sans vérification réelle du tunnel ou du module cryptographique.
>   - *Restrictions plateformes* : Documentation et gestion claire des contraintes d'arrière-plan sur iOS et Android.
>   - *Licence* : AGPL-3.0 complète dans `LICENSE` et en-têtes conformes.

---

### 1. Vue d'Ensemble & Les 4 Piliers MESHORA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MESHORA v0.1 ARCHITECTURE                            │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│    MESHORA Mesh      │    MESHORA Connect   │        MESHORA Shield         │
│  Messagerie locale   │  Passerelles Uplink  │   Protection VPN WireGuard    │
│  P2P, LAN, LoRa*     │  Relais, Nostr/AT*   │   Vérité du chiffrement       │
├──────────────────────┴──────────────────────┴───────────────────────────────┤
│                            MESHORA Resilience                               │
│  • Détection de coupure & basculement avec consentement utilisateur        │
│  • Zéro perte de message (Outbox persistante & accusés de réception)        │
│  • Cartes & Documents d'urgence hors ligne (Protocoles & fiches secours)    │
│  • Échange de fichiers local P2P (morceaux signés)                          │
│  • Mode Économie d'Énergie (fréquence de balayage adaptative)               │
│  • Alertes communautaires d'urgence signées cryptographiquement             │
└─────────────────────────────────────────────────────────────────────────────┘
* Adaptateur natif requis ou mode simulation explicite dans l'environnement web.
```

1. **MESHORA Mesh** : Messagerie directe entre appareils sur le même réseau local via `BroadcastChannel` (inter-onglets et fenêtres) et relais local WebSocket (entre différents postes/smartphones sur le même Wi-Fi ou réseau local). Stubs modulaires pour Bluetooth LE, LoRa / Meshtastic et Reticulum.
2. **MESHORA Connect** : Gestionnaire de liaisons montantes (passerelles Wi-Fi/4G/5G, nœuds relais Internet, et interfaces prévues pour Nostr, Bluesky AT Protocol et Mastodon).
3. **MESHORA Shield** : Module d'isolation et VPN. Offre une activation volontaire et un état vérifié transparent (interdiction formelle de prétendre qu'un VPN est actif si aucun module natif WireGuard n'a validé la poignée de main).
4. **MESHORA Resilience** : Le moteur de survie opérationnelle en cas de coupure brutale, d'inondation, de panne réseau ou de zone blanche.

---

### 2. Expérience Utilisateur & Navigation Mobile-First

- **Navigation & Écrans** :
  - **Barre supérieure (3 zones)** :
    - *Zone 1* : Logo orbital monochrome minimaliste + Nom `MESHORA` + Signature discrète.
    - *Zone 2* : Indicateur tri-état lisible (*Connecté* [Vert] / *Réseau local* [Bleu] / *Hors ligne* [Ambre]) + Badge Shield (Vérifié / Non protégé).
    - *Zone 3* : Sélecteur bilingue instantané (FR / EN) + Basculeur Thème Clair/Sombre + Bouton d'installation PWA.
  - **Barre inférieure mobile ergonomique (5 onglets principaux)** :
    1. **Accueil** : Tableau de bord des 4 piliers, état des connexions réelles, file d'attente hors-ligne, bouton de simulation de coupure réseau pour tester la résilience en direct.
    2. **Messages** : Messagerie instantanée opérationnelle, statut d'envoi en temps réel (`En attente` / `Relayé` / `Délivré`), sélecteur de canal (Canal Général Local, Canal d'Urgence), et outil de test inter-appareils.
    3. **Réseau** : Topologie maillée interactive (graphique SVG vectoriel avec nœuds et relais, mention explicite « Simulation topologique » pour les liaisons radio simulées).
    4. **Résilience** : Module officiel dédié avec :
       - Gestionnaire de basculement de secours (avec demande de confirmation pour toute passerelle inconnue).
       - Fiches et cartes de secours hors ligne (procédures d'urgence, protocoles radio, carte sectorielle vectorielle locale mise en cache).
       - Échange de fichiers local P2P (documents de terrain, images compresses, fiches d'état).
       - Commutateur de mode économie de batterie (ralentit les sondes réseau et les animations pour préserver l'autonomie).
       - Système d'alertes communautaires vérifiables (avec signature d'émetteur).
       - **Bouton Flottant Quick SOS** : Action tactile d'urgence par appui long (1.5s), anneau SVG radial, carillon sonore d'urgence, vibration haptique, raccordement automatique des dernières coordonnées et diffusion immédiate de détresse aux pairs mesh.
    5. **Bouclier (Shield)** : Activation du VPN WireGuard (avec avertissement explicite « Nécessite un module natif en environnement web »), surveillance des fuites DNS/IP, sélection de passerelle de confiance.
  - **Tiroir / Menu Plus** :
    - *Appareils* : Découverte des pairs locaux et voisins mesh.
    - *Passerelles* : Liste des nœuds de sortie Internet et consentements accordés.
    - *Services* : Intégrations décentralisées (Nostr, Bluesky, Mastodon).
    - *Découvrir & Installer* : Présentation didactique des 4 modules, guide d'installation PWA Android/iPhone, et comparatif technique PWA vs Natif iOS/Android.
    - *Paramètres* : Identité cryptographique locale, pseudonyme, gestion du stockage, purge des caches et journal des événements de sécurité.

- **Design System & Anti-Slop** :
  - Identité orbitale épurée, monochrome, lisible en 16x16 pixels.
  - Pas de pills statiques surchargés : métadonnées sobres séparées par des points médians (`·`).
  - Aucun score inventé ni faux voyant clignotant.
  - Typographie nette avec chiffres tabulaires (`tabular-nums font-mono`) pour les clés d'identification et compteurs.

---

### 3. Architecture Technique & Moteur Modulaire

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MESHORA APPLICATION CORE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Identity Engine        : Empreinte de clé publique Ed25519 simulée / alias│
│  2. Message Store          : IndexedDB / localStorage + Outbox FIFO Queue    │
│  3. Network Sentinel       : Détection live (navigator.onLine + prober LAN)  │
│  4. Resilience Engine      : Basculement consenti, fiches hors ligne, alertes│
│  5. Shield Controller      : Surveillance d'intégrité VPN et avertissements  │
│  6. I18n Engine            : Dictionnaire complet bilingue FR / EN           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     Couche Transports Mesh    │             │      Couche Protection & VPN  │
├───────────────────────────────┤             ├───────────────────────────────┤
│ • BroadcastChannel (Réel web) │             │ • WireGuard Controller        │
│ • WebSocket LAN Relay (Réel)  │             │   (Natif requis / Stub)       │
│ • Bluetooth LE (Stub/Simulé)  │             │ • Android VpnService Stub     │
│ • Meshtastic LoRa (Stub/Sim.) │             │ • iOS PacketTunnel Stub       │
│ • Reticulum (Stub/Simulé)     │             │ • Contrôleur de Consentement  │
└───────────────────────────────┘             └───────────────────────────────┘
```

#### Interfaces TypeScript modulaires :
- `ITransportAdapter` : `name`, `type`, `isAvailable()`, `isNativeRequired()`, `send(packet)`, `onMessage(cb)`, `discoverPeers()`.
- `IMessageStore` : `saveMessage(msg)`, `getMessages(filter)`, `queueOutbox(msg)`, `flushOutbox(sendFn)`, `markDelivered(msgId)`.
- `IResilienceManager` : `getActiveTransport()`, `requestGatewayConsent(gatewayId)`, `getEmergencyDocs()`, `transferFileChunk(file)`, `toggleBatterySaver()`, `broadcastAlert(alert)`.
- `IShieldManager` : `isVpnActive()`, `requestTunnelActivation()`, `getWarnings()`.

---

### 4. Documentation & Fichiers GitHub

Préparer un dépôt de haute qualité prêt pour publication GitHub :
1. `README.md` : Présentation du projet MESHORA, vision, 4 modules, démarrage rapide, statut v0.1.
2. `LICENSE` : Licence GNU Affero General Public License v3.0 (AGPL-3.0).
3. `CHANGELOG.md` : Historique des versions et journal des modifications v0.1.
4. `docs/ARCHITECTURE.md` : Principes modulaires, découplage UI/Transports/Stockage/Sécurité.
5. `docs/MOBILE_AND_MESH_CONSTRAINTS.md` : Différences fondamentales entre PWA, application native Android (VpnService, Bluetooth background, Wi-Fi Direct) et application native iOS (NEPacketTunnelProvider, CoreBluetooth background restrictions, limitations WebKit PWA).
6. `docs/RESILIENCE_GUIDE.md` : Guide d'utilisation en situation de crise ou de coupure réseau.
7. `tests/mesh.test.ts` : Tests automatisés validant :
   - La conservation des messages en file d'attente hors-ligne et déstockage lors du retour en ligne.
   - Le basculement vers transport local sans Internet.
   - Le refus de connexion vers une passerelle inconnue sans consentement.
   - L'interdiction formelle d'afficher un VPN actif sans tunnel vérifié.
   - La signature et la vérification d'une alerte d'urgence.

---

### Verification Plan

1. **Compilation** : Exécuter `compile_applet` sans aucune erreur TypeScript ou de rendu.
2. **Exécution des tests** : Exécuter le lanceur de test pour valider l'ensemble des cas d'usage de résilience, messagerie et sécurité.
3. **Double Onglet / Test de connectivité** : Vérifier que l'envoi d'un message dans une fenêtre apparaît instantanément dans une autre fenêtre grâce au `BroadcastChannel` et au relais local.
4. **Audit de conformité des exigences** : Valider chaque point du cahier des charges (7 écrans + Shield + Résilience + Découvrir/Installer + PWA + Bilingue FR/EN).
