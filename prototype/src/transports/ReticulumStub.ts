/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { MeshMessage, MeshPeer } from '../types';
import { ITransportAdapter } from './TransportInterface';

export class ReticulumStub implements ITransportAdapter {
  public id = 'transport_reticulum_stack';
  public name = 'Reticulum Network Stack';
  public type = 'reticulum' as const;

  private messageListeners: Set<(msg: MeshMessage) => void> = new Set();

  public isAvailable(): boolean {
    return false;
  }

  public isNativeRequired(): boolean {
    return true; // Cryptographic autonomous mesh stack requires Python daemon or native library
  }

  public async send(message: MeshMessage): Promise<boolean> {
    console.info('[MESHORA-Reticulum] Identity destination packet encoded:', message.id);
    return true;
  }

  public onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public async discoverPeers(): Promise<MeshPeer[]> {
    return [
      {
        id: 'rns_dest_node_7',
        alias: 'Destination RNS (Auto-routée)',
        transport: 'reticulum',
        hops: 3,
        rssi: -74,
        lastSeen: Date.now() - 300000,
        isGateway: false,
        capabilities: ['reticulum_identity', 'end_to_end_routing'],
        verified: true
      }
    ];
  }
}
