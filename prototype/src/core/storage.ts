/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Un réseau qui relie les autres.
 * Stockage persistant avec gestion d'Outbox et suivi d'accusés de réception.
 */

import { MeshMessage } from '../types';

const MESSAGES_KEY = 'meshora_messages_store_v02';
const OUTBOX_KEY = 'meshora_outbox_queue_v02';

const INITIAL_MESSAGES: MeshMessage[] = [];

// Fallback mémoire pour environnements headless / CLI / tests
const memoryFallback = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryFallback.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {}
  memoryFallback.set(key, value);
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {}
  memoryFallback.delete(key);
}

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
      const raw = safeGetItem(MESSAGES_KEY);
      if (!raw) {
        safeSetItem(MESSAGES_KEY, JSON.stringify(INITIAL_MESSAGES));
        return INITIAL_MESSAGES;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_MESSAGES;
    }
  }

  public static getMessageById(id: string): MeshMessage | undefined {
    return this.getAllMessages().find((m) => m.id === id);
  }

  public static getOutboxMessages(): MeshMessage[] {
    try {
      const raw = safeGetItem(OUTBOX_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static getOutbox(): MeshMessage[] {
    return this.getOutboxMessages();
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
      safeSetItem(MESSAGES_KEY, JSON.stringify(list));
    } catch {
      // quota fallback
    }

    // Outbox retention: message remains in outbox until delivered with verified ACK
    if (msg.status === 'queued' || msg.status === 'sent') {
      const outbox = this.getOutboxMessages();
      const outboxIdx = outbox.findIndex((m) => m.id === msg.id);
      if (outboxIdx >= 0) {
        outbox[outboxIdx] = msg;
      } else {
        outbox.push(msg);
      }
      try {
        safeSetItem(OUTBOX_KEY, JSON.stringify(outbox));
      } catch {}
    } else if (msg.status === 'delivered') {
      // Remove from outbox ONLY when reception is confirmed
      const outbox = this.getOutboxMessages().filter((m) => m.id !== msg.id);
      try {
        safeSetItem(OUTBOX_KEY, JSON.stringify(outbox));
      } catch {}
    }

    this.notify();
  }

  public static markStatus(msgId: string, status: MeshMessage['status']): void {
    const target = this.getMessageById(msgId);
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
        this.markStatus(msg.id, 'sent');
        countFlushed++;
      }
    });
    return countFlushed;
  }

  public static clearAll(): void {
    safeRemoveItem(MESSAGES_KEY);
    safeRemoveItem(OUTBOX_KEY);
    this.notify();
  }
}
