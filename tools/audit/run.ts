/**
 * MESHORA — Banc de contre-audit V0.2 (indépendant des tests fournis dans la PR #3).
 * Lance le VRAI relais (tools/relay/server.js), des clients applicatifs réels (processus distincts)
 * et un attaquant « brut ». Chaque scénario : PASS = comportement sûr ; FAIL = faille démontrée.
 * Usage (depuis prototype/ pour résoudre tsx) : npx tsx ../tools/audit/run.ts
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import net from 'node:net';
import path from 'node:path';
import { fork, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { MeshoraCrypto } from '../../prototype/src/core/crypto';

const require_ = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const results: { id: string; title: string; pass: boolean; evidence: string }[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Écoute de tout ce que le relais émet (sockets côté serveur uniquement) ----------
const relayOut: string[] = [];
const origWrite = net.Socket.prototype.write;
(net.Socket.prototype as any).write = function (chunk: any, ...rest: any[]) {
  if ((this as any).server) {
    try { relayOut.push(Buffer.isBuffer(chunk) ? chunk.toString('latin1') : String(chunk)); } catch {}
  }
  return (origWrite as any).call(this, chunk, ...rest);
};
const relayMod = require_(path.resolve(HERE, '../relay/server.js'));
const relayServer = relayMod.server;
let PORT = 0;
async function startRelay(port = 0) {
  await new Promise<void>((r) => relayServer.listen(port, '127.0.0.1', () => r()));
  PORT = (relayServer.address() as any).port;
}
async function stopRelay() {
  for (const c of relayMod.clients.values()) { try { c.socket.destroy(); } catch {} }
  relayMod.clients.clear();
  await new Promise<void>((r) => relayServer.close(() => r()));
}
const relaySaw = (needle: string) => relayOut.some((s) => s.includes(needle));

// ---------- Clients applicatifs (vrai code, processus distincts) ----------
type Client = { proc: ChildProcess; call: (cmd: any) => Promise<any> };
async function appClient(room: string): Promise<Client> {
  const proc = fork(path.join(HERE, 'app-client.ts'), [], {
    execArgv: ['--import', 'tsx'], cwd: path.resolve(HERE, '../../prototype'),
    env: { ...process.env, RELAY: `ws://127.0.0.1:${PORT}`, ROOM: room }, stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  });
  let seq = 0; const pending = new Map<number, (v: any) => void>();
  await new Promise<void>((res) => proc.on('message', (m: any) => { if (m.ready) res(); else if (pending.has(m.rid)) { pending.get(m.rid)!(m); pending.delete(m.rid); } }));
  const call = (cmd: any) => new Promise<any>((res) => { const rid = ++seq; pending.set(rid, res); proc.send({ ...cmd, rid }); }).then((m: any) => { if (!m.ok) throw new Error(m.error); return m.data; });
  return { proc, call };
}

// ---------- Client « brut » (attaquant) ----------
type Raw = { ws: WebSocket; inbox: any[]; send: (o: any) => void; close: () => void };
async function raw(room: string): Promise<Raw> {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}?room=${room}`);
  const inbox: any[] = [];
  ws.onmessage = (e) => { try { inbox.push(JSON.parse(String(e.data))); } catch {} };
  await new Promise<void>((r, j) => { ws.onopen = () => r(); ws.onerror = () => j(new Error('ws')); });
  return { ws, inbox, send: (o) => ws.send(JSON.stringify(o)), close: () => ws.close() };
}
const record = (id: string, title: string, pass: boolean, evidence: string) => {
  results.push({ id, title, pass, evidence });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${id} — ${title}\n         ${evidence}`);
};

async function main() {
  await startRelay();

  // T1 — Nominal : deux clients distincts, un seul pair dans le salon → E2EE + accusé signé
  {
    const room = 't1'; relayOut.length = 0;
    const A = await appClient(room); const B = await appClient(room); await sleep(800);
    const secret = 'T1-secret-' + crypto.randomBytes(4).toString('hex');
    const { id } = await A.call({ cmd: 'send', text: secret }); await sleep(1500);
    const got = (await B.call({ cmd: 'received' })).find((m: any) => m.content === secret);
    const st = await A.call({ cmd: 'status', id });
    record('T1', 'Deux clients distincts : réception, chiffrement sur le relais, accusé', !!got && st === 'delivered' && !relaySaw(secret),
      `B reçoit=${!!got} ; statut chez A=${st} ; texte visible par le relais=${relaySaw(secret)}`);
    A.proc.kill(); B.proc.kill(); await sleep(300);
  }

  // T2 — Trois participants : le message part-il en clair ?
  {
    const room = 't2'; relayOut.length = 0;
    const A = await appClient(room); const B = await appClient(room); const C = await appClient(room); await sleep(900);
    const secret = 'T2-secret-' + crypto.randomBytes(4).toString('hex');
    await A.call({ cmd: 'send', text: secret }); await sleep(1500);
    const cGot = (await C.call({ cmd: 'received' })).some((m: any) => m.content === secret);
    record('T2', 'Salon à 3 participants : aucun texte en clair sur le relais', !relaySaw(secret),
      `texte visible par le relais=${relaySaw(secret)} ; lu par le 3ᵉ participant=${cGot} (message saisi avec encrypted:true dans l'interface)`);
    A.proc.kill(); B.proc.kill(); C.proc.kill(); await sleep(300);
  }

  // T3 — Accusé non signé forgé : passe-t-il le message à « délivré » ?
  {
    const room = 't3';
    const A = await appClient(room); await sleep(500);
    const M = await raw(room); await sleep(300);
    const { id } = await A.call({ cmd: 'send', text: 'T3' }); await sleep(600);
    const before = await A.call({ cmd: 'status', id });
    M.send({ type: 'MESHORA_ACK', ack: { messageId: id, recipientId: 'msh_forge', recipientAlias: 'Faux', timestamp: Date.now(), transport: 'websocket', verified: false } });
    await sleep(800);
    const after = await A.call({ cmd: 'status', id });
    record('T3', 'Un accusé NON signé, envoyé par un tiers, ne doit pas valoir « Délivré »', after !== 'delivered',
      `statut avant=${before} ; après accusé forgé=${after}`);
    A.proc.kill(); M.close(); await sleep(300);
  }

  // T4 — Usurpation d'un pair par un participant ordinaire (même senderId, autre clé)
  {
    const room = 't4'; relayOut.length = 0;
    const A = await appClient(room); const B = await appClient(room); await sleep(800);
    const bob = await B.call({ cmd: 'identity' });
    const mKeys = await MeshoraCrypto.generateIdentityKeyPair();
    const M = await raw(room);
    M.send({ type: 'MESHORA_HELLO', senderId: bob.id, senderAlias: bob.alias, publicKey: mKeys.publicKeyHex, room }); await sleep(800);
    const secret = 'T4-secret-' + crypto.randomBytes(4).toString('hex');
    const { id } = await A.call({ cmd: 'send', text: secret }); await sleep(1200);
    let mRead = false;
    for (const p of M.inbox.filter((x) => x.type === 'MESHORA_ENVELOPE')) {
      try { const d = await MeshoraCrypto.decryptEnvelope({ envelope: p.envelope, recipientPrivateKeyPkcs8Hex: mKeys.privateKeyPkcs8Hex }); if (d.plaintext === secret) mRead = true; } catch {}
    }
    const bGot = (await B.call({ cmd: 'received' })).some((m: any) => m.content === secret);
    // L'attaquant renvoie un accusé SIGNÉ avec sa propre clé
    const ack = await MeshoraCrypto.createSignedAck(id, await MeshoraCrypto.importPrivateKey(mKeys.privateKeyPkcs8Hex), mKeys.publicKeyHex);
    M.send({ type: 'MESHORA_ACK', ack: { messageId: id, recipientId: bob.id, recipientAlias: bob.alias, timestamp: ack.timestamp, transport: 'websocket', signature: ack.signatureHex, verified: true, signedAck: ack } });
    await sleep(800);
    const st = await A.call({ cmd: 'status', id });
    record('T4', 'Un tiers se présentant avec l\'identifiant de Bob ne doit pas recevoir les messages destinés à Bob', !mRead,
      `message déchiffré par l'usurpateur=${mRead} ; reçu par le vrai Bob=${bGot} ; statut chez A=${st}`);
    A.proc.kill(); B.proc.kill(); M.close(); await sleep(300);
  }

  // T5 — Boîte aux lettres hors ligne : détournement par simple déclaration de la clé publique
  {
    const room = 't5';
    const bobK = await MeshoraCrypto.generateIdentityKeyPair(); const aliceK = await MeshoraCrypto.generateIdentityKeyPair();
    const env = await MeshoraCrypto.encryptEnvelope({ messageId: 'mbx1', senderPrivateKey: aliceK.privateKey, senderPublicKeyHex: aliceK.publicKeyHex, recipientPublicKeyHex: bobK.publicKeyHex, plaintext: 'T5' });
    const A = await raw(room); A.send({ type: 'MESHORA_ENVELOPE', envelope: env, room }); await sleep(400); // Bob absent → mise en file
    const M = await raw(room); M.send({ type: 'MESHORA_HELLO', senderId: 'msh_mallory', senderAlias: 'X', publicKey: bobK.publicKeyHex, room }); await sleep(500);
    const stolen = M.inbox.some((p) => p.type === 'MESHORA_ENVELOPE' && p.envelope?.id === 'mbx1');
    M.close(); await sleep(200);
    const B = await raw(room); B.send({ type: 'MESHORA_HELLO', senderId: 'msh_bob', senderAlias: 'Bob', publicKey: bobK.publicKeyHex, room }); await sleep(500);
    const bobGot = B.inbox.some((p) => p.type === 'MESHORA_ENVELOPE' && p.envelope?.id === 'mbx1');
    record('T5', 'Seul le vrai destinataire peut retirer son courrier en attente', !stolen && bobGot,
      `retiré par un tiers=${stolen} ; reçu ensuite par Bob=${bobGot}`);
    A.close(); B.close(); await sleep(200);
  }

  // T6 — Réception différée dans l'application : Bob se connecte après l'envoi
  {
    const room = 't6';
    const A = await appClient(room); await sleep(600);
    const secret = 'T6-' + crypto.randomBytes(3).toString('hex');
    const { id } = await A.call({ cmd: 'send', text: secret }); await sleep(500);
    const B = await appClient(room); await sleep(2500);
    const bGot = (await B.call({ cmd: 'received' })).some((m: any) => m.content === secret);
    const st = await A.call({ cmd: 'status', id }); const ob = await A.call({ cmd: 'outbox' });
    record('T6', 'Message envoyé avant l\'arrivée du destinataire : reçu après sa connexion', bGot,
      `reçu par B=${bGot} ; statut chez A=${st} ; dans l'Outbox de A=${ob.some((m: any) => m.id === id)}`);
    A.proc.kill(); B.proc.kill(); await sleep(300);
  }

  // T7 — Coupure du relais puis redémarrage : l'Outbox est-elle renvoyée automatiquement ?
  {
    const room = 't7';
    const A = await appClient(room); const B = await appClient(room); await sleep(800);
    await stopRelay(); await sleep(500);
    const secret = 'T7-' + crypto.randomBytes(3).toString('hex');
    const { id } = await A.call({ cmd: 'send', text: secret }); await sleep(300);
    const during = await A.call({ cmd: 'status', id });
    await startRelay(PORT); await sleep(9000); // reconnexion automatique prévue toutes les 4 s
    const bGot = (await B.call({ cmd: 'received' })).some((m: any) => m.content === secret);
    const after = await A.call({ cmd: 'status', id });
    record('T7', 'Après coupure du relais, le message en attente part automatiquement à la reconnexion', bGot,
      `statut pendant la coupure=${during} ; après reconnexion=${after} ; reçu par B=${bGot}`);
    A.proc.kill(); B.proc.kill(); await sleep(300);
  }

  // T8 — RFC 6455 : trame cliente NON masquée (doit être refusée)
  {
    const s = net.connect(PORT, '127.0.0.1'); let buf = '';
    s.on('data', (d) => (buf += d.toString('latin1')));
    s.write(`GET /?room=t8 HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    await sleep(200);
    const p = Buffer.from(JSON.stringify({ type: 'MESHORA_HELLO', senderId: 'unmasked', publicKey: 'aa', room: 't8' }));
    s.write(Buffer.concat([Buffer.from([0x81, p.length]), p])); await sleep(400);
    const accepted = buf.includes('MESHORA_PEERS') && buf.includes('unmasked');
    record('T8', 'RFC 6455 §5.1 : une trame cliente non masquée doit fermer la connexion', !accepted, `trame non masquée traitée=${accepted}`);
    s.destroy();
  }

  // T9 — Origine non vérifiée (WebSocket inter-sites)
  {
    const s = net.connect(PORT, '127.0.0.1'); let buf = '';
    s.on('data', (d) => (buf += d.toString('latin1')));
    s.write(`GET /?room=t9 HTTP/1.1\r\nHost: x\r\nOrigin: https://site-malveillant.example\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    await sleep(300);
    const ok = buf.startsWith('HTTP/1.1 101');
    record('T9', 'Une page d\'un autre site ne doit pas pouvoir ouvrir de session sur le relais', !ok, `connexion acceptée depuis une origine étrangère=${ok}`);
    s.destroy();
  }

  await stopRelay();
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\nRÉSULTAT : ${results.length - fails}/${results.length} comportements sûrs ; ${fails} faille(s) démontrée(s).`);
  console.log('JSON:' + JSON.stringify(results));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(2); });
