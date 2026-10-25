/**
 * MESHORA — Contrats d'interface partagés, v0.1.0 (25 octobre 2026)
 *
 * Source de vérité des types échangés entre :
 *   - l'interface et le prototype (Google AI Studio),
 *   - le cœur natif à venir (Rust, exposé à Swift/Kotlin via UniFFI),
 *   - les agents d'intégration et de test.
 *
 * Règles :
 *   1. Toute modification passe par une PR sur une branche docs/* ou contracts/*,
 *      avec incrément de CONTRACT_VERSION (semver : majeur = rupture).
 *   2. Le prototype n'implémente que des adaptateurs simulés nommés Sim*.
 *   3. Tout état affiché provient d'une valeur portant une preuve (Evidence).
 *      Pas de preuve => l'interface affiche « inconnu », jamais « connecté ».
 *   4. Aucune chaîne d'interface ici : les libellés FR/EN sont dans docs/DESIGN.md §8.
 *
 * Correspondance : docs/RESILIENCE.md §5, docs/ARCHITECTURE.md §3, docs/DESIGN.md §8.
 */

export const CONTRACT_VERSION = "0.1.0";

/* ───────────────────────── Commun ───────────────────────── */

export type Pillar = "mesh" | "connect" | "shield" | "resilience";

/** Preuve d'un état observé. Absente => l'état est inconnu. */
export interface Evidence {
  observedAt: number; // ms depuis l'époque Unix
  source: string;     // ex. "ble-scan", "nostr-relay:wss://…", "wg-handshake"
}

export type Platform = "android" | "ios" | "ipados" | "macos" | "windows" | "linux" | "raspberry-pi" | "esp32" | "web-prototype";

/** Fonctionnalité impossible ou limitée sur la plateforme courante (affichée telle quelle, sans jargon). */
export interface PlatformLimit {
  feature: string;            // clé stable, ex. "ble.background_relay"
  level: "unavailable" | "limited";
  docRef: string;             // ex. "COMPATIBILITY.md#1"
}

/* ───────────────────────── Identité (Mesh) ───────────────────────── */

export interface IdentitySummary {
  fingerprint: string;        // empreinte courte de la clé racine (affichable)
  displayName: string;        // surnom local, jamais une preuve
  deviceCount: number;
}

export interface Contact {
  fingerprint: string;
  displayName: string;
  verified: boolean;          // vérifié par QR / nombres de sécurité
}

/* ───────────────────────── Transports (Mesh + Connect) ───────────────────────── */

export type TransportKind =
  | "ble" | "lan" | "lora_companion" | "nostr"
  | "wifi_aware" | "multipeer" | "reticulum" | "sim";

export interface TransportStatus {
  kind: TransportKind;
  pillar: Extract<Pillar, "mesh" | "connect">;
  available: boolean;
  evidence?: Evidence;
  peers: number;              // voisins réellement vus (jamais une estimation)
  mtuBytes: number;           // ex. ~200 pour LoRa
  allowedByUser: boolean;
  platformLimit?: PlatformLimit;
}

/* ───────────────────────── Passerelles (Connect) ───────────────────────── */

export type Trust = "self" | "group" | "verified_contact" | "unknown";

export type GatewayCapability = "internet" | "nostr" | "vpn" | "lora" | "social_publish";

export interface GatewayAnnouncement {
  id: string;                 // empreinte de la clé de la passerelle
  name: string;
  trust: Trust;
  capabilities: GatewayCapability[];
  lastInternetProof?: Evidence; // une passerelle sans preuve récente n'offre pas Internet
  signatureValid: boolean;
}

export type GatewayConsent = "accept_once" | "refuse";

/* ───────────────────────── Messages (Mesh + Resilience) ───────────────────────── */

export type MessageState =
  | "draft" | "queued" | "handed_to_peer" | "published_nostr"
  | "delivered" | "read" | "expired" | "rejected" | "storage_full";

/** États terminaux qui DOIVENT produire une notification visible (aucune perte silencieuse). */
export const NOTIFY_STATES: readonly MessageState[] = ["expired", "rejected", "storage_full"];

export interface OutgoingMessage {
  id: string;
  to: string;                 // empreinte du contact ou identifiant de groupe
  createdAt: number;
  expiresAt: number;
  state: MessageState;
  stateEvidence?: Evidence;
  sizeBytes: number;
}

/* ───────────────────────── Protection (Shield) ───────────────────────── */

export interface ProtectionStatus {
  e2e: "verified" | "unverified" | "public";
  vpn: "off" | "on_verified" | "on_unverified" | "error";
  vpnEvidence?: Evidence;     // poignée de main WireGuard récente
  tor: "off" | "connecting" | "on" | "error";
  internet: "verified" | "unverified" | "offline";
  internetEvidence?: Evidence;
}

/* ───────────────────────── Continuité (Resilience) ───────────────────────── */

export type BatteryProfile = "normal" | "eco" | "relay_standby";

export interface CommunityNotice {
  id: string;
  issuerFingerprint: string;
  issuerFollowed: boolean;    // l'utilisateur suit cette clé d'émetteur
  signatureValid: boolean;    // « vérifiable » ≠ « vrai »
  area?: string;
  validUntil: number;
  body: string;
}

/* ───────────────────────── Adaptateur unique pour l'interface ───────────────────────── */

export interface MeshoraAdapter {
  readonly platform: Platform;
  readonly simulated: boolean; // true => bannière « Prototype — réseau simulé »

  identity(): IdentitySummary;
  contacts(): Contact[];

  transports(): TransportStatus[];
  gateways(): GatewayAnnouncement[];
  requestGatewayConsent(g: GatewayAnnouncement): Promise<GatewayConsent>;

  send(to: string, body: Uint8Array): Promise<string>;                       // renvoie l'id du message
  onMessageState(cb: (id: string, state: MessageState, ev?: Evidence) => void): () => void;

  protection(): ProtectionStatus;
  notices(): CommunityNotice[];
  setBatteryProfile(p: BatteryProfile): void;

  platformLimits(): PlatformLimit[];
}

/*
 * ───────────────────────── Équivalent Rust (indicatif) ─────────────────────────
 *
 * pub trait Transport: Send + Sync {
 *     fn kind(&self) -> TransportKind;
 *     fn mtu(&self) -> usize;
 *     fn start(&self, events: Sender<TransportEvent>) -> Result<()>;
 *     fn send(&self, peer: PeerId, bytes: &[u8]) -> Result<()>;
 * }
 * pub enum TransportEvent { PeerUp(PeerId, Evidence), PeerDown(PeerId), Bytes(PeerId, Vec<u8>) }
 *
 * Les adaptateurs natifs (BLE Swift/Kotlin) implémentent Transport ;
 * MeshoraAdapter côté TypeScript est alimenté par le cœur via un pont (UniFFI / WebView / Tauri).
 */
