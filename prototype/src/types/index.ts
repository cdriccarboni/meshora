/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

export type NetworkStatusType = 'connected' | 'local_only' | 'offline';

export type TransportType = 
  | 'lan'
  | 'broadcast'
  | 'websocket'
  | 'bluetooth'
  | 'meshtastic'
  | 'reticulum';

export type MessageStatus = 'queued' | 'relayed' | 'delivered' | 'failed';

export interface MeshMessage {
  id: string;
  senderId: string;
  senderAlias: string;
  recipientId: string; // 'broadcast' or specific peer ID
  channelId: string; // e.g. 'general', 'emergency', 'local'
  content: string;
  timestamp: number;
  status: MessageStatus;
  transport: TransportType;
  hops: number;
  encrypted: boolean;
  signature?: string;
  metadata?: Record<string, unknown>;
}

export interface MeshPeer {
  id: string;
  alias: string;
  transport: TransportType;
  rssi?: number; // signal strength in dBm (-90 to -30)
  hops: number;
  lastSeen: number;
  isGateway: boolean;
  capabilities: string[];
  batteryPercent?: number;
  verified: boolean;
}

export interface GatewayNode {
  id: string;
  name: string;
  type: 'internet' | 'mesh_bridge' | 'community' | 'satellite';
  ipAddress?: string;
  latencyMs: number;
  isTrusted: boolean;
  requiresConsent: boolean;
  consentGranted: boolean;
  active: boolean;
  countryCode?: string;
}

export interface ShieldState {
  enabled: boolean;
  verifiedRealTunnel: boolean;
  protocol: 'wireguard' | 'direct' | 'mesh_vpn';
  endpoint?: string;
  handshakeTimestamp?: number;
  dnsProtection: boolean;
  killSwitch: boolean;
  warnings: string[];
  nativeModuleRequired: boolean;
}

export interface ResilienceProfile {
  batterySaver: boolean;
  autoFailover: boolean;
  requireGatewayConsent: boolean;
  cachedMapsAvailable: boolean;
  cachedDocsCount: number;
  activeTransport: TransportType;
  meshScanIntervalSec: number;
  meshScanDutyCycle: string;
  estimatedAutonomyGain: string;
  lastScanTimestamp: number;
}

export interface EmergencyDoc {
  id: string;
  title: string;
  category: 'medical' | 'radio' | 'evacuation' | 'survival';
  summary: string;
  content: string;
  updatedAt: string;
}

export interface P2PFileTransfer {
  id: string;
  filename: string;
  sizeBytes: number;
  totalChunks: number;
  receivedChunks: number;
  senderAlias: string;
  senderId: string;
  completed: boolean;
  dataUrl?: string;
}

export interface CommunityAlert {
  id: string;
  senderId: string;
  senderAlias: string;
  title: string;
  message: string;
  level: 'info' | 'advisory' | 'urgent';
  timestamp: number;
  signature: string;
  verified: boolean;
}

export interface AppIdentity {
  id: string;
  alias: string;
  fingerprint: string;
  publicKey: string;
  createdAt: number;
}

export type OfflinePointCategory = 
  | 'mesh_node'
  | 'water'
  | 'medical'
  | 'power'
  | 'shelter'
  | 'radio';

export type ResilienceMarkerType = 'node' | 'emergency-service' | 'safe-zone';

export interface OfflineMapPoint {
  id: string;
  name: string;
  category: OfflinePointCategory;
  markerType?: ResilienceMarkerType;
  x: number; // 0 to 1000 coordinate scale on local sector grid
  y: number; // 0 to 600 coordinate scale
  latApprox: number;
  lngApprox: number;
  description: string;
  status: 'active' | 'limited' | 'offline';
  verified: boolean;
  frequencyOrBand?: string;
  contactAlias?: string;
  lastUpdated: number;
  distanceMeters: number;
}

export interface RouteWaypoint {
  x: number;
  y: number;
  name?: string;
  isStep?: boolean;
}

export interface RouteInstruction {
  instruction: string;
  distanceMeters: number;
  type: 'depart' | 'straight' | 'turn-left' | 'turn-right' | 'bridge' | 'arrive';
}

export interface WalkingRoute {
  id: string;
  fromName: string;
  toName: string;
  totalDistanceMeters: number;
  estimatedMinutes: number;
  waypoints: RouteWaypoint[];
  instructions: RouteInstruction[];
  svgPathD: string;
}

export type EmergencyBroadcastType = 
  | 'sos'
  | 'medical'
  | 'evacuation'
  | 'water_food'
  | 'shelter'
  | 'hazard';

export type EmergencySeverity = 'critical' | 'urgent' | 'advisory';

export interface EmergencyBroadcast {
  id: string;
  type: EmergencyBroadcastType;
  title: string;
  message: string;
  severity: EmergencySeverity;
  senderId: string;
  senderAlias: string;
  timestamp: number;
  coordinates?: {
    lat: number;
    lng: number;
    gridX?: number;
    gridY?: number;
    label?: string;
  };
  hops: number;
  transportUsed: string;
  signature: string;
  verified: boolean;
  relayCount: number;
  relayedBy?: string[];
  batteryPercent?: number;
}

