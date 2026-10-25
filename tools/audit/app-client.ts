/**
 * MESHORA — Banc de contre-audit : client exécutant le VRAI code applicatif
 * (TransportManager, WebSocketTransport, storage, identity, crypto) dans un processus Node distinct.
 * Piloté par IPC depuis tools/audit/run.ts. Aucune modification du code de prototype/.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// --- Simulation minimale de l'environnement navigateur (avant tout import applicatif) ---
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; }
};
const RELAY = process.env.RELAY!;
const ROOM = process.env.ROOM!;
(globalThis as any).window = {
  location: { search: `?relay=${encodeURIComponent(RELAY + '?room=' + ROOM)}&room=${ROOM}`, hostname: 'audit.invalid' },
  addEventListener() {}
};
try { Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true }); } catch {}

async function main() {
  const { ensureCryptographicIdentity } = await import('../../prototype/src/core/identity');
  const { TransportManager } = await import('../../prototype/src/transports/TransportManager');
  const { MessageStore } = await import('../../prototype/src/core/storage');

  const me = await ensureCryptographicIdentity();
  const tm = TransportManager.getInstance();
  const received: any[] = [];
  tm.onNewMessage((m) => received.push(m));

  process.on('message', async (cmd: any) => {
    try {
      switch (cmd.cmd) {
        case 'identity':
          return process.send!({ rid: cmd.rid, ok: true, data: { id: me.id, alias: me.alias, publicKey: me.publicKey } });
        case 'send': {
          // Reproduit exactement MessagesScreen.handleSend (recipientId 'broadcast', encrypted: true)
          const msg = {
            id: cmd.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            senderId: me.id, senderAlias: me.alias, recipientId: 'broadcast', channelId: 'general',
            content: cmd.text, timestamp: Date.now(), status: 'queued', transport: 'broadcast', hops: 0, encrypted: true
          };
          const ok = await tm.broadcast(msg as any);
          return process.send!({ rid: cmd.rid, ok: true, data: { id: msg.id, dispatched: ok } });
        }
        case 'status': {
          const m = MessageStore.getMessageById(cmd.id);
          return process.send!({ rid: cmd.rid, ok: true, data: m ? m.status : null });
        }
        case 'received':
          return process.send!({ rid: cmd.rid, ok: true, data: received.map((m) => ({ id: m.id, content: m.content, senderAlias: m.senderAlias, encrypted: m.encrypted })) });
        case 'outbox':
          return process.send!({ rid: cmd.rid, ok: true, data: MessageStore.getOutboxMessages().map((m: any) => ({ id: m.id, status: m.status })) });
        case 'peers': {
          const ws: any = tm.getAdapter('websocket' as any);
          return process.send!({ rid: cmd.rid, ok: true, data: ws ? await ws.discoverPeers() : [] });
        }
        case 'flush':
          return process.send!({ rid: cmd.rid, ok: true, data: tm.flushPendingOutbox() });
      }
    } catch (e: any) {
      process.send!({ rid: cmd.rid, ok: false, error: String(e?.message || e) });
    }
  });
  process.send!({ ready: true });
}
main();
