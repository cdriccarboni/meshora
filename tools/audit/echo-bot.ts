/**
 * MESHORA — Robot d'écho exécutant le VRAI code web (TransportManager, WebSocketTransport, crypto)
 * pour les essais d'interopérabilité Android ↔ web. Répond « echo:<texte> » à tout message « ping-… ».
 * Usage : RELAY=ws://127.0.0.1:8787 ROOM=interop npx tsx ../tools/audit/echo-bot.ts   (depuis prototype/)
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
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
  confirm: () => true,
  location: { search: `?relay=${encodeURIComponent(RELAY + '?room=' + ROOM)}&room=${ROOM}`, hostname: 'audit.invalid' },
  addEventListener() {}
};
try { Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true }); } catch {}

(async () => {
const { ensureCryptographicIdentity } = await import('../../prototype/src/core/identity');
const { TransportManager } = await import('../../prototype/src/transports/TransportManager');
const me = await ensureCryptographicIdentity();
const tm = TransportManager.getInstance();
console.log(JSON.stringify({ ready: true, id: me.id, publicKey: me.publicKey }));
tm.onNewMessage(async (m) => {
  if (m.senderId === me.id || typeof m.content !== 'string' || !m.content.startsWith('ping-')) return;
  console.log(JSON.stringify({ received: m.content, from: m.senderId, encrypted: m.encrypted }));
  await tm.broadcast({
    id: 'echo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    senderId: me.id, senderAlias: 'EchoWeb', recipientId: 'broadcast', channelId: 'general',
    content: 'echo:' + m.content, timestamp: Date.now(), status: 'queued', transport: 'broadcast', hops: 0, encrypted: false
  } as any);
});
tm.onAck((a) => console.log(JSON.stringify({ ack: a.messageId, verified: a.verified })));
setInterval(() => {}, 1 << 30);
})();
