/**
 * MESHORA — Banc minimal du relais Cloudflare SANS wrangler : exécute le VRAI code du Durable Object
 * (relay/cloudflare/src/index.js) dans Node avec des connexions simulées (API d'hibernation : pièces jointes
 * sérialisées et limitées à 16 Kio comme chez Cloudflare). Ne remplace pas `wrangler dev` + relay-conformance.ts.
 * Vérifie ici le chemin V0.4 étape A : prékey dans HELLO → MESHORA_PEERS, rotation, prékey usurpée ignorée,
 * enveloppe v3 transmise par une passerelle, délégation avec prékey.
 * Usage (depuis prototype/) : npx tsx ../tools/audit/cf-relay-harness.mjs
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pjoin } from 'node:path';
// Copie du vrai code, seule l'importation propre à Cloudflare est remplacée par une classe de base vide.
const src = readFileSync(new URL('../../relay/cloudflare/src/index.js', import.meta.url), 'utf8')
  .replace(/import \{ DurableObject \} from 'cloudflare:workers';/, 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }');
const copy = pjoin(mkdtempSync(pjoin(tmpdir(), 'meshora-cf-')), 'relay.mjs');
writeFileSync(copy, src);
const { MeshoraRoom } = await import(copy);
const { MeshoraCrypto } = await import('../../prototype/src/core/crypto.ts');

let fails = 0;
const ok = (c, l) => { console.log(`${c ? '✅' : '❌'} ${l}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sockets = [];
const ctx = {
  storage: { sql: { exec: () => ({ toArray: () => [] }) }, setAlarm: async () => {}, getAlarm: async () => null },
  getWebSockets: () => sockets.filter((w) => w.readyState === 1),
  acceptWebSocket: () => {}
};
const room = new MeshoraRoom(ctx, {});
const ROOM = 'harnessroom01';
let maxAttachment = 0;
function connect() {
  const w = {
    readyState: 1, inbox: [], att: null,
    serializeAttachment(a) { const s = JSON.stringify(a); maxAttachment = Math.max(maxAttachment, s.length); if (s.length > 16384) throw new Error('attachment > 16 KiB'); this.att = s; },
    deserializeAttachment() { return this.att ? JSON.parse(this.att) : null; },
    send(m) { this.inbox.push(JSON.parse(m)); },
    close() { this.readyState = 3; }
  };
  sockets.push(w);
  w.serializeAttachment({ room: ROOM, nonce: 'ab'.repeat(16), auth: false, pub: null, id: null, alias: null, opened: Date.now(), win: Date.now(), cnt: 0 });
  return w;
}
const idOf = async (pub) => 'msh_' + (await MeshoraCrypto.computeFingerprint(pub)).replace(/:/g, '').substring(0, 12);
async function join(alias, prekeyFor) {
  const k = await MeshoraCrypto.generateIdentityKeyPair();
  const w = connect();
  const prekey = prekeyFor ? await prekeyFor(k) : undefined;
  const helloSignature = await MeshoraCrypto.signData(k.privateKey, `MESHORA-HELLO|v1|${ROOM}|${'ab'.repeat(16)}|${k.publicKeyHex}`);
  await room.webSocketMessage(w, JSON.stringify({ type: 'MESHORA_HELLO', senderId: await idOf(k.publicKeyHex), senderAlias: alias, publicKey: k.publicKeyHex, helloSignature, room: ROOM, prekey }));
  return { k, w };
}
const lastPeers = (w) => w.inbox.filter((p) => p.type === 'MESHORA_PEERS').at(-1)?.peers || [];
const now = Date.now();

let bobPk;
const B = await join('Bob', async (k) => (bobPk = await MeshoraCrypto.generatePrekey(k.privateKey, k.publicKeyHex, now + 8 * 864e5)).prekey);
ok(B.w.deserializeAttachment().auth === true, 'HELLO accepté par le vrai code du Durable Object');
const stolen = (await MeshoraCrypto.generatePrekey(B.k.privateKey, B.k.publicKeyHex, now + 8 * 864e5)).prekey;
const M = await join('M', async () => stolen);
const O = await join('Observateur');
const pB = lastPeers(O.w).find((p) => p.publicKey === B.k.publicKeyHex);
ok(pB?.prekey?.id === bobPk.prekey.id && (await MeshoraCrypto.verifyPrekey(B.k.publicKeyHex, pB.prekey)), 'prékey de Bob redistribuée dans MESHORA_PEERS');
ok(!lastPeers(O.w).find((p) => p.publicKey === M.k.publicKeyHex)?.prekey, 'prékey signée par une autre identité ignorée');
ok(!lastPeers(O.w).find((p) => p.publicKey === O.k.publicKeyHex)?.prekey, 'client sans prékey : annoncé sans prékey (repli v2)');

const p2 = await MeshoraCrypto.generatePrekey(B.k.privateKey, B.k.publicKeyHex, now + 9 * 864e5);
await room.webSocketMessage(B.w, JSON.stringify({ type: 'MESHORA_PREKEY', prekey: p2.prekey }));
ok(lastPeers(O.w).find((p) => p.publicKey === B.k.publicKeyHex)?.prekey?.id === p2.prekey.id, 'rotation (MESHORA_PREKEY) rediffusée');
await room.webSocketMessage(B.w, JSON.stringify({ type: 'MESHORA_PREKEY', prekey: bobPk.prekey }));
ok(lastPeers(O.w).find((p) => p.publicKey === B.k.publicKeyHex)?.prekey?.id === p2.prekey.id, 'pas de retour à une prékey plus ancienne');
const expired = await MeshoraCrypto.generatePrekey(B.k.privateKey, B.k.publicKeyHex, now - 1000);
await room.webSocketMessage(B.w, JSON.stringify({ type: 'MESHORA_PREKEY', prekey: expired.prekey }));
ok(lastPeers(O.w).find((p) => p.publicKey === B.k.publicKeyHex)?.prekey?.id === p2.prekey.id, 'prékey échue refusée');

const A = await MeshoraCrypto.generateIdentityKeyPair();
const e = await MeshoraCrypto.encryptEnvelopeV3({ messageId: 'cfv3', senderPrivateKey: A.privateKey, senderPublicKeyHex: A.publicKeyHex, recipientPublicKeyHex: B.k.publicKeyHex, prekey: p2.prekey, plaintext: 'via CF' });
await room.webSocketMessage(O.w, JSON.stringify({ type: 'MESHORA_FORWARD', envelope: { ...e, id: 'cfbad', saltHex: '11'.repeat(32) } }));
await room.webSocketMessage(O.w, JSON.stringify({ type: 'MESHORA_FORWARD', envelope: e }));
const got = B.w.inbox.find((p) => p.envelope?.id === 'cfv3')?.envelope;
let readable = false;
try { readable = (await MeshoraCrypto.decryptEnvelope({ envelope: got, recipientPrivateKeyPkcs8Hex: B.k.privateKeyPkcs8Hex, prekeyLookup: (id) => (id === p2.prekey.id ? p2.privateKeyPkcs8Hex : null) })).plaintext === 'via CF'; } catch {}
ok(readable, 'enveloppe v3 transmise par passerelle (signature ENV3 vérifiée par le relais) et lisible par Bob');
ok(!B.w.inbox.some((p) => p.envelope?.id === 'cfbad'), 'enveloppe v3 altérée refusée');

// Délégation avec prékey, et 16 clés servies : la pièce jointe reste sous 16 Kio
const G = await join('Passerelle');
for (let i = 0; i < 16; i++) {
  const D = await MeshoraCrypto.generateIdentityKeyPair();
  const dp = await MeshoraCrypto.generatePrekey(D.privateKey, D.publicKeyHex, now + 8 * 864e5);
  const ts = Date.now();
  const signature = await MeshoraCrypto.signData(D.privateKey, `MESHORA-DELEGATE|v1|${ROOM}|${D.publicKeyHex}|${G.k.publicKeyHex}|${ts}`);
  await room.webSocketMessage(G.w, JSON.stringify({ type: 'MESHORA_SERVE', delegation: { publicKey: D.publicKeyHex, gateway: G.k.publicKeyHex, alias: 'x'.repeat(64), timestamp: ts, signature }, prekey: dp.prekey }));
  if (i === 0) {
    const served = lastPeers(O.w).find((p) => p.publicKey === D.publicKeyHex);
    ok(served?.viaGateway && served?.prekey?.id === dp.prekey.id, 'membre servi par la passerelle annoncé avec sa prékey');
  }
}
await sleep(10);
ok(Object.keys(G.w.deserializeAttachment().served).length === 16 && maxAttachment <= 16384, `16 clés servies avec prékeys : pièce jointe max ${maxAttachment} octets (≤ 16 384)`);

console.log(`\nRÉSULTAT : ${fails === 0 ? 'toutes les vérifications réussies' : fails + ' échec(s)'} (code Cloudflare exécuté hors wrangler)`);
process.exit(fails ? 1 : 0);
