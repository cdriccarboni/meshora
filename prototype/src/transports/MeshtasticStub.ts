/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { MeshMessage, MeshPeer } from '../types';
import { ITransportAdapter } from './TransportInterface';

export class MeshtasticStub implements ITransportAdapter {
  public id = 'transport_meshtastic_lora';
  public name = 'Meshtastic (LoRa 868MHz / 915MHz)';
  public type = 'meshtastic' as const;

  private messageListeners: Set<(msg: MeshMessage) => void> = new Set();

  public isAvailable(): boolean {
    return false;
  }

  public isNativeRequired(): boolean {
    return true; // Requires native serial / Bluetooth gateway bridge
  }

  public async send(message: MeshMessage): Promise<boolean> {
    console.info('[MESHORA-Meshtastic] Packet routed to LoRa queue:', message.id);
    return true;
  }

  public onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public async discoverPeers(): Promise<MeshPeer[]> {
    return [
      {
        id: 'node_lora_colline',
        alias: 'Relais Sommet LoRa (Meshtastic)',
        transport: 'meshtastic',
        hops: 2,
        rssi: -82,
        lastSeen: Date.now() - 120000,
        isGateway: true,
        capabilities: ['lora_long_range', 'repeater'],
        batteryPercent: 94,
        verified: true
      }
    ];
  }
}
