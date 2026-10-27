/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Gestionnaire des transports avec accusés de réception réels et vérité des états.
 */

import { MeshMessage, MeshPeer, TransportType, MessageAck } from '../types';
import { ITransportAdapter } from './TransportInterface';
import { BroadcastTransport } from './BroadcastTransport';
import { WebSocketTransport } from './WebSocketTransport';
import { BluetoothLEStub } from './BluetoothLEStub';
import { WebBluetoothTransport } from './WebBluetoothTransport';
import { MeshtasticStub } from './MeshtasticStub';
import { ReticulumStub } from './ReticulumStub';
import { MessageStore } from '../core/storage';
import { NetworkSentinel } from '../core/networkSentinel';

export const MESH_SCAN_INTERVALS = {
  NORMAL: 10000,      // 10s: Détection continue
  BATTERY_SAVER: 60000, // 60s: Mode économie d'énergie
  EXTREME_SAVER: 120000 // 120s: Mode coupure prolongée
} as const;

const DEDUP_KEY = 'meshora_processed_ids_v02';
const OUTBOX_RETRY_MS = 15000;
const OUTBOX_MAX_BACKOFF_MS = 10 * 60 * 1000;
const MAX_PER_PASS = 20;

export class TransportManager {
  private static instance: TransportManager | null = null;
  private adapters: Map<TransportType, ITransportAdapter> = new Map();
  private processedMessageIds: Set<string> = new Set();
  private messageCallbacks: Set<(msg: MeshMessage) => void> = new Set();
  private ackCallbacks: Set<(ack: MessageAck) => void> = new Set();

  // Background Mesh Discovery & Battery Saver state
  private batterySaver: boolean = false;
  private scanIntervalMs: number = MESH_SCAN_INTERVALS.NORMAL;
  private scanTimer: any = null;
  private lastScanTimestamp: number = Date.now();
  private isScanningActive: boolean = false;
  private cachedPeers: MeshPeer[] = [];
  private scanUpdateListeners: Set<(intervalMs: number, isBatterySaver: boolean, lastScanTime: number) => void> = new Set();

  private constructor() {
    this.loadDeduplicationCache();

    const broadcastAdapter = new BroadcastTransport();
    const wsAdapter = new WebSocketTransport();
    // Web Bluetooth réel quand le navigateur le permet (Chrome, Edge), sinon l'adaptateur indisponible
    const bleAdapter = WebBluetoothTransport.isSupported() ? new WebBluetoothTransport() : new BluetoothLEStub();
    const meshStub = new MeshtasticStub();
    const retStub = new ReticulumStub();

    this.registerAdapter(broadcastAdapter);
    this.registerAdapter(wsAdapter);
    this.registerAdapter(bleAdapter);
    this.registerAdapter(meshStub);
    this.registerAdapter(retStub);

    // Listen to ACKs across bidirectional transports
    broadcastAdapter.onAck((ack) => this.handleAck(ack));
    wsAdapter.onAck((ack) => this.handleAck(ack));
    if (bleAdapter instanceof WebBluetoothTransport) {
      bleAdapter.onAck((ack) => this.handleAck(ack));
      bleAdapter.onPeersChanged(() => {
        void this.flushPendingOutbox(true);
      });
    }

    // Listen to network sentinel changes to flush outbox
    NetworkSentinel.subscribe((status) => {
      if (status !== 'offline') {
        void this.flushPendingOutbox(true);
      }
    });

    // Contre-audit V0.2 : renvoi aussi quand un pair (re)devient joignable, et périodiquement tant que l'Outbox n'est pas vide.
    wsAdapter.onPeersChanged(() => {
      void this.flushPendingOutbox(true);
    });
    setInterval(() => {
      if (MessageStore.getOutboxMessages().length > 0) void this.flushPendingOutbox();
    }, OUTBOX_RETRY_MS);

    this.startBackgroundScanner();
  }

  private loadDeduplicationCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(DEDUP_KEY);
        if (raw) {
          const list: string[] = JSON.parse(raw);
          if (Array.isArray(list)) {
            this.processedMessageIds = new Set(list.slice(-500));
          }
        }
      }
    } catch {}
  }

  private saveDeduplicationCache(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const list = Array.from(this.processedMessageIds).slice(-500);
        localStorage.setItem(DEDUP_KEY, JSON.stringify(list));
      }
    } catch {}
  }

  public static getInstance(): TransportManager {
    if (!this.instance) {
      this.instance = new TransportManager();
    }
    return this.instance;
  }

  public registerAdapter(adapter: ITransportAdapter): void {
    this.adapters.set(adapter.type, adapter);

    adapter.onMessage((incoming) => {
      this.handleIncomingMessage(incoming);
    });
  }

  public getAdapter(type: TransportType): ITransportAdapter | undefined {
    return this.adapters.get(type);
  }

  public getAllAdapters(): ITransportAdapter[] {
    return Array.from(this.adapters.values());
  }

  public async broadcast(message: MeshMessage): Promise<boolean> {
    const status = NetworkSentinel.getStatus();

    // 1. Completely offline without available local transport
    // Hors ligne : on tente quand même les transports locaux (onglets, Bluetooth) ; sinon le message reste en attente.
    void status;

    // 2. Dispatch through real active transports
    let dispatched = false;
    let viaE2EE = false;
    const realTransports: TransportType[] = ['broadcast', 'websocket', 'bluetooth'];

    for (const t of realTransports) {
      const adapter = this.adapters.get(t);
      if (adapter && adapter.isAvailable()) {
        try {
          const ok = await adapter.send(message);
          if (ok) {
            dispatched = true;
            // Le transport WebSocket n'émet plus que des enveloppes chiffrées (contre-audit V0.2)
            if (t === 'websocket' || t === 'bluetooth') viaE2EE = true;
          }
        } catch {
          // Continue
        }
      }
    }

    // 3. STRICT TRUTH: Dispatched on transport means 'sent', NEVER 'delivered' without ACK!
    const finalMsg: MeshMessage = {
      ...message,
      encrypted: viaE2EE,
      status: dispatched ? 'sent' : 'queued'
    };
    MessageStore.saveMessage(finalMsg);
    this.processedMessageIds.add(message.id);

    return dispatched;
  }

  private flushing = false;
  /** Dernier envoi et nombre de tentatives par message (attente progressive). */
  private retryState: Map<string, { attempts: number; nextAt: number }> = new Map();

  /**
   * Contre-audit V0.2 : renvoi réel de l'Outbox, avec attente progressive par message
   * (15 s, 30 s, 1 min… plafonnée à 10 min) et au plus MAX_PER_PASS envois par passe,
   * pour ne pas saturer le relais (limite de débit, boîte aux lettres) ni le destinataire.
   * Un message n'est marqué « envoyé » que si un transport l'a accepté.
   * @param force renvoie sans attendre (arrivée d'un pair, retour du réseau).
   */
  public async flushPendingOutbox(force = false): Promise<number> {
    if (this.flushing) return 0;
    this.flushing = true;
    let count = 0;
    try {
      const now = Date.now();
      const realTransports: TransportType[] = ['broadcast', 'websocket', 'bluetooth'];
      const due = MessageStore.getOutboxMessages().filter((m) => {
        const st = this.retryState.get(m.id);
        return force || !st || st.nextAt <= now;
      });
      for (const msg of due.slice(0, MAX_PER_PASS)) {
        let ok = false;
        for (const t of realTransports) {
          const adapter = this.adapters.get(t);
          if (adapter && adapter.isAvailable()) {
            try {
              if (await adapter.send(msg)) ok = true;
            } catch {}
          }
        }
        const prev = this.retryState.get(msg.id)?.attempts ?? 0;
        const attempts = ok ? prev + 1 : prev;
        this.retryState.set(msg.id, { attempts, nextAt: now + Math.min(OUTBOX_RETRY_MS * 2 ** attempts, OUTBOX_MAX_BACKOFF_MS) });
        if (ok) {
          count++;
          if (msg.status === 'queued') MessageStore.markStatus(msg.id, 'sent');
        }
      }
      // Nettoyage des messages sortis de l'Outbox
      const live = new Set(MessageStore.getOutboxMessages().map((m) => m.id));
      for (const id of this.retryState.keys()) if (!live.has(id)) this.retryState.delete(id);
    } finally {
      this.flushing = false;
    }
    return count;
  }

  private handleIncomingMessage(msg: MeshMessage): void {
    // 1. Validation stricte du schéma
    if (!msg || typeof msg !== 'object') return;
    if (typeof msg.id !== 'string' || msg.id.length < 3 || msg.id.length > 128) return;
    if (typeof msg.content !== 'string' || msg.content.length > 65536) return;
    if (typeof msg.timestamp !== 'number' || isNaN(msg.timestamp)) return;
    if (typeof msg.senderId !== 'string') return;

    // 2. Déduplication persistante
    if (this.processedMessageIds.has(msg.id)) {
      return;
    }
    this.processedMessageIds.add(msg.id);
    this.saveDeduplicationCache();

    // 3. Sauvegarde locale
    MessageStore.saveMessage(msg);

    // 4. Notification des écouteurs d'interface
    this.messageCallbacks.forEach((cb) => {
      try {
        cb(msg);
      } catch {}
    });
  }

  public handleAck(ack: MessageAck): void {
    // Contre-audit V0.2 : « délivré » exige un ACK signé et vérifié (relais WebSocket),
    // ou un ACK d'un autre onglet du MÊME navigateur (BroadcastChannel, même origine : portée locale uniquement).
    const trusted = ack.verified === true || ack.transport === 'broadcast';
    if (!trusted) return;
    const existing = MessageStore.getMessageById(ack.messageId);
    if (existing && existing.status !== 'delivered') {
      const confirmed: MeshMessage = {
        ...existing,
        status: 'delivered'
      };
      MessageStore.saveMessage(confirmed);
    }

    this.ackCallbacks.forEach((cb) => {
      try {
        cb(ack);
      } catch {}
    });
  }

  public onNewMessage(callback: (msg: MeshMessage) => void): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  public onAck(callback: (ack: MessageAck) => void): () => void {
    this.ackCallbacks.add(callback);
    return () => this.ackCallbacks.delete(callback);
  }

  public async aggregatePeers(): Promise<MeshPeer[]> {
    const results: MeshPeer[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        if (adapter.isAvailable()) {
          const peers = await adapter.discoverPeers();
          results.push(...peers);
        }
      } catch {}
    }
    this.cachedPeers = results;
    this.lastScanTimestamp = Date.now();
    return results;
  }

  public setBatterySaver(enabled: boolean, customIntervalMs?: number): void {
    this.batterySaver = enabled;
    if (customIntervalMs && customIntervalMs >= 5000) {
      this.scanIntervalMs = customIntervalMs;
    } else {
      this.scanIntervalMs = enabled ? MESH_SCAN_INTERVALS.BATTERY_SAVER : MESH_SCAN_INTERVALS.NORMAL;
    }
    this.restartBackgroundScanner();
    this.notifyScanListeners();
  }

  public isBatterySaver(): boolean {
    return this.batterySaver;
  }

  public getScanIntervalMs(): number {
    return this.scanIntervalMs;
  }

  public setScanInterval(intervalMs: number): void {
    if (intervalMs >= 5000) {
      this.scanIntervalMs = intervalMs;
      this.restartBackgroundScanner();
      this.notifyScanListeners();
    }
  }

  public getLastScanTimestamp(): number {
    return this.lastScanTimestamp;
  }

  public isScanning(): boolean {
    return this.isScanningActive;
  }

  public getCachedPeers(): MeshPeer[] {
    return [...this.cachedPeers];
  }

  public async triggerImmediateScan(): Promise<MeshPeer[]> {
    this.isScanningActive = true;
    try {
      const peers = await this.aggregatePeers();
      return peers;
    } finally {
      this.isScanningActive = false;
      this.notifyScanListeners();
    }
  }

  public onScanUpdate(callback: (intervalMs: number, isBatterySaver: boolean, lastScanTime: number) => void): () => void {
    this.scanUpdateListeners.add(callback);
    return () => this.scanUpdateListeners.delete(callback);
  }

  private notifyScanListeners(): void {
    this.scanUpdateListeners.forEach((cb) => {
      try {
        cb(this.scanIntervalMs, this.batterySaver, this.lastScanTimestamp);
      } catch {}
    });
  }

  private startBackgroundScanner(): void {
    this.stopBackgroundScanner();
    this.scanTimer = setInterval(() => {
      this.runPeriodicScan();
    }, this.scanIntervalMs);
  }

  private restartBackgroundScanner(): void {
    this.startBackgroundScanner();
  }

  public stopBackgroundScanner(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  private async runPeriodicScan(): Promise<void> {
    if (this.isScanningActive) return;
    this.isScanningActive = true;
    try {
      await this.aggregatePeers();
    } catch {
      // Background scan resilient catch
    } finally {
      this.isScanningActive = false;
      this.notifyScanListeners();
    }
  }
}
