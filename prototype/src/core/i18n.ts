/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

export type Language = 'fr' | 'en';

export const i18nData = {
  fr: {
    brand: {
      name: 'MESHORA',
      tagline: 'Un réseau qui relie les autres.',
      version: 'V.0.3'
    },
    nav: {
      home: 'Accueil',
      messages: 'Messages',
      network: 'Réseau',
      shield: 'Shield',
      resilience: 'Résilience',
      devices: 'Appareils',
      gateways: 'Passerelles',
      services: 'Services',
      discover: 'Découvrir',
      settings: 'Paramètres',
      tests: 'Tests auto',
      more: 'Plus'
    },
    actions: {
      connect: 'Se connecter',
      communicate: 'Communiquer',
      discover: 'Découvrir',
      send: 'Envoyer',
      refresh: 'Actualiser',
      install: 'Installer l’application',
      installIos: 'Installer sur iOS',
      installGeneric: 'Installer PWA',
      close: 'Fermer',
      enable: 'Activer',
      disable: 'Désactiver',
      accept: 'Accepter',
      refuse: 'Refuser',
      clearCache: 'Purger les caches',
      exportIdentity: 'Exporter mon identité',
      runTests: 'Lancer les vérifications',
      simulateCut: 'Simuler une coupure Internet',
      restoreCut: 'Rétablir la connexion'
    },
    status: {
      connected: 'Connecté',
      connectedDesc: 'Connexion Internet active et fonctionnelle',
      local_only: 'Réseau local',
      local_onlyDesc: 'Communication directe avec les appareils proches, sans Internet',
      offline: 'Hors ligne',
      offlineDesc: 'Messages conservés en attente de synchronisation',
      shieldActive: 'Protégé',
      shieldInactive: 'Non protégé',
      queued: 'En attente',
      sent: 'Envoyé au transport',
      relayed: 'Relayé',
      delivered: 'Délivré (accusé reçu)',
      failed: 'Échec d’envoi',
      nativeRequired: 'Nécessite un module natif',
      simulationNotice: 'Simulation topologique active',
      inDevelopment: 'En développement'
    },
    pillars: {
      mesh: {
        title: 'MESHORA Mesh',
        subtitle: 'Communiquer localement',
        description: 'Échangez des messages et des fichiers en direct d’appareil à appareil, même sans accès au réseau Internet.'
      },
      connect: {
        title: 'MESHORA Connect',
        subtitle: 'Utiliser les passerelles disponibles',
        description: 'Tirez parti de manière fluide des réseaux existants (Wi-Fi, 4G/5G, relais de voisinage, protocoles décentralisés).'
      },
      shield: {
        title: 'MESHORA Shield',
        subtitle: 'Protéger les communications',
        description: 'Activez une protection réseau volontaire avec une vérification stricte des tunnels et de la confidentialité.'
      },
      resilience: {
        title: 'MESHORA Resilience',
        subtitle: 'Continuité intelligente de connexion',
        description: 'Continuité en cas d’aléa : file d’attente locale des messages non remis, documents de secours consultables hors ligne (prototype).'
      }
    },
    home: {
      welcome: 'Votre espace de communication résilient',
      overview: 'MESHORA vise à unifier vos moyens de liaison pour que vos échanges restent accessibles le plus longtemps possible (prototype).',
      threeActionsTitle: 'Que souhaitez-vous faire ?',
      actionConnectDesc: 'Vérifier vos accès Internet, passerelles et tunnels disponibles.',
      actionCommunicateDesc: 'Échanger des messages entre onglets ou via un relais de test (prototype).',
      actionDiscoverDesc: 'Comprendre l’architecture et installer l’application sur vos appareils.',
      realConnections: 'Liaisons actives détectées',
      outboxStatus: 'File d’attente locale',
      outboxEmpty: 'Tous les messages sont synchronisés',
      outboxPending: '{count} message(s) en attente de synchronisation'
    },
    messages: {
      title: 'Messages',
      publicChannel: 'Canal Général Local',
      emergencyChannel: 'Canal d’Entraide & Continuité',
      directChannel: 'Discussion directe',
      placeholder: 'Écrivez un message…',
      testNotice: 'Test local : ouvrez un 2ᵉ onglet du même navigateur. Entre appareils, un relais de test est nécessaire.',
      searchPlaceholder: 'Rechercher dans les messages...'
    },
    devices: {
      title: 'Appareils Voisins',
      subtitle: 'Découverte d’appareils à proximité sur le réseau local ou via liaisons mesh.',
      radarScanning: 'Recherche active d’appareils à proximité...',
      hops: 'saut(s)',
      signal: 'Signal'
    },
    network: {
      title: 'Topologie & Nœuds',
      subtitle: 'Visualisation dynamique des appareils, relais et liaisons maillées.',
      legend: 'Légende',
      localNode: 'Votre appareil',
      relayNode: 'Nœud relais',
      gatewayNode: 'Passerelle Internet',
      simulatedNotice: 'Les protocoles radio (LoRa/Meshtastic & Reticulum) sont ici visualisés en mode simulation interactive.'
    },
    shield: {
      title: 'MESHORA Shield',
      subtitle: 'Protection et isolation réseau volontaire',
      activateVpn: 'Activer la protection VPN',
      truthWarningTitle: 'Politique de vérité cryptographique',
      truthWarningText: 'Dans ce prototype web, aucun faux voyant n’est affiché. Un tunnel WireGuard complet nécessite le module natif système (Android VpnService / iOS NetworkExtension).',
      dnsProtection: 'Protection contre les fuites DNS',
      killSwitch: 'Blocage du trafic sans tunnel',
      trustedGateways: 'Passerelles de confiance recommandées'
    },
    resilience: {
      title: 'MESHORA Resilience',
      subtitle: 'Continuité intelligente de vos liaisons',
      failoverTitle: 'Gestionnaire de basculement',
      failoverDesc: 'En cas de déconnexion Internet, vos communications basculent instantanément vers le réseau local.',
      consentWarning: 'Consentement requis : MESHORA ne connecte jamais votre appareil à une passerelle inconnue sans votre accord.',
      emergencyDocs: 'Fiches pratiques disponibles hors ligne',
      offlineMap: 'Carte sectorielle hors ligne mise en cache',
      p2pSharing: 'Échange de fichiers local de pair à pair',
      batterySaver: 'Économiseur de Batterie Maillée (Blackout)',
      batterySaverDesc: 'Restreint les intervalles de sondage mesh en arrière-plan pour prolonger l’autonomie du terminal lors de coupures réseau prolongées.',
      batterySaverActiveBadge: 'Économie Active',
      batterySaverStandardBadge: 'Balayage Continu',
      batteryIntervalNormal: 'Standard (10s)',
      batteryIntervalEco: 'Blackout / Éco (60s)',
      batteryIntervalExtreme: 'Survie Extrême (120s)',
      batteryCadenceLabel: 'Cadence de sondage radio',
      batteryDutyCycleLabel: 'Cycle d’activité (Duty-cycle)',
      batteryAutonomyGainLabel: 'Gain d’autonomie estimé',
      batteryForceScanBtn: 'Forcer un sondage immédiat',
      batteryScanningNow: 'Sondage en cours...',
      batteryLastScanLabel: 'Dernier balayage',
      batteryNextScanLabel: 'Prochain balayage',
      batteryJustNow: 'à l’instant',
      batterySecondsAgo: 'il y a {sec}s',
      batteryNextInSec: 'dans {sec}s',
      batterySavingsFeatures: [
        'Sondage espacé (60s à 120s au lieu de 10s)',
        'Mise en veille profonde des radios BLE/Mesh',
        'Suspension des animations GPU non requises',
        'Écoute prioritaire pour les messages d’entraide locaux'
      ],
      communityAlerts: 'Avis d’entraide locaux (expérimental)',
      broadcastTitle: 'Canal d’Entraide & Alertes Locales',
      broadcastSubtitle: 'Échange de messages d’entraide sur le réseau local (BroadcastChannel / Relais). Ne remplace pas le 112.',
      broadcastTriggerBtn: 'Créer un avis d’entraide',
      broadcastPresetSos: 'Alerte Prioritaire',
      broadcastPresetMedical: 'Besoin Médical',
      broadcastPresetEvacuation: 'Évacuation',
      broadcastPresetWater: 'Eau & Vivres',
      broadcastPresetShelter: 'Refuge Sécurisé',
      broadcastPresetHazard: 'Obstacle / Route coupée',
      broadcastFormTitle: 'Titre de l’avis',
      broadcastFormMsg: 'Détails factuels et informations utiles',
      broadcastAttachCoords: 'Joindre ma position estimée',
      broadcastAcousticChime: 'Avertisseur sonore d’alerte',
      broadcastSendBtn: 'Transmettre au maillage local',
      broadcastRelayBtn: 'Relayer l’avis (+1 saut)',
      broadcastActiveFeed: 'Avis reçus ou préparés en local',
      broadcastSimulateNeighbor: 'Simuler avis de proximité',
      broadcastVisualSos: 'Signal Lumineux de Sécurité',
      quickSosBtn: 'Aide d’Urgence (112)',
      quickSosHold: 'Toucher pour afficher',
      quickSosHolding: 'Ouverture...',
      quickSosSent: 'Consignes d’urgence officielles affichées',
      quickSosTitle: 'SERVICES D’URGENCE OFFICIELS (112)',
      quickSosMessage: 'En cas de danger pour une vie humaine, appelez immédiatement le 112. MESHORA est un prototype expérimental sans garantie d’acheminement.',
      quickSosCoordsLabel: 'Coordonnées GPS indicatives',
      quickSosCancelHint: 'Fermer'
    },

    gateways: {
      title: 'Passerelles Disponibles',
      subtitle: 'Nœuds de sortie et ponts d’accès vers l’Internet global.',
      consentModalTitle: 'Autoriser la passerelle ?',
      consentModalText: 'Vous êtes sur le point d’autoriser le routage vers la passerelle suivante :',
      allowOnce: 'Autoriser cette passerelle',
      deny: 'Refuser'
    },
    services: {
      title: 'Services Décentralisés',
      subtitle: 'Passerelles et ponts vers les réseaux ouverts fédérés.',
      nostrDesc: 'Publication et relais via le protocole ouvert Nostr.',
      blueskyDesc: 'Synchronisation et passerelle AT Protocol.',
      mastodonDesc: 'Fédération ActivityPub pour diffusion publique.'
    },
    discover: {
      title: 'Découvrir MESHORA',
      subtitle: 'L’architecture modulaire, libre et respectueuse de votre souveraineté.',
      tableTitle: 'Comparatif d’exécution technique',
      tableColFeature: 'Fonctionnalité',
      tableColPwa: 'Web PWA',
      tableColAndroid: 'Natif Android',
      tableColIos: 'Natif iPhone',
      howToInstallTitle: 'Comment installer MESHORA ?',
      iosGuide: 'Sur iPhone (Safari) : Touchez le bouton « Partager » puis « Sur l’écran d’accueil ».'
    },
    settings: {
      title: 'Paramètres & Identité',
      identityTitle: 'Identité cryptographique locale',
      aliasLabel: 'Nom d’affichage / Pseudonyme',
      fingerprintLabel: 'Empreinte publique',
      languageLabel: 'Langue de l’interface',
      themeLabel: 'Thème d’affichage',
      dark: 'Graphite Sombre',
      light: 'Clair Épuré',
      storageTitle: 'Données locales & Stockage',
      auditTitle: 'Journal de sécurité'
    }
  },
  en: {
    brand: {
      name: 'MESHORA',
      tagline: 'A network that links the others.',
      version: 'V.0.3'
    },
    nav: {
      home: 'Home',
      messages: 'Messages',
      network: 'Network',
      shield: 'Shield',
      resilience: 'Resilience',
      devices: 'Devices',
      gateways: 'Gateways',
      services: 'Services',
      discover: 'Discover',
      settings: 'Settings',
      tests: 'Auto Tests',
      more: 'More'
    },
    actions: {
      connect: 'Connect',
      communicate: 'Communicate',
      discover: 'Discover',
      send: 'Send',
      refresh: 'Refresh',
      install: 'Install Application',
      installIos: 'Install on iOS',
      installGeneric: 'Install PWA',
      close: 'Close',
      enable: 'Enable',
      disable: 'Disable',
      accept: 'Accept',
      refuse: 'Refuse',
      clearCache: 'Clear Cache',
      exportIdentity: 'Export My Identity',
      runTests: 'Run Validations',
      simulateCut: 'Simulate Internet Outage',
      restoreCut: 'Restore Connection'
    },
    status: {
      connected: 'Connected',
      connectedDesc: 'Active and functional Internet connection',
      local_only: 'Local Network',
      local_onlyDesc: 'Direct communication with nearby devices, without Internet',
      offline: 'Offline',
      offlineDesc: 'Messages stored locally awaiting synchronization',
      shieldActive: 'Protected',
      shieldInactive: 'Unprotected',
      queued: 'Queued',
      sent: 'Sent to transport',
      relayed: 'Relayed',
      delivered: 'Delivered (receipt acknowledged)',
      failed: 'Failed',
      nativeRequired: 'Requires native module',
      simulationNotice: 'Topological simulation active',
      inDevelopment: 'In development'
    },
    pillars: {
      mesh: {
        title: 'MESHORA Mesh',
        subtitle: 'Communicate locally',
        description: 'Exchange messages and files directly peer-to-peer, even without Internet access.'
      },
      connect: {
        title: 'MESHORA Connect',
        subtitle: 'Use available gateways',
        description: 'Seamlessly leverage existing networks (Wi-Fi, mobile 4G/5G, neighborhood relays, decentralized protocols).'
      },
      shield: {
        title: 'MESHORA Shield',
        subtitle: 'Protect communications',
        description: 'Activate voluntary network protection with strict verification of tunnels and privacy.'
      },
      resilience: {
        title: 'MESHORA Resilience',
        subtitle: 'Smart connection continuity',
        description: 'Continuity during incidents: local queue for undelivered messages, emergency docs readable offline (prototype).'
      }
    },
    home: {
      welcome: 'Your resilient communication space',
      overview: 'MESHORA aims to unify your communication links so your conversations stay reachable as long as possible (prototype).',
      threeActionsTitle: 'What would you like to do?',
      actionConnectDesc: 'Check your available Internet access, gateways, and tunnels.',
      actionCommunicateDesc: 'Exchange messages between tabs or through a test relay (prototype).',
      actionDiscoverDesc: 'Understand the architecture and install the app on your devices.',
      realConnections: 'Active links detected',
      outboxStatus: 'Local Outbox Queue',
      outboxEmpty: 'All messages are synchronized',
      outboxPending: '{count} message(s) pending sync'
    },
    messages: {
      title: 'Messages',
      publicChannel: 'Local Public Channel',
      emergencyChannel: 'Mutual Aid & Continuity Channel',
      directChannel: 'Direct Chat',
      placeholder: 'Write a message…',
      testNotice: 'Local test: open a 2nd tab in the same browser. Across devices, a test relay is required.',
      searchPlaceholder: 'Search messages...'
    },
    devices: {
      title: 'Nearby Devices',
      subtitle: 'Discovery of nearby devices over local network or mesh links.',
      radarScanning: 'Actively searching for nearby devices...',
      hops: 'hop(s)',
      signal: 'Signal'
    },
    network: {
      title: 'Topology & Nodes',
      subtitle: 'Dynamic view of devices, relays, and mesh routes.',
      legend: 'Legend',
      localNode: 'Your device',
      relayNode: 'Relay node',
      gatewayNode: 'Internet gateway',
      simulatedNotice: 'Radio mesh protocols (LoRa/Meshtastic & Reticulum) are visualized in interactive simulation mode.'
    },
    shield: {
      title: 'MESHORA Shield',
      subtitle: 'Voluntary network protection and isolation',
      activateVpn: 'Activate VPN protection',
      truthWarningTitle: 'Cryptographic truth policy',
      truthWarningText: 'In this web prototype, no fake lights are displayed. A full WireGuard tunnel requires a native OS module (Android VpnService / iOS NetworkExtension).',
      dnsProtection: 'DNS leak protection',
      killSwitch: 'Block non-tunnel traffic',
      trustedGateways: 'Recommended trusted gateways'
    },
    resilience: {
      title: 'MESHORA Resilience',
      subtitle: 'Smart connection continuity',
      failoverTitle: 'Failover manager',
      failoverDesc: 'During an Internet loss, communications immediately switch to your local network.',
      consentWarning: 'Consent required: MESHORA never connects your device to an unknown gateway without your permission.',
      emergencyDocs: 'Emergency guides available offline',
      offlineMap: 'Cached local sector map',
      p2pSharing: 'Local peer-to-peer file transfer',
      batterySaver: 'Mesh Battery Saver (Grid-Down)',
      batterySaverDesc: 'Restricts background mesh scanning intervals to preserve mobile battery during extended grid-down scenarios.',
      batterySaverActiveBadge: 'Saving Active',
      batterySaverStandardBadge: 'Continuous Scan',
      batteryIntervalNormal: 'Standard (10s)',
      batteryIntervalEco: 'Grid-Down / Eco (60s)',
      batteryIntervalExtreme: 'Extreme Survival (120s)',
      batteryCadenceLabel: 'Radio scan cadence',
      batteryDutyCycleLabel: 'Duty cycle',
      batteryAutonomyGainLabel: 'Estimated battery gain',
      batteryForceScanBtn: 'Force immediate scan',
      batteryScanningNow: 'Scanning mesh...',
      batteryLastScanLabel: 'Last scan',
      batteryNextScanLabel: 'Next scan',
      batteryJustNow: 'just now',
      batterySecondsAgo: '{sec}s ago',
      batteryNextInSec: 'in {sec}s',
      batterySavingsFeatures: [
        'Restricted probe interval (60s to 120s instead of 10s)',
        'Deep sleep radio cycles for BLE and Mesh transceivers',
        'Suppressed non-essential GPU animations and render loops',
        'Priority listening for local community notices'
      ],
      communityAlerts: 'Local community notices (experimental)',
      broadcastTitle: 'Community Notices & Local Feed',
      broadcastSubtitle: 'Exchange mutual aid messages across local network (BroadcastChannel / Relay). Does not replace 112.',
      broadcastTriggerBtn: 'Create community notice',
      broadcastPresetSos: 'Priority Alert',
      broadcastPresetMedical: 'Medical Assistance',
      broadcastPresetEvacuation: 'Evacuation',
      broadcastPresetWater: 'Water & Supplies',
      broadcastPresetShelter: 'Secure Shelter',
      broadcastPresetHazard: 'Hazard / Road Block',
      broadcastFormTitle: 'Notice title',
      broadcastFormMsg: 'Factual details and helpful notes',
      broadcastAttachCoords: 'Attach my estimated position',
      broadcastAcousticChime: 'Acoustic alert signal',
      broadcastSendBtn: 'Send to local queue',
      broadcastRelayBtn: 'Relay notice (+1 hop)',
      broadcastActiveFeed: 'Local notices feed (received or simulated)',
      broadcastSimulateNeighbor: 'Simulate neighbor notice',
      broadcastVisualSos: 'Safety Strobe Light',
      quickSosBtn: 'Emergency Help (112)',
      quickSosHold: 'Tap to view',
      quickSosHolding: 'Opening...',
      quickSosSent: 'Official emergency guidelines displayed',
      quickSosTitle: 'OFFICIAL EMERGENCY SERVICES (112)',
      quickSosMessage: 'If life is in danger, immediately dial 112 on your phone. MESHORA is an experimental prototype without guaranteed delivery.',
      quickSosCoordsLabel: 'Indicative GPS coordinates',
      quickSosCancelHint: 'Close'
    },

    gateways: {
      title: 'Available Gateways',
      subtitle: 'Uplink exit nodes and bridges to the wider Internet.',
      consentModalTitle: 'Authorize Gateway?',
      consentModalText: 'You are about to authorize traffic routing to the following gateway:',
      allowOnce: 'Authorize this gateway',
      deny: 'Deny'
    },
    services: {
      title: 'Decentralized Services',
      subtitle: 'Bridges and conduits to open federated networks.',
      nostrDesc: 'Publication and relaying via the open Nostr protocol.',
      blueskyDesc: 'Synchronization and bridge to AT Protocol.',
      mastodonDesc: 'ActivityPub federation for public broadcasting.'
    },
    discover: {
      title: 'Discover MESHORA',
      subtitle: 'Modular, open-source architecture built for sovereignty and daily peace of mind.',
      tableTitle: 'Technical execution comparison',
      tableColFeature: 'Feature',
      tableColPwa: 'Web PWA',
      tableColAndroid: 'Native Android',
      tableColIos: 'Native iPhone',
      howToInstallTitle: 'How to install MESHORA?',
      iosGuide: 'On iPhone (Safari): Tap the "Share" button then tap "Add to Home Screen".'
    },
    settings: {
      title: 'Settings & Identity',
      identityTitle: 'Local cryptographic identity',
      aliasLabel: 'Display Name / Alias',
      fingerprintLabel: 'Public Fingerprint',
      languageLabel: 'Interface Language',
      themeLabel: 'Color Theme',
      dark: 'Dark Graphite',
      light: 'Crisp Light',
      storageTitle: 'Local Storage & Cache',
      auditTitle: 'Security Audit Log'
    }
  }
} as const;

export type TranslationKey = typeof i18nData.fr;
