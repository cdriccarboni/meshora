/**
 * MESHORA — Banc de conformité « boîte noire » du relais (protocole V0.2, docs/PROTOCOLE-V0.2.md §4).
 * Vise N'IMPORTE QUEL relais par son URL : relais Node local, Worker en local (wrangler dev) ou déployé.
 * Utilise le vrai code applicatif web (tools/audit/app-client.ts) pour les scénarios de bout en bout.
 *
 * Usage (depuis prototype/) :
 *   RELAY=ws://127.0.0.1:8787 npx tsx ../tools/audit/relay-conformance.ts
 *   RELAY=wss://meshora-relay-preprod.<compte>.workers.dev npx tsx ../tools/audit/relay-conformance.ts
 * Option : ORIGIN=https://meshora.pages.dev (Origin envoyé par les clients navigateur simulés).
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import { fork, ChildProcess } from 'node:child_process';
import { MeshoraCrypto } from '../../prototype/src/core/crypto';

const RELAY = (process.env.RELAY || 'ws://127.0.0.1:8787').replace(/\/+$/, '');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const RUN = crypto.randomBytes(3).toString('hex'); // salons uniques : la boîte aux lettres peut être persistante
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: { id: string; title: string; pass: boolean; evidence: string }[] = [];
const record = (id: string, title: string, pass: boolean, evidence: string) => {
  results.push({ id, title, pass, evidence });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${id} — ${title}\n         ${evidence}`);
};
const room = (s: string) => `c${RUN}_${s}`;

// ---------- clients bruts ----------
type Raw = { ws: WebSocket; inbox: any[]; send: (o: any) => void; sendRaw: (d: any) => void; close: () => void; nonce: () => Promise<string>; closed: () => boolean; code: () => number | null };
async function raw(r: string): Promise<Raw> {
  const ws = new WebSocket(`${RELAY}/?room=${r}`);
  const inbox: any[] = [];
  let isClosed = false; let code: number | null = null;
  ws.onmessage = (e) => { try { inbox.push(JSON.parse(String(e.data))); } catch {} };
  ws.onclose = (e) => { isClosed = true; code = e.code; };
  await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error('ws open failed')); });
  const nonce = async () => {
    for (let i = 0; i < 100; i++) { const c = inbox.find((p) => p.type === 'MESHORA_CHALLENGE'); if (c) return c.nonce as string; await sleep(30); }
    return '';
  };
  return { ws, inbox, send: (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }, sendRaw: (d) => { if (ws.readyState === 1) ws.send(d); }, close: () => ws.close(), nonce, closed: () => isClosed, code: () => code };
}
type Keys = Awaited<ReturnType<typeof MeshoraCrypto.generateIdentityKeyPair>>;
const idOf = async (pub: string) => 'msh_' + (await MeshoraCrypto.computeFingerprint(pub)).replace(/:/g, '').substring(0, 12);
async function hello(r: Raw, rm: string, k: Keys, alias: string, claimedId?: string, badSig = false) {
  const n = await r.nonce();
  const sig = badSig ? '00'.repeat(64) : await MeshoraCrypto.signData(await MeshoraCrypto.importPrivateKey(k.privateKeyPkcs8Hex), `MESHORA-HELLO|v1|${rm}|${n}|${k.publicKeyHex}`);
  r.send({ type: 'MESHORA_HELLO', senderId: claimedId ?? (await idOf(k.publicKeyHex)), senderAlias: alias, publicKey: k.publicKeyHex, helloSignature: sig, room: rm });
}
async function authed(rm: string, alias: string) {
  const k = await MeshoraCrypto.generateIdentityKeyPair();
  const r = await raw(rm); await hello(r, rm, k, alias);
  for (let i = 0; i < 60 && !r.inbox.some((p) => p.type === 'MESHORA_PEERS'); i++) await sleep(50);
  return { r, k };
}
const waitFor = async (pred: () => boolean, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (pred()) return true; await sleep(50); } return pred(); };

/** Ouverture HTTP brute (pour l'Origin et les codes de refus) : renvoie 101 ou le code HTTP. */
function upgradeStatus(query: string, origin?: string): Promise<number> {
  const u = new URL(RELAY.replace(/^ws/, 'http'));
  const mod = u.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const req = mod.request({ host: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: '/' + query, method: 'GET', headers: {
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), ...(origin ? { Origin: origin } : {})
    } });
    req.on('upgrade', (_res, socket) => { socket.destroy(); resolve(101); });
    req.on('response', (res) => { res.resume(); resolve(res.statusCode || 0); });
    req.on('error', () => resolve(-1));
    req.setTimeout(8000, () => { req.destroy(); resolve(-2); });
    req.end();
  });
}

// ---------- clients applicatifs réels ----------
type Client = { proc: ChildProcess; call: (cmd: any) => Promise<any> };
async function appClient(rm: string): Promise<Client> {
  const proc = fork(path.join(HERE, 'app-client.ts'), [], {
    execArgv: ['--import', 'tsx'], cwd: path.resolve(HERE, '../../prototype'),
    env: { ...process.env, RELAY, ROOM: rm }, stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  });
  let seq = 0; const pending = new Map<number, (v: any) => void>();
  await new Promise<void>((res) => proc.on('message', (m: any) => { if (m.ready) res(); else if (pending.has(m.rid)) { pending.get(m.rid)!(m); pending.delete(m.rid); } }));
  const call = (cmd: any) => new Promise<any>((res) => { const rid = ++seq; pending.set(rid, res); proc.send({ ...cmd, rid }); }).then((m: any) => { if (!m.ok) throw new Error(m.error); return m.data; });
  return { proc, call };
}

async function main() {
  console.log(`Relais visé : ${RELAY}   (série ${RUN})\n`);

  // C1 — santé
  {
    let body: any = null;
    try { body = await (await fetch(RELAY.replace(/^ws/, 'http') + '/health')).json(); } catch {}
    record('C1', 'Point de santé /health', body?.status === 'ok', `réponse=${JSON.stringify(body)}`);
  }

  // C2 — Origin hors liste blanche, Origin autorisé, salon invalide
  {
    const bad = await upgradeStatus(`?room=${room('c2')}`, 'https://site-malveillant.example');
    const good = await upgradeStatus(`?room=${room('c2')}`, 'https://meshora.pages.dev');
    const badRoom = await upgradeStatus(`?room=${encodeURIComponent('../x y')}`);
    record('C2', 'Origin non autorisé refusé, Origin du site accepté, salon invalide refusé', bad === 403 && good === 101 && badRoom === 400,
      `Origin malveillant=${bad} ; meshora.pages.dev=${good} ; salon invalide=${badRoom}`);
  }

  // C3 — HELLO avec signature invalide, puis identifiant revendiqué ≠ identifiant dérivé
  {
    const rm = room('c3');
    const k = await MeshoraCrypto.generateIdentityKeyPair();
    const a = await raw(rm); await hello(a, rm, k, 'X', undefined, true);
    const other = await MeshoraCrypto.generateIdentityKeyPair();
    const b = await raw(rm); await hello(b, rm, k, 'Y', await idOf(other.publicKeyHex));
    await waitFor(() => a.closed() && b.closed());
    record('C3', 'HELLO à signature fausse ou à identifiant usurpé : connexion fermée (1008)', a.closed() && b.closed() && a.code() === 1008 && b.code() === 1008,
      `signature fausse → fermé=${a.closed()} code=${a.code()} ; identifiant usurpé → fermé=${b.closed()} code=${b.code()}`);
  }

  // C4 — liste des pairs : seuls les authentifiés, mise à jour à la déconnexion
  {
    const rm = room('c4');
    const A = await authed(rm, 'Alice'); const anon = await raw(rm); await anon.nonce();
    const B = await authed(rm, 'Bob');
    await waitFor(() => (A.r.inbox.filter((p) => p.type === 'MESHORA_PEERS').at(-1)?.peers.length ?? 0) === 2);
    const two = A.r.inbox.filter((p) => p.type === 'MESHORA_PEERS').at(-1)?.peers.length;
    const anonSees = anon.inbox.some((p) => p.type === 'MESHORA_PEERS');
    B.r.close();
    await waitFor(() => (A.r.inbox.filter((p) => p.type === 'MESHORA_PEERS').at(-1)?.peers.length ?? 0) === 1);
    const one = A.r.inbox.filter((p) => p.type === 'MESHORA_PEERS').at(-1)?.peers.length;
    record('C4', 'Pairs : seuls les clients authentifiés, liste à jour après départ', two === 2 && one === 1 && !anonSees,
      `pairs avec Bob=${two} ; après départ de Bob=${one} ; liste reçue par un non-authentifié=${anonSees}`);
    A.r.close(); anon.close();
  }

  // C5 — texte en clair refusé ; enveloppe à expéditeur usurpé refusée
  {
    const rm = room('c5');
    const A = await authed(rm, 'Alice'); const B = await authed(rm, 'Bob'); const M = await authed(rm, 'Mallory');
    M.r.send({ type: 'MESHORA_MSG', content: 'CLAIR-' + RUN, recipientId: 'broadcast' });
    const forged = await MeshoraCrypto.encryptEnvelope({ messageId: 'forge', senderPrivateKey: M.k.privateKey, senderPublicKeyHex: M.k.publicKeyHex, recipientPublicKeyHex: B.k.publicKeyHex, plaintext: 'x' });
    M.r.send({ type: 'MESHORA_ENVELOPE', envelope: { ...forged, senderPublicKeyHex: A.k.publicKeyHex }, room: rm });
    await sleep(1500);
    const clear = [A, B].some((c) => c.r.inbox.some((p) => JSON.stringify(p).includes('CLAIR-' + RUN)));
    const spoof = B.r.inbox.some((p) => p.type === 'MESHORA_ENVELOPE' && p.envelope?.id === 'forge');
    record('C5', 'Texte en clair non relayé ; enveloppe dont l\'expéditeur n\'est pas la clé authentifiée non relayée', !clear && !spoof,
      `clair relayé=${clear} ; enveloppe usurpée relayée=${spoof}`);
    [A, B, M].forEach((c) => c.r.close());
  }

  // C6 — boîte aux lettres : seul le détenteur prouvé de la clé retire le courrier ; renvoi = remplacement
  {
    const rm = room('c6');
    const bobK = await MeshoraCrypto.generateIdentityKeyPair();
    const A = await authed(rm, 'Alice');
    const env = await MeshoraCrypto.encryptEnvelope({ messageId: 'mbx1', senderPrivateKey: A.k.privateKey, senderPublicKeyHex: A.k.publicKeyHex, recipientPublicKeyHex: bobK.publicKeyHex, plaintext: 'C6' });
    A.r.send({ type: 'MESHORA_ENVELOPE', envelope: env, room: rm });
    await sleep(400);
    A.r.send({ type: 'MESHORA_ENVELOPE', envelope: env, room: rm }); // renvoi de l'Outbox
    await sleep(600);
    const M = await raw(rm); await hello(M, rm, bobK, 'X', undefined, true); await sleep(1200);
    const stolen = M.inbox.some((p) => p.type === 'MESHORA_ENVELOPE');
    const B = await raw(rm); await hello(B, rm, bobK, 'Bob');
    await waitFor(() => B.inbox.some((p) => p.type === 'MESHORA_ENVELOPE'));
    await sleep(700);
    const copies = B.inbox.filter((p) => p.type === 'MESHORA_ENVELOPE' && p.envelope?.id === 'mbx1').length;
    B.close(); await sleep(500);
    const B2 = await raw(rm); await hello(B2, rm, bobK, 'Bob'); await sleep(1500);
    const again = B2.inbox.filter((p) => p.type === 'MESHORA_ENVELOPE').length;
    record('C6', 'Courrier différé : non retiré par un imposteur, remis une seule fois au vrai destinataire, puis effacé', !stolen && copies === 1 && again === 0,
      `retiré par imposteur=${stolen} ; copies reçues par Bob=${copies} ; recopies à la reconnexion=${again}`);
    A.r.close(); B2.close();
  }

  // C7 — accusé : exige la clé authentifiée du destinataire, remis seulement à l'expéditeur
  {
    const rm = room('c7');
    const A = await authed(rm, 'Alice'); const B = await authed(rm, 'Bob'); const C = await authed(rm, 'Carol');
    const env = await MeshoraCrypto.encryptEnvelope({ messageId: 'ack1', senderPrivateKey: A.k.privateKey, senderPublicKeyHex: A.k.publicKeyHex, recipientPublicKeyHex: B.k.publicKeyHex, plaintext: 'C7' });
    const signed = await MeshoraCrypto.createSignedAck(env as any, await MeshoraCrypto.importPrivateKey(B.k.privateKeyPkcs8Hex));
    C.r.send({ type: 'MESHORA_ACK', ack: { messageId: 'ack1', recipientId: 'x', timestamp: Date.now(), transport: 'websocket', signedAck: signed } }); // Carol relaie l'accusé de Bob
    await sleep(800);
    const viaCarol = A.r.inbox.some((p) => p.type === 'MESHORA_ACK');
    B.r.send({ type: 'MESHORA_ACK', ack: { messageId: 'ack1', recipientId: 'x', timestamp: Date.now(), transport: 'websocket', signedAck: signed } });
    await waitFor(() => A.r.inbox.some((p) => p.type === 'MESHORA_ACK'));
    const toA = A.r.inbox.some((p) => p.type === 'MESHORA_ACK');
    const toC = C.r.inbox.some((p) => p.type === 'MESHORA_ACK');
    record('C7', 'Accusé accepté seulement de la clé du destinataire et remis seulement à l\'expéditeur', !viaCarol && toA && !toC,
      `accusé relayé par un tiers=${viaCarol} ; reçu par l'expéditeur=${toA} ; vu par un tiers=${toC}`);
    [A, B, C].forEach((c) => c.r.close());
  }

  // C8 — saturation : plus de 60 paquets en 10 s → fermeture
  {
    const rm = room('c8');
    const A = await authed(rm, 'Flood');
    for (let i = 0; i < 75; i++) A.r.send({ type: 'NOOP', i });
    await waitFor(() => A.r.closed(), 5000);
    record('C8', 'Limite de débit : > 60 paquets / 10 s → connexion fermée (1008)', A.r.closed() && A.r.code() === 1008, `fermé=${A.r.closed()} code=${A.r.code()}`);
  }

  // C9 — paquet trop gros (300 Kio) et paquet binaire → fermeture
  {
    const rm = room('c9');
    const A = await authed(rm, 'Big'); A.r.send({ type: 'NOOP', pad: 'x'.repeat(300 * 1024) });
    const B = await authed(rm, 'Bin'); B.r.sendRaw(new Uint8Array([1, 2, 3]));
    await waitFor(() => A.r.closed() && B.r.closed(), 5000);
    record('C9', 'Paquet > 256 Kio (1009) et paquet binaire (1003) : connexion fermée', A.r.closed() && B.r.closed() && A.r.code() === 1009 && B.r.code() === 1003,
      `300 Kio → fermé=${A.r.closed()} code=${A.r.code()} ; binaire → fermé=${B.r.closed()} code=${B.r.code()}`);
  }

  // C10 — délai d'authentification : sans HELLO, le relais envoie une trame de fermeture 1008 après ~10 s.
  // Mesuré sur le fil (TCP/TLS brut) : l'événement onclose d'un client dépend aussi de la coupure TCP.
  {
    const u = new URL(RELAY.replace(/^ws/, 'http'));
    const tls = await import('node:tls'); const net = await import('node:net');
    const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
    const r = await new Promise<{ code: number; dt: number }>((resolve) => {
      const t0 = Date.now(); let upgraded = false;
      const onConn = () => s.write(`GET /?room=${room('c10')} HTTP/1.1\r\nHost: ${u.hostname}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      const s: any = u.protocol === 'https:' ? tls.connect(port, u.hostname, { servername: u.hostname }, onConn) : net.connect(port, u.hostname, onConn);
      let buf = Buffer.alloc(0);
      s.on('data', (d: Buffer) => {
        buf = Buffer.concat([buf, d]);
        if (!upgraded) { const i = buf.indexOf('\r\n\r\n'); if (i < 0) return; upgraded = true; buf = buf.subarray(i + 4); }
        while (buf.length >= 2) {
          const op = buf[0] & 0x0f; const len = buf[1] & 0x7f; const hdr = len === 126 ? 4 : len === 127 ? 10 : 2;
          const plen = len === 126 ? buf.readUInt16BE(2) : len === 127 ? Number(buf.readBigUInt64BE(2)) : len;
          if (buf.length < hdr + plen) break;
          if (op === 0x8) { s.destroy(); return resolve({ code: plen >= 2 ? buf.readUInt16BE(hdr) : 1005, dt: (Date.now() - t0) / 1000 }); }
          buf = buf.subarray(hdr + plen);
        }
      });
      s.on('error', () => resolve({ code: -1, dt: (Date.now() - t0) / 1000 }));
      setTimeout(() => { s.destroy(); resolve({ code: 0, dt: (Date.now() - t0) / 1000 }); }, 16000);
    });
    record('C10', 'Connexion non authentifiée : trame de fermeture 1008 après le délai (≈ 10 s)', r.code === 1008 && r.dt >= 9 && r.dt <= 15, `code=${r.code} après ${r.dt.toFixed(1)} s`);
  }

  // C13 — saturation d'un salon par des connexions jamais authentifiées : refus au-delà de 64, puis libération
  {
    const rm = room('c13');
    const socks: Raw[] = [];
    for (let i = 0; i < 64; i++) { try { socks.push(await raw(rm)); } catch { break; } }
    const full = await upgradeStatus(`?room=${rm}`);
    await sleep(11500);
    const after = await upgradeStatus(`?room=${rm}`);
    record('C13', 'Salon saturé par 64 connexions anonymes : refus (503), puis place libérée après le délai d\'authentification', socks.length === 64 && full === 503 && after === 101,
      `connexions ouvertes=${socks.length} ; 65ᵉ=${full} ; après 11,5 s=${after}`);
    socks.forEach((x) => { try { x.ws.close(); } catch {} });
  }

  // C14 — V0.4 passerelle : enveloppe PORTÉE par un tiers (signature de l'auteur vérifiée par le relais)
  {
    const rm = room('c14');
    const A = await MeshoraCrypto.generateIdentityKeyPair();   // auteur, sans Internet (pas de connexion)
    const B = await authed(rm, 'Bob'); const G = await authed(rm, 'Passerelle');
    const env = await MeshoraCrypto.encryptEnvelope({ messageId: 'fwd1', senderPrivateKey: A.privateKey, senderPublicKeyHex: A.publicKeyHex, recipientPublicKeyHex: B.k.publicKeyHex, plaintext: 'C14' });
    G.r.send({ type: 'MESHORA_FORWARD', envelope: env });
    const forged = { ...env, id: 'fwd2', ciphertextHex: env.ciphertextHex.slice(0, -2) + (env.ciphertextHex.endsWith('00') ? '01' : '00') };
    G.r.send({ type: 'MESHORA_FORWARD', envelope: forged });
    const old = { ...env, id: 'fwd3', timestamp: Date.now() - 72 * 3600_000 };
    const sOld = await MeshoraCrypto.signData(A.privateKey, `${old.id}|${old.senderPublicKeyHex}|${old.recipientPublicKeyHex}|${old.ephemeralPublicKeyHex}|${old.ivHex}|${old.ciphertextHex}|${old.timestamp}`);
    G.r.send({ type: 'MESHORA_FORWARD', envelope: { ...old, signatureHex: sOld } });
    await waitFor(() => B.r.inbox.some((p) => p.envelope?.id === 'fwd1'));
    await sleep(1200);
    const ids = B.r.inbox.filter((p) => p.type === 'MESHORA_ENVELOPE').map((p) => p.envelope.id);
    record('C14', 'Passerelle : enveloppe d\'un tiers remise si sa signature est valide ; altérée ou trop ancienne refusée', ids.includes('fwd1') && !ids.includes('fwd2') && !ids.includes('fwd3'),
      `reçues par Bob=${JSON.stringify(ids)}`);
    // C15 — accusé porté par un tiers
    const ack = await MeshoraCrypto.createSignedAck(env as any, await MeshoraCrypto.importPrivateKey(B.k.privateKeyPkcs8Hex));
    const A2 = await raw(rm); await hello(A2, rm, A, 'Alice');
    await waitFor(() => A2.inbox.some((p) => p.type === 'MESHORA_PEERS'));
    G.r.send({ type: 'MESHORA_FORWARD', signedAck: { ...ack, signatureHex: '00'.repeat(64) } });
    await sleep(800);
    const forgedAck = A2.inbox.some((p) => p.type === 'MESHORA_ACK');
    G.r.send({ type: 'MESHORA_FORWARD', signedAck: ack });
    const okAck = await waitFor(() => A2.inbox.some((p) => p.type === 'MESHORA_ACK' && p.ack?.signedAck?.signatureHex === ack.signatureHex));
    record('C15', 'Passerelle : accusé d\'un tiers remis à l\'expéditeur si signé par le destinataire ; faux accusé refusé', okAck && !forgedAck,
      `faux accusé remis=${forgedAck} ; vrai accusé remis=${okAck}`);
    [B, G].forEach((c) => c.r.close()); A2.close();
  }

  // C16 — V0.4 délégation : la passerelle reçoit le courrier (chiffré) d'un membre sans Internet
  {
    const rm = room('c16');
    const A = await MeshoraCrypto.generateIdentityKeyPair();   // sans Internet
    const B = await authed(rm, 'Bob');
    // Courrier pour A AVANT la délégation → boîte aux lettres
    const e1 = await MeshoraCrypto.encryptEnvelope({ messageId: 'srv1', senderPrivateKey: B.k.privateKey, senderPublicKeyHex: B.k.publicKeyHex, recipientPublicKeyHex: A.publicKeyHex, plaintext: 'avant' });
    B.r.send({ type: 'MESHORA_ENVELOPE', envelope: e1, room: rm }); await sleep(600);
    const G = await authed(rm, 'Passerelle'); const X = await authed(rm, 'Autre');
    const ts = Date.now();
    const sigFor = (gw: string, r: string) => MeshoraCrypto.signData(A.privateKey, `MESHORA-DELEGATE|v1|${r}|${A.publicKeyHex}|${gw}|${ts}`);
    // Délégations invalides : au profit d'une autre passerelle, pour un autre salon, signature d'une autre clé
    X.r.send({ type: 'MESHORA_SERVE', delegation: { publicKey: A.publicKeyHex, gateway: G.k.publicKeyHex, timestamp: ts, signature: await sigFor(G.k.publicKeyHex, rm) } });
    G.r.send({ type: 'MESHORA_SERVE', delegation: { publicKey: A.publicKeyHex, gateway: G.k.publicKeyHex, timestamp: ts, signature: await sigFor(G.k.publicKeyHex, 'autre-salon') } });
    await sleep(800);
    const leaked = [X, G].some((c) => c.r.inbox.some((p) => p.envelope?.id === 'srv1'));
    G.r.send({ type: 'MESHORA_SERVE', delegation: { publicKey: A.publicKeyHex, gateway: G.k.publicKeyHex, alias: 'Alice', timestamp: ts, signature: await sigFor(G.k.publicKeyHex, rm) } });
    const drained = await waitFor(() => G.r.inbox.some((p) => p.envelope?.id === 'srv1'));
    const listed = await waitFor(() => (B.r.inbox.filter((p) => p.type === 'MESHORA_PEERS').at(-1)?.peers || []).some((p: any) => p.publicKey === A.publicKeyHex && p.viaGateway));
    const e2 = await MeshoraCrypto.encryptEnvelope({ messageId: 'srv2', senderPrivateKey: B.k.privateKey, senderPublicKeyHex: B.k.publicKeyHex, recipientPublicKeyHex: A.publicKeyHex, plaintext: 'après' });
    B.r.send({ type: 'MESHORA_ENVELOPE', envelope: e2, room: rm });
    const live = await waitFor(() => G.r.inbox.some((p) => p.envelope?.id === 'srv2'));
    const xGot = X.r.inbox.some((p) => p.envelope?.id === 'srv2');
    record('C16', 'Délégation : refusée si mal signée, pour une autre passerelle ou un autre salon ; sinon courrier en attente et nouveau courrier remis à la passerelle seule, membre annoncé « via passerelle »',
      !leaked && drained && listed && live && !xGot, `fuite avant délégation valide=${leaked} ; boîte vidée vers la passerelle=${drained} ; annoncé=${listed} ; courrier direct=${live} ; reçu par un tiers=${xGot}`);
    [B, G, X].forEach((c) => c.r.close());
  }

  // C11 — bout en bout avec le VRAI code web : réception, accusé signé, réception différée, préemption d'identifiant
  {
    const rm = room('c11');
    const A = await appClient(rm); const B = await appClient(rm); await sleep(2000);
    const secret = 'C11-' + crypto.randomBytes(3).toString('hex');
    const { id } = await A.call({ cmd: 'send', text: secret });
    let st = ''; for (let i = 0; i < 40 && st !== 'delivered'; i++) { await sleep(250); st = await A.call({ cmd: 'status', id }); }
    const got = (await B.call({ cmd: 'received' })).some((m: any) => m.content === secret);
    record('C11', 'Application web ↔ application web : reçu et « Délivré » (accusé signé)', got && st === 'delivered', `reçu=${got} ; statut=${st}`);
    A.proc.kill(); B.proc.kill(); await sleep(300);
  }
  {
    const rm = room('c12');
    const A = await appClient(rm); await sleep(1500);
    const secret = 'C12-' + crypto.randomBytes(3).toString('hex');
    const { id } = await A.call({ cmd: 'send', text: secret }); await sleep(1000);
    const B = await appClient(rm);
    let got = false; for (let i = 0; i < 40 && !got; i++) { await sleep(250); got = (await B.call({ cmd: 'received' })).some((m: any) => m.content === secret); }
    let st = ''; for (let i = 0; i < 40 && st !== 'delivered'; i++) { await sleep(250); st = await A.call({ cmd: 'status', id }); }
    record('C12', 'Message envoyé avant l\'arrivée du destinataire : remis à sa connexion, puis « Délivré »', got && st === 'delivered', `reçu=${got} ; statut=${st}`);
    A.proc.kill(); B.proc.kill(); await sleep(300);
  }

  const fails = results.filter((r) => !r.pass).length;
  console.log(`\nRÉSULTAT : ${results.length - fails}/${results.length} vérifications réussies contre ${RELAY}`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
