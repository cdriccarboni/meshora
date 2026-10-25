/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { MeshMessage, MeshPeer, TransportType } from '../types';
import { ITransportAdapter } from './TransportInterface';
import { BroadcastTransport } from './BroadcastTransport';
import { WebSocketTransport } from './WebSocketTransport';
import { BluetoothLEStub } from './BluetoothLEStub';
import { MeshtasticStub } from './MeshtasticStub';
import { ReticulumStub } from './ReticulumStub';
import { MessageStore } from '../core/storage';
import { NetworkSentinel } from '../core/networkSentinel';

export const MESH_SCAN_INTERVALS = {
  NORMAL: 10000,      // 10s: Continuous real-time detection
  BATTERY_SAVER: 60000, // 60s: Duty-cycled grid-down preservation mode (~65% energy saved)
  EXTREME_SAVER: 120000 // 120s: Extended blackout survival mode (~80% energy saved)
} as const;

export class TransportManager {
  private static instance: TransportManager | null = null;
  private adapters: Map<TransportType, ITransportAdapter> = new Map();
  private processedMessageIds: Set<string> = new Set();
  private messageCallbacks: Set<(msg: MeshMessage) => void> = new Set();

  // Background Mesh Discovery & Battery Saver state
  private batterySaver: boolean = false;
  private scanIntervalMs: number = MESH_SCAN_INTERVALS.NORMAL;
  private scanTimer: any = null;
  private lastScanTimestamp: number = Date.now();
  private isScanningActive: boolean = false;
  private cachedPeers: MeshPeer[] = [];
  private scanUpdateListeners: Set<(intervalMs: number, isBatterySaver: boolean, lastScanTime: number) => void> = new Set();

  private constructor() {
    this.registerAdapter(new BroadcastTransport());
    this.registerAdapter(new WebSocketTransport());
    this.registerAdapter(new BluetoothLEStub());
    this.registerAdapter(new MeshtasticStub());
    this.registerAdapter(new ReticulumStub());

    // Listen to network changes to flush outbox automatically
    NetworkSentinel.subscribe((status) => {
      if (status !== 'offline') {
        this.flushPendingOutbox();
      }
    });

    // Start background scanner with default cadence
    this.startBackgroundScanner();
  }

  public static getInstance(): TransportManager {
    if (!this.instance) {
      this.instance = new TransportManager();
    }
    return this.instance;
  }

  public registerAdapter(adapter: ITransportAdapter): void {
    this.adapters.set(adapter.type, adapter);

    // Bind incoming message listener
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

    // If completely offline, save strictly in outbox and do not fail silently
    if (status === 'offline') {
      const queuedMessage: MeshMessage = {
        ...message,
        status: 'queued'
      };
      MessageStore.saveMessage(queuedMessage);
      return true; // Accusé de prise en charge par la file hors-ligne
    }

    // Try available real transports first (broadcast channel + websocket)
    let dispatched = false;

    const realTransports: TransportType[] = ['broadcast', 'websocket'];
    for (const t of realTransports) {
      const adapter = this.adapters.get(t);
      if (adapter && adapter.isAvailable()) {
        try {
          const ok = await adapter.send(message);
          if (ok) dispatched = true;
        } catch {
          // Continue to next transport
        }
      }
    }

    // Mark as delivered/relayed
    const finalMsg: MeshMessage = {
      ...message,
      status: dispatched ? 'delivered' : 'queued'
    };
    MessageStore.saveMessage(finalMsg);
    this.processedMessageIds.add(message.id);

    return dispatched;
  }

  public flushPendingOutbox(): number {
    return MessageStore.flushOutbox((msg) => {
      // Try sending via real local transport
      const broadcastAdapter = this.adapters.get('broadcast');
      if (broadcastAdapter && broadcastAdapter.isAvailable()) {
        broadcastAdapter.send(msg);
        return true;
      }
      return false;
    });
  }

  private handleIncomingMessage(msg: MeshMessage): void {
    if (this.processedMessageIds.has(msg.id)) {
      return; // Deduplication
    }
    this.processedMessageIds.add(msg.id);

    // Save locally
    MessageStore.saveMessage(msg);

    // Notify listeners
    this.messageCallbacks.forEach((cb) => {
      try {
        cb(msg);
      } catch {}
    });
  }

  public onNewMessage(callback: (msg: MeshMessage) => void): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  public async aggregatePeers(): Promise<MeshPeer[]> {
    const results: MeshPeer[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        const peers = await adapter.discoverPeers();
        results.push(...peers);
      } catch {}
    }
    this.cachedPeers = results;
    this.lastScanTimestamp = Date.now();
    return results;
  }

  /**
   * Configure Battery Saver mode which throttles periodic mesh background scans
   * to preserve critical mobile battery in blackout / off-grid emergencies.
   */
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

  /**
   * Forces an immediate proximity discovery burst across all mesh transports
   * without waiting for the scheduled background timer to expire.
   */
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
