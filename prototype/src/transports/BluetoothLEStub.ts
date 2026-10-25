/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { MeshMessage, MeshPeer } from '../types';
import { ITransportAdapter } from './TransportInterface';

export class BluetoothLEStub implements ITransportAdapter {
  public id = 'transport_bluetooth_le';
  public name = 'Bluetooth Low Energy (GATT / Mesh)';
  public type = 'bluetooth' as const;

  private messageListeners: Set<(msg: MeshMessage) => void> = new Set();

  public isAvailable(): boolean {
    return false; // Native module required for continuous background mesh
  }

  public isNativeRequired(): boolean {
    return true; // Explicitly marked as requiring native module
  }

  public async send(message: MeshMessage): Promise<boolean> {
    // In web environment, log intent and simulate packet dispatch
    console.info('[MESHORA-BLE] Simulation dispatch via stub:', message.id);
    return true;
  }

  public onMessage(callback: (message: MeshMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public async discoverPeers(): Promise<MeshPeer[]> {
    return [
      {
        id: 'peer_ble_phone_1',
        alias: 'Smartphone Voisin (BLE)',
        transport: 'bluetooth',
        hops: 1,
        rssi: -68,
        lastSeen: Date.now() - 45000,
        isGateway: false,
        capabilities: ['p2p_direct'],
        batteryPercent: 88,
        verified: false
      }
    ];
  }
}
