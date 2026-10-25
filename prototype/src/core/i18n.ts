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
      version: 'V.0.2'
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
      relayed: 'Relayé',
      delivered: 'Délivré',
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
        description: 'Bascule automatique et sereine en cas d’aléa : zéro message perdu, documents de secours locaux et partage hors-ligne.'
      }
    },
    home: {
      welcome: 'Votre espace de communication résilient',
      overview: 'MESHORA unifie vos moyens de liaison pour garantir que vos échanges restent toujours accessibles.',
      threeActionsTitle: 'Que souhaitez-vous faire ?',
      actionConnectDesc: 'Vérifier vos accès Internet, passerelles et tunnels disponibles.',
      actionCommunicateDesc: 'Échanger des messages en direct sur le canal local ou privé.',
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
      placeholder: 'Écrivez un message (chiffré localement)...',
      testNotice: 'Ouvrez un 2ᵉ onglet pour tester la messagerie en direct instantanée !',
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
        'Priorité absolue maintenue pour la réception de balises SOS'
      ],
      communityAlerts: 'Avis communautaires vérifiés',
      broadcastTitle: 'Diffusion d’Urgence Mesh & Bluetooth',
      broadcastSubtitle: 'Émission de balises de détresse de proximité sur le réseau local et maillage Bluetooth / LoRa sans réseau cellulaire ni Internet.',
      broadcastTriggerBtn: 'Diffuser une alerte d’urgence',
      broadcastPresetSos: 'SOS Vitale',
      broadcastPresetMedical: 'Urgence Médicale',
      broadcastPresetEvacuation: 'Évacuation',
      broadcastPresetWater: 'Eau & Vivres',
      broadcastPresetShelter: 'Refuge Sécurisé',
      broadcastPresetHazard: 'Danger / Route coupée',
      broadcastFormTitle: 'Titre de l’alerte d’urgence',
      broadcastFormMsg: 'Détails factuels et besoin d’assistance',
      broadcastAttachCoords: 'Joindre ma position estimée',
      broadcastAcousticChime: 'Avertisseur sonore d’alerte',
      broadcastSendBtn: 'Diffuser sur le Mesh Local',
      broadcastRelayBtn: 'Relayer l’alerte (+1 saut)',
      broadcastActiveFeed: 'Balises d’urgence actives sur le maillage',
      broadcastSimulateNeighbor: 'Simuler alerte de proximité',
      broadcastVisualSos: 'Balise Stroboscopique SOS',
      quickSosBtn: 'SOS Rapide',
      quickSosHold: 'Maintenir 1.5s',
      quickSosHolding: 'Diffusion dans...',
      quickSosSent: 'Signal de détresse diffusé aux nœuds mesh !',
      quickSosTitle: 'DÉTRESSE VITALE — SOS IMMÉDIAT',
      quickSosMessage: 'Signal de détresse d’urgence déclenché. Besoin d’assistance immédiate sur site.',
      quickSosCoordsLabel: 'Dernières coordonnées',
      quickSosCancelHint: 'Relâcher pour annuler'
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
      version: 'V.0.2'
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
      relayed: 'Relayed',
      delivered: 'Delivered',
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
        description: 'Smooth and calm failover during incidents: zero lost messages, local emergency docs, and offline sharing.'
      }
    },
    home: {
      welcome: 'Your resilient communication space',
      overview: 'MESHORA unifies your communication links to ensure your conversations remain always accessible.',
      threeActionsTitle: 'What would you like to do?',
      actionConnectDesc: 'Check your available Internet access, gateways, and tunnels.',
      actionCommunicateDesc: 'Exchange real-time messages on local or private channels.',
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
      placeholder: 'Write a message (locally protected)...',
      testNotice: 'Open a 2nd browser tab to test live peer-to-peer messaging instantly!',
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
        'Continuous high-priority listener for vital SOS beacons'
      ],
      communityAlerts: 'Verified community alerts',
      broadcastTitle: 'Mesh & Bluetooth Emergency Broadcast',
      broadcastSubtitle: 'Transmit proximity distress beacons across local mesh and Bluetooth / LoRa links without cellular or Internet.',
      broadcastTriggerBtn: 'Broadcast emergency alert',
      broadcastPresetSos: 'Vital SOS',
      broadcastPresetMedical: 'Medical Emergency',
      broadcastPresetEvacuation: 'Evacuation',
      broadcastPresetWater: 'Water & Supplies',
      broadcastPresetShelter: 'Secure Shelter',
      broadcastPresetHazard: 'Hazard / Road Block',
      broadcastFormTitle: 'Emergency alert title',
      broadcastFormMsg: 'Factual details and assistance needed',
      broadcastAttachCoords: 'Attach my estimated position',
      broadcastAcousticChime: 'Acoustic alert signal',
      broadcastSendBtn: 'Broadcast over Local Mesh',
      broadcastRelayBtn: 'Relay alert (+1 hop)',
      broadcastActiveFeed: 'Active mesh emergency beacons',
      broadcastSimulateNeighbor: 'Simulate neighbor alert',
      broadcastVisualSos: 'SOS Strobe Beacon',
      quickSosBtn: 'Quick SOS',
      quickSosHold: 'Hold 1.5s',
      quickSosHolding: 'Broadcasting in...',
      quickSosSent: 'Distress signal broadcast to all mesh nodes!',
      quickSosTitle: 'VITAL DISTRESS — IMMEDIATE SOS',
      quickSosMessage: 'Urgent distress signal triggered. Immediate on-site assistance required.',
      quickSosCoordsLabel: 'Last known coordinates',
      quickSosCancelHint: 'Release to cancel'
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
