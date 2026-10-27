/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Spécification et Stub Reticulum Network Stack (Démon natif requis).
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
    return true; // Pile autonome nécessitant un démon système RNS
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
