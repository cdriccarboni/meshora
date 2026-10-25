/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Spécification et Stub Meshtastic LoRa (Matériel compagnon requis).
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
    return true; // Exige une radio connectée (USB Série / Bluetooth compagnon)
  }

  public async send(_message: MeshMessage): Promise<boolean> {
    return false;
  }

  public onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public async discoverPeers(): Promise<MeshPeer[]> {
    return [];
  }
}
