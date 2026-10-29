/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Transport local inter-onglets réel (BroadcastChannel) avec découverte et accusés de réception.
 */

import { MeshMessage, MeshPeer, MessageAck } from '../types';
import { ITransportAdapter } from './TransportInterface';
import { getOrCreateIdentity } from '../core/identity';

interface BroadcastFrame {
  type: 'PEER_PROBE' | 'PEER_ANNOUNCE' | 'MESH_MSG' | 'MESH_ACK';
  sessionId: string;
  peer?: MeshPeer;
  message?: MeshMessage;
  ack?: MessageAck;
}

export class BroadcastTransport implements ITransportAdapter {
  public id = 'transport_broadcast_channel';
  public name = 'BroadcastChannel (Local Inter-Onglets)';
  public type = 'broadcast' as const;

  private channel: BroadcastChannel | null = null;
  private messageListeners: Set<(msg: MeshMessage) => void> = new Set();
  private ackListeners: Set<(ack: MessageAck) => void> = new Set();
  private activePeers: Map<string, { peer: MeshPeer; lastSeen: number }> = new Map();
  private sessionId: string;

  constructor() {
    this.sessionId = 'tab_' + Math.random().toString(36).substring(2, 9);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('meshora_local_mesh_channel_v01');
        this.channel.onmessage = (event: MessageEvent<BroadcastFrame>) => {
          this.handleFrame(event.data);
        };
        // Announce presence to other tabs
        this.announcePresence();
      } catch {
        this.channel = null;
      }
    }
  }

  private getMyPeerInfo(): MeshPeer {
    const identity = getOrCreateIdentity();
    return {
      id: `${identity.id}_${this.sessionId}`,
      alias: `${identity.alias} (Onglet local)`,
      transport: 'broadcast',
      hops: 1,
      rssi: -30,
      lastSeen: Date.now(),
      isGateway: false,
      capabilities: ['messages', 'broadcast'],
      // Autre onglet du même navigateur : aucune vérification d'identité n'est effectuée
      verified: false
    };
  }

  private handleFrame(frame: BroadcastFrame): void {
    if (!frame || frame.sessionId === this.sessionId) {
      return; // Ignore own frames
    }

    switch (frame.type) {
      case 'PEER_PROBE':
        // Record probe sender
        if (frame.peer) {
          this.activePeers.set(frame.sessionId, { peer: frame.peer, lastSeen: Date.now() });
        }
        // Respond with our announce
        this.sendFrame({
          type: 'PEER_ANNOUNCE',
          sessionId: this.sessionId,
          peer: this.getMyPeerInfo()
        });
        break;

      case 'PEER_ANNOUNCE':
        if (frame.peer) {
          this.activePeers.set(frame.sessionId, { peer: frame.peer, lastSeen: Date.now() });
        }
        break;

      case 'MESH_MSG':
        if (frame.message) {
          const msg = frame.message;
          // Notify local application of new incoming message
          this.messageListeners.forEach((listener) => {
            try {
              listener(msg);
            } catch {}
          });

          // Send verifiable ACK back across the channel
          const myIdentity = getOrCreateIdentity();
          this.sendFrame({
            type: 'MESH_ACK',
            sessionId: this.sessionId,
            ack: {
              messageId: msg.id,
              recipientId: myIdentity.id,
              recipientAlias: myIdentity.alias,
              timestamp: Date.now(),
              transport: 'broadcast'
            }
          });
        }
        break;

      case 'MESH_ACK':
        if (frame.ack) {
          this.ackListeners.forEach((listener) => {
            try {
              listener(frame.ack!);
            } catch {}
          });
        }
        break;
    }
  }

  private sendFrame(frame: BroadcastFrame): boolean {
    if (!this.channel) return false;
    try {
      this.channel.postMessage(frame);
      return true;
    } catch {
      return false;
    }
  }

  public isAvailable(): boolean {
    return this.channel !== null;
  }

  public isNativeRequired(): boolean {
    return false; // Native to standard browsers
  }

  public async send(message: MeshMessage): Promise<boolean> {
    if (!this.channel) return false;
    return this.sendFrame({
      type: 'MESH_MSG',
      sessionId: this.sessionId,
      message: {
        ...message,
        transport: 'broadcast',
        hops: (message.hops || 0) + 1
      }
    });
  }

  public onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onAck(callback: (ack: MessageAck) => void): () => void {
    this.ackListeners.add(callback);
    return () => this.ackListeners.delete(callback);
  }

  public announcePresence(): void {
    this.sendFrame({
      type: 'PEER_PROBE',
      sessionId: this.sessionId,
      peer: this.getMyPeerInfo()
    });
  }

  public async discoverPeers(): Promise<MeshPeer[]> {
    if (!this.channel) return [];

    // Probe current channel for live tabs
    this.announcePresence();

    // Clean up dead peers (no announce in last 25 seconds)
    const now = Date.now();
    for (const [sId, entry] of this.activePeers.entries()) {
      if (now - entry.lastSeen > 25000) {
        this.activePeers.delete(sId);
      }
    }

    // Return strictly discovered and active peers
    return Array.from(this.activePeers.values()).map((e) => ({
      ...e.peer,
      lastSeen: e.lastSeen
    }));
  }
}
