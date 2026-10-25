/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 */

import { MeshMessage } from '../types';

const MESSAGES_KEY = 'meshora_messages_store_v01';
const OUTBOX_KEY = 'meshora_outbox_queue_v01';

const INITIAL_MESSAGES: MeshMessage[] = [
  {
    id: 'msh_msg_seed_1',
    senderId: 'msh_system_core',
    senderAlias: 'Système MESHORA',
    recipientId: 'broadcast',
    channelId: 'general',
    content: 'Bienvenue sur le canal local de MESHORA. La liaison directe est prête.',
    timestamp: Date.now() - 3600000,
    status: 'delivered',
    transport: 'broadcast',
    hops: 0,
    encrypted: true
  },
  {
    id: 'msh_msg_seed_2',
    senderId: 'msh_node_relais_nord',
    senderAlias: 'Relais-Nord-84',
    recipientId: 'broadcast',
    channelId: 'general',
    content: 'Passerelle locale active sur le sous-réseau. Connexion fluide.',
    timestamp: Date.now() - 1800000,
    status: 'delivered',
    transport: 'lan',
    hops: 1,
    encrypted: true
  },
  {
    id: 'msh_msg_seed_3',
    senderId: 'msh_system_resilience',
    senderAlias: 'Sentinelle Résilience',
    recipientId: 'broadcast',
    channelId: 'emergency',
    content: 'Canal d’entraide et de continuité configuré. Zéro perte de message garantie via l’Outbox locale.',
    timestamp: Date.now() - 600000,
    status: 'delivered',
    transport: 'broadcast',
    hops: 0,
    encrypted: true
  }
];

export class MessageStore {
  private static listeners: Set<() => void> = new Set();

  public static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private static notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {
        // Ignore
      }
    });
  }

  public static getAllMessages(): MeshMessage[] {
    try {
      const raw = localStorage.getItem(MESSAGES_KEY);
      if (!raw) {
        localStorage.setItem(MESSAGES_KEY, JSON.stringify(INITIAL_MESSAGES));
        return INITIAL_MESSAGES;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_MESSAGES;
    }
  }

  public static getOutboxMessages(): MeshMessage[] {
    try {
      const raw = localStorage.getItem(OUTBOX_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveMessage(msg: MeshMessage): void {
    const list = this.getAllMessages();
    const existingIdx = list.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      list[existingIdx] = msg;
    } else {
      list.push(msg);
    }

    try {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));
    } catch {
      // quota fallback
    }

    // Update outbox if queued
    if (msg.status === 'queued') {
      const outbox = this.getOutboxMessages();
      if (!outbox.some((m) => m.id === msg.id)) {
        outbox.push(msg);
        try {
          localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
        } catch {}
      }
    } else {
      // Remove from outbox if delivered/relayed
      const outbox = this.getOutboxMessages().filter((m) => m.id !== msg.id);
      try {
        localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
      } catch {}
    }

    this.notify();
  }

  public static markStatus(msgId: string, status: MeshMessage['status']): void {
    const list = this.getAllMessages();
    const target = list.find((m) => m.id === msgId);
    if (target) {
      target.status = status;
      this.saveMessage(target);
    }
  }

  public static flushOutbox(sendFn: (msg: MeshMessage) => boolean): number {
    const outbox = this.getOutboxMessages();
    let countFlushed = 0;
    outbox.forEach((msg) => {
      const success = sendFn(msg);
      if (success) {
        this.markStatus(msg.id, 'relayed');
        countFlushed++;
      }
    });
    return countFlushed;
  }

  public static clearAll(): void {
    try {
      localStorage.removeItem(MESSAGES_KEY);
      localStorage.removeItem(OUTBOX_KEY);
    } catch {}
    this.notify();
  }
}
