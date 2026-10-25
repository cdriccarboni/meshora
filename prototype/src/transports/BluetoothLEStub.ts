/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Spécification et Stub Bluetooth Low Energy (Module natif requis).
 */

import { MeshMessage, MeshPeer } from '../types';
import { ITransportAdapter } from './TransportInterface';

export class BluetoothLEStub implements ITransportAdapter {
  public id = 'transport_bluetooth_le';
  public name = 'Bluetooth Low Energy (GATT / Mesh)';
  public type = 'bluetooth' as const;

  private messageListeners: Set<(msg: MeshMessage) => void> = new Set();

  public isAvailable(): boolean {
    // Non disponible en PWA/navigateur standard : nécessite une application native (iOS/Android)
    return false;
  }

  public isNativeRequired(): boolean {
    return true;
  }

  public async send(_message: MeshMessage): Promise<boolean> {
    // Échec explicite : aucun transport natif n'est connecté dans le navigateur
    return false;
  }

  public onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public async discoverPeers(): Promise<MeshPeer[]> {
    // STRICT TRUTH : Aucun pair simulé inventé
    return [];
  }
}
