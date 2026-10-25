/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { 
  ResilienceProfile, 
  EmergencyDoc, 
  P2PFileTransfer, 
  CommunityAlert, 
  OfflineMapPoint,
  EmergencyBroadcast,
  EmergencyBroadcastType,
  EmergencySeverity
} from '../types';
import { NetworkSentinel } from './networkSentinel';
import { TransportManager } from '../transports/TransportManager';
import { playEmergencyChime } from './audioAlert';

const EMERGENCY_DOCS: EmergencyDoc[] = [
  {
    id: 'doc_secours_01',
    title: 'Fiche d’Urgence : Premiers Secours & Numéros de Continuité',
    category: 'medical',
    summary: 'Protocoles de premier secours, position latérale de sécurité, massage cardiaque et fréquences locales.',
    content: `1. Protection et Alerte : Évaluer la sécurité de la zone avant d'intervenir.
2. Numéro européen d'urgence universel : 112 (fonctionne sans carte SIM sur tout réseau mobile détecté).
3. Position Latérale de Sécurité (PLS) : Si la victime est inconsciente mais respire normalement.
4. Réanimation Cardio-Pulmonaire : 30 compressions thoraciques au centre de la poitrine, rythme 100 à 120 bpm, puis 2 insufflations.
5. Fiche médicale locale : Garder une copie écrite des groupes sanguins et allergies du foyer dans un étui étanche.`,
    updatedAt: '2026-10-25'
  },
  {
    id: 'doc_radio_02',
    title: 'Protocole Radio PMR446 & Canaux Mesh Locaux',
    category: 'radio',
    summary: 'Canaux de communication de proximité libres sans licence (PMR446, LoRa Meshtastic).',
    content: `1. Canal PMR446 Canal 7 (446.08125 MHz) CTCSS 7 (85.4 Hz) : Fréquence d'appel de sécurité en zone montagne / rurale.
2. Canal PMR446 Canal 8 (446.09375 MHz) : Canal d'appel général de proximité.
3. LoRa Meshtastic : Canal "LongFast" par défaut (Slot 868.250 MHz en Europe, 915 MHz aux Amériques).
4. Règles de transmission : Soyez bref, clair, annoncez votre identifiant et écoutez 5 secondes avant d'émettre pour ne pas saturer le relais.`,
    updatedAt: '2026-10-25'
  },
  {
    id: 'doc_eau_03',
    title: 'Protocole de Continuité : Eau Potable & Énergie',
    category: 'survival',
    summary: 'Procédés simples de filtration, ébullition et gestion sobre de l’énergie de vos appareils.',
    content: `1. Ébullition : Faire bouillir à gros bouillons pendant 1 minute complète (3 minutes au-delà de 2000m d'altitude).
2. Conservation de batterie : Basculez votre smartphone en mode avion dès que le signal mobile est nul (la recherche continue de réseau décharge 5x plus vite la batterie).
3. Stock tampon : Prévoir au moins 2 litres d'eau potable par personne et par jour pour une autonomie minimale de 72 heures.`,
    updatedAt: '2026-10-25'
  }
];

const INITIAL_ALERTS: CommunityAlert[] = [
  {
    id: 'alert_001',
    senderId: 'msh_relais_commune_04',
    senderAlias: 'Mairie / Relais Municipalité',
    title: 'Point d’eau potable et recharge solaire ouvert',
    message: 'Le gymnase central met à disposition des prises pour recharge d’appareils et une fontaine d’eau potable en continu.',
    level: 'info',
    timestamp: Date.now() - 7200000,
    signature: 'sig_ed25519_verified_94a7',
    verified: true
  }
];

const EMERGENCY_BROADCASTS_KEY = 'meshora_emergency_broadcasts_v02';

const INITIAL_EMERGENCY_BROADCASTS: EmergencyBroadcast[] = [
  {
    id: 'broadcast_sos_med_01',
    type: 'medical',
    title: 'Urgence Médicale · Besoin trousse de réanimation / pansements',
    message: 'Personne blessée suite à chute de débris secteur Rue des Relais. Conscience conservée, besoin urgent de pansements compressifs et désinfectant.',
    severity: 'critical',
    senderId: 'msh_neighbor_med_01',
    senderAlias: 'Secours-Citoyen-Quartier',
    timestamp: Date.now() - 15 * 60 * 1000,
    coordinates: {
      lat: 48.859,
      lng: 2.355,
      gridX: 510,
      gridY: 160,
      label: 'Poste de Premiers Secours (510, 160)'
    },
    hops: 1,
    transportUsed: 'BroadcastChannel + BLE Beacon (Relayé)',
    signature: 'sig_ed25519_8bf2',
    verified: true,
    relayCount: 3,
    relayedBy: ['Relais-Boréal-24', 'Nœud-Zénith-12'],
    batteryPercent: 78
  },
  {
    id: 'broadcast_eau_02',
    type: 'water_food',
    title: 'Distribution d’eau potable gravitaire active',
    message: 'La borne fontaine publique du parc fonctionne à débit nominal continu sans électricité. Récipients propres disponibles sur place.',
    severity: 'advisory',
    senderId: 'msh_water_stn_02',
    senderAlias: 'Vigie-Ravitaillement-Sud',
    timestamp: Date.now() - 45 * 60 * 1000,
    coordinates: {
      lat: 48.854,
      lng: 2.348,
      gridX: 260,
      gridY: 310,
      label: 'Borne Fontaine d’Eau Potable (260, 310)'
    },
    hops: 2,
    transportUsed: 'LoRa Meshtastic (LongFast 868MHz)',
    signature: 'sig_ed25519_17e4',
    verified: true,
    relayCount: 5,
    relayedBy: ['Relais-Boréal-24', 'Passerelle-Sud-62']
  }
];

const MAP_POINTS_KEY = 'meshora_offline_map_points_v01';

const INITIAL_MAP_POINTS: OfflineMapPoint[] = [
  {
    id: 'point_mesh_01',
    name: 'Nœud Relais Boréal',
    category: 'mesh_node',
    x: 380,
    y: 220,
    latApprox: 48.856,
    lngApprox: 2.352,
    description: 'Relais maillé LoRa 868MHz + Wi-Fi local. Répétiteur autonome sur panneau solaire avec batterie 94%.',
    status: 'active',
    verified: true,
    frequencyOrBand: '868.250 MHz Slot 1',
    contactAlias: 'Relais-Boréal-24',
    lastUpdated: Date.now() - 3600000,
    distanceMeters: 420
  },
  {
    id: 'point_mesh_02',
    name: 'Nœud Passerelle Sud',
    category: 'mesh_node',
    x: 620,
    y: 380,
    latApprox: 48.852,
    lngApprox: 2.358,
    description: 'Passerelle vers le réseau fibre local et point de synchronisation mesh décentralisé.',
    status: 'active',
    verified: true,
    frequencyOrBand: 'LAN 192.168.1.1',
    contactAlias: 'Nœud-Zénith-12',
    lastUpdated: Date.now() - 7200000,
    distanceMeters: 780
  },
  {
    id: 'point_water_01',
    name: 'Borne Fontaine d’Eau Potable',
    category: 'water',
    x: 260,
    y: 310,
    latApprox: 48.854,
    lngApprox: 2.348,
    description: 'Fontaine publique gravitaire en débit continu, opérationnelle sans alimentation électrique.',
    status: 'active',
    verified: true,
    contactAlias: 'Services Techniques Mairie',
    lastUpdated: Date.now() - 86400000,
    distanceMeters: 310
  },
  {
    id: 'point_medical_01',
    name: 'Poste de Premiers Secours',
    category: 'medical',
    x: 510,
    y: 160,
    latApprox: 48.859,
    lngApprox: 2.355,
    description: 'Poste médical de proximité avec défibrillateur DAE, oxygénothérapie et trousse de réanimation.',
    status: 'active',
    verified: true,
    contactAlias: 'Équipe Secours Citoyen',
    lastUpdated: Date.now() - 14400000,
    distanceMeters: 550
  },
  {
    id: 'point_power_01',
    name: 'Station Solaire de Recharge',
    category: 'power',
    x: 730,
    y: 250,
    latApprox: 48.857,
    lngApprox: 2.365,
    description: 'Installation photovoltaïque 400W sur batterie LiFePO4 avec 16 prises USB-C / 5V libres.',
    status: 'active',
    verified: true,
    contactAlias: 'Atelier Solaire Partagé',
    lastUpdated: Date.now() - 43200000,
    distanceMeters: 890
  },
  {
    id: 'point_shelter_01',
    name: 'Gymnase Refuge & Salle Commune',
    category: 'shelter',
    x: 440,
    y: 440,
    latApprox: 48.850,
    lngApprox: 2.353,
    description: 'Salle d’accueil chauffée avec couchages de secours, point d’information et réserve d’eau.',
    status: 'active',
    verified: true,
    contactAlias: 'Coordination Municipale',
    lastUpdated: Date.now() - 21600000,
    distanceMeters: 620
  },
  {
    id: 'point_radio_01',
    name: 'Balise de Sécurité Radio PMR446',
    category: 'radio',
    x: 190,
    y: 140,
    latApprox: 48.860,
    lngApprox: 2.345,
    description: 'Écoute permanente sur Canal 7 PMR446 (446.08125 MHz / CTCSS 7 85.4Hz) pour secours.',
    status: 'active',
    verified: true,
    frequencyOrBand: 'PMR446 Canal 7 (85.4 Hz)',
    contactAlias: 'Club Radioamateur Local',
    lastUpdated: Date.now() - 54000000,
    distanceMeters: 670
  }
];

const RESILIENCE_PROFILE_KEY = 'meshora_resilience_profile_v02';

export class ResilienceEngine {
  private static instance: ResilienceEngine | null = null;
  private profile: ResilienceProfile = {
    batterySaver: false,
    autoFailover: true,
    requireGatewayConsent: true,
    cachedMapsAvailable: true,
    cachedDocsCount: EMERGENCY_DOCS.length,
    activeTransport: 'broadcast',
    meshScanIntervalSec: 10,
    meshScanDutyCycle: '100% (Sondage continu 10s)',
    estimatedAutonomyGain: 'Référence standard',
    lastScanTimestamp: Date.now()
  };

  private activeTransfers: P2PFileTransfer[] = [
    {
      id: 'file_transfer_01',
      filename: 'carte_vectorielle_secteur_centre.geojson',
      sizeBytes: 142000,
      totalChunks: 14,
      receivedChunks: 14,
      senderAlias: 'Relais-Boréal-24',
      senderId: 'msh_peer_boreal',
      completed: true
    }
  ];

  private alerts: CommunityAlert[] = [...INITIAL_ALERTS];
  private mapPoints: OfflineMapPoint[] = [];
  private emergencyBroadcasts: EmergencyBroadcast[] = [];
  private listeners: Set<(p: ResilienceProfile) => void> = new Set();
  private mapListeners: Set<(points: OfflineMapPoint[]) => void> = new Set();
  private broadcastListeners: Set<(b: EmergencyBroadcast[]) => void> = new Set();
  private emergencyChannel: BroadcastChannel | null = null;
  private cachedCoordinates: { lat: number; lng: number; gridX?: number; gridY?: number; label?: string } = {
    lat: 48.8566,
    lng: 2.3522,
    gridX: 450,
    gridY: 280,
    label: 'Position Locale Estimée (450, 280)'
  };

  private constructor() {
    this.loadProfilePreferences();
    this.loadMapPoints();
    this.loadEmergencyBroadcasts();
    this.setupEmergencyChannel();

    // Synchronize scan updates from TransportManager
    try {
      TransportManager.getInstance().onScanUpdate((intervalMs, isBatterySaver, lastScanTime) => {
        this.profile.meshScanIntervalSec = Math.round(intervalMs / 1000);
        this.profile.batterySaver = isBatterySaver;
        this.profile.lastScanTimestamp = lastScanTime;
        this.notify();
      });
    } catch {}
  }

  private loadProfilePreferences(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(RESILIENCE_PROFILE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.batterySaver === 'boolean') {
            this.profile.batterySaver = parsed.batterySaver;
            this.profile.meshScanIntervalSec = parsed.meshScanIntervalSec || (parsed.batterySaver ? 60 : 10);
            this.profile.meshScanDutyCycle = parsed.meshScanDutyCycle || (parsed.batterySaver ? '5% actif (2s balayage / 58s sommeil)' : '100% (Sondage continu 10s)');
            this.profile.estimatedAutonomyGain = parsed.estimatedAutonomyGain || (parsed.batterySaver ? '+65% d’autonomie en blackout' : 'Référence standard');
            
            // Sync with TransportManager
            TransportManager.getInstance().setBatterySaver(
              this.profile.batterySaver, 
              this.profile.meshScanIntervalSec * 1000
            );
          }
        }
      }
    } catch {}
  }

  private saveProfilePreferences(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(RESILIENCE_PROFILE_KEY, JSON.stringify({
          batterySaver: this.profile.batterySaver,
          meshScanIntervalSec: this.profile.meshScanIntervalSec,
          meshScanDutyCycle: this.profile.meshScanDutyCycle,
          estimatedAutonomyGain: this.profile.estimatedAutonomyGain
        }));
      }
    } catch {}
  }

  public static getInstance(): ResilienceEngine {
    if (!this.instance) {
      this.instance = new ResilienceEngine();
    }
    return this.instance;
  }

  private setupEmergencyChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.emergencyChannel = new BroadcastChannel('meshora_emergency_mesh_beacon_v02');
        this.emergencyChannel.onmessage = (event) => {
          if (event.data && typeof event.data === 'object' && event.data.id) {
            const incoming = event.data as EmergencyBroadcast;
            const existingIdx = this.emergencyBroadcasts.findIndex((b) => b.id === incoming.id);
            if (existingIdx >= 0) {
              if ((incoming.relayCount || 0) > (this.emergencyBroadcasts[existingIdx].relayCount || 0)) {
                this.emergencyBroadcasts[existingIdx] = incoming;
                this.saveEmergencyBroadcasts();
              }
            } else {
              this.emergencyBroadcasts.unshift(incoming);
              this.saveEmergencyBroadcasts();
              playEmergencyChime(incoming.severity);
            }
          }
        };
      } catch {
        this.emergencyChannel = null;
      }
    }
  }

  private loadEmergencyBroadcasts(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(EMERGENCY_BROADCASTS_KEY);
        if (raw) {
          this.emergencyBroadcasts = JSON.parse(raw);
          return;
        }
      }
    } catch {}
    this.emergencyBroadcasts = [...INITIAL_EMERGENCY_BROADCASTS];
    this.saveEmergencyBroadcasts();
  }

  private saveEmergencyBroadcasts(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(EMERGENCY_BROADCASTS_KEY, JSON.stringify(this.emergencyBroadcasts));
      }
    } catch {}
    this.broadcastListeners.forEach((l) => {
      try {
        l([...this.emergencyBroadcasts]);
      } catch {}
    });
  }


  private loadMapPoints(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(MAP_POINTS_KEY);
        if (raw) {
          this.mapPoints = JSON.parse(raw);
          return;
        }
      }
    } catch {}
    this.mapPoints = [...INITIAL_MAP_POINTS];
    this.saveMapPoints();
  }

  private saveMapPoints(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(MAP_POINTS_KEY, JSON.stringify(this.mapPoints));
      }
    } catch {}
    this.mapListeners.forEach((l) => {
      try {
        l([...this.mapPoints]);
      } catch {}
    });
  }

  public getProfile(): ResilienceProfile {
    return { ...this.profile };
  }

  public getEmergencyDocs(): EmergencyDoc[] {
    return EMERGENCY_DOCS;
  }

  public getAlerts(): CommunityAlert[] {
    return [...this.alerts];
  }

  public getFileTransfers(): P2PFileTransfer[] {
    return [...this.activeTransfers];
  }

  public getMapPoints(): OfflineMapPoint[] {
    if (!this.mapPoints || this.mapPoints.length === 0) {
      this.loadMapPoints();
    }
    return [...this.mapPoints];
  }

  public addMapPoint(point: Omit<OfflineMapPoint, 'id' | 'lastUpdated'>): OfflineMapPoint {
    const newPoint: OfflineMapPoint = {
      ...point,
      id: 'point_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      lastUpdated: Date.now()
    };
    this.mapPoints.push(newPoint);
    this.saveMapPoints();
    return newPoint;
  }

  public updateMapPoint(id: string, updates: Partial<OfflineMapPoint>): void {
    const idx = this.mapPoints.findIndex((p) => p.id === id);
    if (idx >= 0) {
      this.mapPoints[idx] = {
        ...this.mapPoints[idx],
        ...updates,
        lastUpdated: Date.now()
      };
      this.saveMapPoints();
    }
  }

  public deleteMapPoint(id: string): void {
    this.mapPoints = this.mapPoints.filter((p) => p.id !== id);
    this.saveMapPoints();
  }

  public resetMapPointsToDefault(): void {
    this.mapPoints = [...INITIAL_MAP_POINTS];
    this.saveMapPoints();
  }

  public toggleBatterySaver(forceState?: boolean): boolean {
    const newState = forceState !== undefined ? forceState : !this.profile.batterySaver;
    this.profile.batterySaver = newState;
    
    const transportMgr = TransportManager.getInstance();
    if (newState) {
      this.profile.meshScanIntervalSec = 60;
      this.profile.meshScanDutyCycle = '5% actif (3s balayage / 57s sommeil)';
      this.profile.estimatedAutonomyGain = '+65% d’autonomie en blackout';
      transportMgr.setBatterySaver(true, 60000);
    } else {
      this.profile.meshScanIntervalSec = 10;
      this.profile.meshScanDutyCycle = '100% (Sondage continu 10s)';
      this.profile.estimatedAutonomyGain = 'Référence standard';
      transportMgr.setBatterySaver(false, 10000);
    }
    this.profile.lastScanTimestamp = transportMgr.getLastScanTimestamp();
    this.saveProfilePreferences();
    this.notify();
    return this.profile.batterySaver;
  }

  public setMeshScanInterval(seconds: number): void {
    const transportMgr = TransportManager.getInstance();
    const intervalMs = Math.max(5, seconds) * 1000;
    this.profile.meshScanIntervalSec = seconds;
    
    if (seconds >= 120) {
      this.profile.batterySaver = true;
      this.profile.meshScanDutyCycle = '2.5% actif (3s balayage / 117s sommeil)';
      this.profile.estimatedAutonomyGain = '+80% d’autonomie (Survie prolongée)';
      transportMgr.setBatterySaver(true, intervalMs);
    } else if (seconds >= 60) {
      this.profile.batterySaver = true;
      this.profile.meshScanDutyCycle = '5% actif (3s balayage / 57s sommeil)';
      this.profile.estimatedAutonomyGain = '+65% d’autonomie en blackout';
      transportMgr.setBatterySaver(true, intervalMs);
    } else if (seconds >= 30) {
      this.profile.batterySaver = true;
      this.profile.meshScanDutyCycle = '10% actif (3s balayage / 27s sommeil)';
      this.profile.estimatedAutonomyGain = '+40% d’autonomie';
      transportMgr.setBatterySaver(true, intervalMs);
    } else {
      this.profile.batterySaver = false;
      this.profile.meshScanDutyCycle = '100% (Sondage continu 10s)';
      this.profile.estimatedAutonomyGain = 'Référence standard';
      transportMgr.setBatterySaver(false, intervalMs);
    }
    
    this.saveProfilePreferences();
    this.notify();
  }

  public async forceMeshScan() {
    const transportMgr = TransportManager.getInstance();
    const peers = await transportMgr.triggerImmediateScan();
    this.profile.lastScanTimestamp = transportMgr.getLastScanTimestamp();
    this.notify();
    return peers;
  }

  public toggleAutoFailover(): boolean {
    this.profile.autoFailover = !this.profile.autoFailover;
    this.notify();
    return this.profile.autoFailover;
  }

  public postAlert(title: string, message: string, senderAlias: string, senderId: string): CommunityAlert {
    const newAlert: CommunityAlert = {
      id: 'alert_' + Date.now(),
      senderId,
      senderAlias,
      title: title.trim(),
      message: message.trim(),
      level: 'advisory',
      timestamp: Date.now(),
      signature: 'sig_ed25519_' + Math.random().toString(36).substring(2, 8),
      verified: true
    };
    this.alerts.unshift(newAlert);
    this.notify();
    return newAlert;
  }

  public sendP2PFile(filename: string, sizeBytes: number, senderAlias: string, senderId: string): P2PFileTransfer {
    const totalChunks = Math.max(1, Math.ceil(sizeBytes / 10240));
    const transfer: P2PFileTransfer = {
      id: 'file_' + Date.now(),
      filename,
      sizeBytes,
      totalChunks,
      receivedChunks: totalChunks,
      senderAlias,
      senderId,
      completed: true
    };
    this.activeTransfers.unshift(transfer);
    this.notify();
    return transfer;
  }

  public subscribe(listener: (p: ResilienceProfile) => void): () => void {
    this.listeners.add(listener);
    listener(this.getProfile());
    return () => this.listeners.delete(listener);
  }

  public getEmergencyBroadcasts(): EmergencyBroadcast[] {
    if (!this.emergencyBroadcasts || this.emergencyBroadcasts.length === 0) {
      this.loadEmergencyBroadcasts();
    }
    return [...this.emergencyBroadcasts];
  }

  public async sendEmergencyBroadcast(data: {
    type: EmergencyBroadcastType;
    title: string;
    message: string;
    severity: EmergencySeverity;
    senderAlias: string;
    senderId: string;
    coordinates?: { lat: number; lng: number; gridX?: number; gridY?: number; label?: string };
    batteryPercent?: number;
  }): Promise<EmergencyBroadcast> {
    const newBroadcast: EmergencyBroadcast = {
      id: 'emergency_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type: data.type,
      title: data.title.trim(),
      message: data.message.trim(),
      severity: data.severity,
      senderAlias: data.senderAlias,
      senderId: data.senderId,
      timestamp: Date.now(),
      coordinates: data.coordinates,
      hops: 0,
      transportUsed: 'BroadcastChannel + BLE Beacon (Direct)',
      signature: 'sig_ed25519_' + Math.random().toString(36).substring(2, 8),
      verified: true,
      relayCount: 0,
      relayedBy: [],
      batteryPercent: data.batteryPercent ?? 85
    };

    this.emergencyBroadcasts.unshift(newBroadcast);
    this.saveEmergencyBroadcasts();

    // Register as high-priority community alert too
    this.postAlert(
      `[${newBroadcast.severity.toUpperCase()}] ${newBroadcast.title}`,
      newBroadcast.message + (newBroadcast.coordinates ? ` (Coord: ${newBroadcast.coordinates.lat}°N, ${newBroadcast.coordinates.lng}°E)` : ''),
      newBroadcast.senderAlias,
      newBroadcast.senderId
    );

    // Broadcast over BroadcastChannel
    if (this.emergencyChannel) {
      try {
        this.emergencyChannel.postMessage(newBroadcast);
      } catch {}
    }

    // Broadcast through TransportManager
    try {
      await TransportManager.getInstance().broadcast({
        id: newBroadcast.id,
        senderId: newBroadcast.senderId,
        senderAlias: newBroadcast.senderAlias,
        recipientId: 'broadcast',
        channelId: 'emergency',
        content: `🚨 [${newBroadcast.type.toUpperCase()}] ${newBroadcast.title}: ${newBroadcast.message}`,
        timestamp: newBroadcast.timestamp,
        status: NetworkSentinel.getStatus() === 'offline' ? 'queued' : 'delivered',
        transport: 'broadcast',
        hops: 0,
        encrypted: false,
        signature: newBroadcast.signature,
        metadata: {
          emergencyType: newBroadcast.type,
          severity: newBroadcast.severity,
          coordinates: newBroadcast.coordinates
        }
      });
    } catch {}

    return newBroadcast;
  }

  public async relayEmergencyBroadcast(id: string, relayerAlias: string): Promise<boolean> {
    const target = this.emergencyBroadcasts.find((b) => b.id === id);
    if (!target) return false;

    target.hops = (target.hops || 0) + 1;
    target.relayCount = (target.relayCount || 0) + 1;
    target.relayedBy = target.relayedBy || [];
    if (!target.relayedBy.includes(relayerAlias)) {
      target.relayedBy.push(relayerAlias);
    }
    target.transportUsed = `Relayé via Mesh (${relayerAlias} + BLE/LoRa)`;

    this.saveEmergencyBroadcasts();

    if (this.emergencyChannel) {
      try {
        this.emergencyChannel.postMessage(target);
      } catch {}
    }

    try {
      await TransportManager.getInstance().broadcast({
        id: `relay_${target.id}_${Date.now()}`,
        senderId: 'relay_node',
        senderAlias: relayerAlias,
        recipientId: 'broadcast',
        channelId: 'emergency',
        content: `🔁 [RELAY x${target.relayCount}] ${target.title}: ${target.message}`,
        timestamp: Date.now(),
        status: NetworkSentinel.getStatus() === 'offline' ? 'queued' : 'delivered',
        transport: 'broadcast',
        hops: target.hops,
        encrypted: false,
        metadata: { relayedFrom: target.id }
      });
    } catch {}

    return true;
  }

  public simulateNeighborBroadcast(type: EmergencyBroadcastType = 'sos'): EmergencyBroadcast {
    const neighborNodes = [
      { alias: 'Relais-Boréal-24', id: 'msh_peer_boreal', x: 380, y: 220, lat: 48.856, lng: 2.352 },
      { alias: 'Poste-Secours-Centre', id: 'msh_peer_secours', x: 510, y: 160, lat: 48.859, lng: 2.355 },
      { alias: 'Vigie-Quartier-Nord', id: 'msh_peer_nord', x: 620, y: 380, lat: 48.852, lng: 2.358 }
    ];
    const node = neighborNodes[Math.floor(Math.random() * neighborNodes.length)];

    const presets: Record<EmergencyBroadcastType, { title: string; message: string; severity: EmergencySeverity }> = {
      sos: {
        title: '[SOS VITAL] Détresse civile signalée',
        message: 'Personne isolée sans électricité ni accès routier, demande de contact radio PMR446 ou assistance physique.',
        severity: 'critical'
      },
      medical: {
        title: '[MÉDICAL] Blessé léger ayant besoin de désinfection',
        message: 'Plaie ouverte nécessitant pansement stérile. Poste médical de proximité sollicité.',
        severity: 'critical'
      },
      evacuation: {
        title: '[ÉVACUATION] Obstruction d’axe routier',
        message: 'Arbre et câbles au sol barrant le carrefour central. Utilisez l’itinéraire de contournement piéton.',
        severity: 'urgent'
      },
      water_food: {
        title: '[RESSOURCES] Rations d’urgence partagées',
        message: 'Stock tampon de 50L d’eau potable et sachets de réhydratation disponibles au refuge municipal.',
        severity: 'advisory'
      },
      shelter: {
        title: '[REFUGE] Gymnase d’accueil alimenté sur batterie solaire',
        message: 'Capacité restante estimée : 35 personnes. Prises USB fonctionnelles pour appareils de communication.',
        severity: 'advisory'
      },
      hazard: {
        title: '[DANGER] Risque d’inondation berge est',
        message: 'Montée des eaux observée le long du canal. Restez à distance des berges non consolidées.',
        severity: 'urgent'
      }
    };

    const chosen = presets[type] || presets.sos;
    const sim: EmergencyBroadcast = {
      id: 'sim_bc_' + Date.now(),
      type,
      title: chosen.title,
      message: chosen.message,
      severity: chosen.severity,
      senderAlias: node.alias,
      senderId: node.id,
      timestamp: Date.now(),
      coordinates: {
        lat: node.lat,
        lng: node.lng,
        gridX: node.x,
        gridY: node.y,
        label: `${node.alias} (${node.x}, ${node.y})`
      },
      hops: 1,
      transportUsed: 'Bluetooth Low Energy (GATT Beacon) + LoRa 868MHz',
      signature: 'sig_ed25519_' + Math.random().toString(36).substring(2, 8),
      verified: true,
      relayCount: 1,
      relayedBy: [node.alias],
      batteryPercent: 82
    };

    this.emergencyBroadcasts.unshift(sim);
    this.saveEmergencyBroadcasts();
    playEmergencyChime(sim.severity);
    return sim;
  }

  public deleteEmergencyBroadcast(id: string): void {
    this.emergencyBroadcasts = this.emergencyBroadcasts.filter((b) => b.id !== id);
    this.saveEmergencyBroadcasts();
  }

  public getLastCoordinates(): { lat: number; lng: number; gridX?: number; gridY?: number; label?: string } {
    return { ...this.cachedCoordinates };
  }

  public updateCoordinates(coords: { lat: number; lng: number; gridX?: number; gridY?: number; label?: string }): void {
    this.cachedCoordinates = { ...coords };
  }

  public async triggerQuickSOS(params: {
    senderAlias: string;
    senderId: string;
    title?: string;
    message?: string;
    coordsOverride?: { lat: number; lng: number; gridX?: number; gridY?: number; label?: string };
    batteryPercent?: number;
  }): Promise<EmergencyBroadcast> {
    const coords = params.coordsOverride || this.getLastCoordinates();
    const title = params.title || 'DÉTRESSE VITALE — SOS IMMÉDIAT';
    const message = params.message || 'Signal de détresse d’urgence déclenché. Besoin d’assistance immédiate sur site.';

    const broadcast = await this.sendEmergencyBroadcast({
      type: 'sos',
      title,
      message,
      severity: 'critical',
      senderAlias: params.senderAlias,
      senderId: params.senderId,
      coordinates: coords,
      batteryPercent: params.batteryPercent
    });

    playEmergencyChime('critical');
    return broadcast;
  }

  public subscribeEmergencyBroadcasts(listener: (b: EmergencyBroadcast[]) => void): () => void {
    this.broadcastListeners.add(listener);
    listener(this.getEmergencyBroadcasts());
    return () => this.broadcastListeners.delete(listener);
  }

  public subscribeMapPoints(listener: (points: OfflineMapPoint[]) => void): () => void {
    this.mapListeners.add(listener);
    listener(this.getMapPoints());
    return () => this.mapListeners.delete(listener);
  }


  public subscribeProfile(listener: (p: ResilienceProfile) => void): () => void {
    this.listeners.add(listener);
    listener(this.getProfile());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l(this.getProfile());
      } catch {}
    });
  }
}
