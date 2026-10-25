/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { MeshMessage, MeshPeer, TransportType } from '../types';

export interface ITransportAdapter {
  id: string;
  name: string;
  type: TransportType;
  isAvailable(): boolean;
  isNativeRequired(): boolean;
  send(message: MeshMessage): Promise<boolean>;
  onMessage(callback: (message: MeshMessage) => void): () => void;
  discoverPeers(): Promise<MeshPeer[]>;
}
