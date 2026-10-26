/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * MESHORA — Relais de référence sur Cloudflare Workers + Durable Objects (SQLite).
 *
 * Portage du relais Node `tools/relay/server.js` (protocole V0.2, docs/PROTOCOLE-V0.2.md §4).
 * Le serveur Node analyse lui-même les trames sur des sockets TCP : impossible dans un Worker.
 * Ici, Cloudflare termine le WebSocket (RFC 6455 : masquage, fragmentation, ping/pong) et
 * chaque SALON est un Durable Object qui reçoit les messages par l'API d'hibernation.
 *
 * Ce que fait le relais (identique au relais Node) :
 *  - défi signé à l'ouverture (MESHORA_CHALLENGE) → HELLO signé ECDSA P-256 + identifiant dérivé ;
 *  - liste des pairs authentifiés du salon ;
 *  - acheminement des enveloppes chiffrées (il ne voit jamais le texte) : l'expéditeur déclaré doit
 *    être la clé authentifiée de la connexion ;
 *  - boîte aux lettres pour un destinataire absent : 24 h, 50 par destinataire, 1000 par salon,
 *    remise uniquement au détenteur PROUVÉ de la clé ; un renvoi (même expéditeur, même id) remplace ;
 *  - accusés signés remis uniquement aux connexions de l'expéditeur du message.
 *
 * Différences assumées avec le relais Node :
 *  - la boîte aux lettres est PERSISTANTE (SQLite du Durable Object) au lieu de la mémoire vive ;
 *  - limite de connexions par adresse IP via le limiteur de débit de Cloudflare (aucun stockage de l'IP) ;
 *  - aucune journalisation applicative (pas de console.log) ; observabilité désactivée dans wrangler.jsonc.
 *
 * Ce que le relais NE garantit PAS : anonymat (Cloudflare voit IP, horaires, tailles, clés publiques,
 * salons), vérification hors bande des clés, disponibilité au-delà des quotas gratuits.
 */

import { DurableObject } from 'cloudflare:workers';

export const LIMITS = {
  maxFrameBytes: 256 * 1024,
  maxClientsPerRoom: 64,
  msgsPerWindow: 60,
  windowMs: 10_000,
  mailboxPerRecipient: 50,
  mailboxPerRoom: 1000,
  mailboxTtlMs: 24 * 3600 * 1000,
  helloTimeoutMs: 10_000,
  maxAliasChars: 64,
  maxKeyHexChars: 400
};

const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEX_RE = /^[0-9a-f]+$/i;
const VERSION = '0.3.0';

const DEFAULT_ORIGINS = [
  'https://meshora.pages.dev',
  'https://*.meshora.pages.dev',
  'http://localhost:*',
  'http://127.0.0.1:*'
];

// ------------------------------------------------------------------ utilitaires

function originAllowed(origin, list) {
  if (!origin) return true; // applications natives et outils : l'Origin ne protège que les navigateurs
  return list.some((pattern) => {
    if (pattern === origin) return true;
    const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    return re.test(origin);
  });
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(n) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(n)));
}

export async function deriveId(publicKeyHex) {
  const digest = await crypto.subtle.digest('SHA-256', hexToBytes(publicKeyHex));
  return 'msh_' + bytesToHex(digest).slice(0, 12);
}

/** ECDSA P-256 / SHA-256, signature IEEE P1363 (r‖s) — format natif de WebCrypto. */
export async function verifyEcdsa(publicKeyHex, signatureHex, text) {
  try {
    if (typeof publicKeyHex !== 'string' || typeof signatureHex !== 'string') return false;
    if (!HEX_RE.test(publicKeyHex) || !HEX_RE.test(signatureHex)) return false;
    if (publicKeyHex.length % 2 || publicKeyHex.length > LIMITS.maxKeyHexChars || signatureHex.length !== 128) return false;
    const key = await crypto.subtle.importKey('spki', hexToBytes(publicKeyHex), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, hexToBytes(signatureHex), new TextEncoder().encode(text));
  } catch {
    return false;
  }
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...extra }
  });
}

// ------------------------------------------------------------------ Worker (point d'entrée)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      if (url.pathname === '/' || url.pathname === '/health') {
        return json({ status: 'ok', service: 'meshora-relay', version: VERSION, channel: env.MESHORA_CHANNEL || 'preprod', protocol: 'v0.2' });
      }
      return new Response('Not Found', { status: 404 });
    }

    const origins = (env.MESHORA_ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
    if (!originAllowed(request.headers.get('Origin'), origins)) return new Response('Forbidden', { status: 403 });

    const room = url.searchParams.get('room') || 'public_meshora';
    if (!ROOM_RE.test(room)) return new Response('Bad Request', { status: 400 });

    // Limite d'ouvertures de connexion par adresse IP (compteur Cloudflare, rien n'est stocké par MESHORA).
    if (env.CONNECT_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      const { success } = await env.CONNECT_LIMITER.limit({ key: ip });
      if (!success) return new Response('Too Many Requests', { status: 429 });
    }

    const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
    return stub.fetch(request);
  }
};

// ------------------------------------------------------------------ Salon (Durable Object)

export class MeshoraRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS mailbox (
      recipient TEXT NOT NULL,
      sender TEXT NOT NULL,
      msg_id TEXT NOT NULL,
      packet TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (recipient, sender, msg_id)
    )`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS mailbox_at ON mailbox(at)');
  }

  // --- état par connexion (survit à l'hibernation) ---
  att(ws) {
    return ws.deserializeAttachment() || {};
  }
  setAtt(ws, a) {
    ws.serializeAttachment(a);
  }
  authed() {
    return this.ctx.getWebSockets().filter((w) => this.att(w).auth && w.readyState === 1);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const room = url.searchParams.get('room') || 'public_meshora';
    if (this.ctx.getWebSockets().length >= LIMITS.maxClientsPerRoom) return new Response('Service Unavailable', { status: 503 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const a = { room, nonce: randomHex(16), auth: false, pub: null, id: null, alias: null, opened: Date.now(), win: Date.now(), cnt: 0 };
    this.setAtt(server, a);
    server.send(JSON.stringify({ type: 'MESHORA_CHALLENGE', nonce: a.nonce, room }));
    await this.scheduleAlarm(Date.now() + LIMITS.helloTimeoutMs + 500);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const a = this.att(ws);
    if (typeof message !== 'string') return this.closeWith(ws, 1003, 'text only');
    if (message.length > LIMITS.maxFrameBytes) return this.closeWith(ws, 1009, 'too big');

    const now = Date.now();
    if (now - a.win > LIMITS.windowMs) {
      a.win = now;
      a.cnt = 0;
    }
    a.cnt++;
    this.setAtt(ws, a);
    if (a.cnt > LIMITS.msgsPerWindow) return this.closeWith(ws, 1008, 'rate limit');

    let msg;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'MESHORA_HELLO') return this.onHello(ws, a, msg);
    if (!a.auth) return; // tout le reste exige une connexion authentifiée

    if (msg.type === 'MESHORA_ENVELOPE') return this.onEnvelope(ws, a, msg);
    if (msg.type === 'MESHORA_ACK') return this.onAck(ws, a, msg);
    // MESHORA_MSG (texte en clair) et types inconnus : ignorés.
  }

  async onHello(ws, a, msg) {
    if (a.auth) return;
    const pub = typeof msg.publicKey === 'string' ? msg.publicKey : '';
    const id = typeof msg.senderId === 'string' ? msg.senderId : '';
    const sig = typeof msg.helloSignature === 'string' ? msg.helloSignature : '';
    const payload = `MESHORA-HELLO|v1|${a.room}|${a.nonce}|${pub}`;
    if (!pub || !HEX_RE.test(pub) || pub.length > LIMITS.maxKeyHexChars || id !== (await deriveId(pub)) || !(await verifyEcdsa(pub, sig, payload))) {
      return this.closeWith(ws, 1008, 'hello rejected');
    }
    a.auth = true;
    a.pub = pub;
    a.id = id;
    a.alias = typeof msg.senderAlias === 'string' ? msg.senderAlias.slice(0, LIMITS.maxAliasChars) : null;
    this.setAtt(ws, a);
    this.broadcastPeers();

    // Courrier en attente : uniquement au détenteur prouvé de la clé destinataire.
    const rows = this.sql.exec('SELECT packet FROM mailbox WHERE recipient = ? AND at >= ? ORDER BY at', pub, Date.now() - LIMITS.mailboxTtlMs).toArray();
    if (rows.length) {
      for (const r of rows) {
        try {
          ws.send(r.packet);
        } catch {}
      }
      this.sql.exec('DELETE FROM mailbox WHERE recipient = ?', pub);
    }
  }

  async onEnvelope(ws, a, msg) {
    const env = msg.envelope;
    if (!env || typeof env !== 'object') return;
    if (env.senderPublicKeyHex !== a.pub) return; // expéditeur déclaré ≠ clé authentifiée
    const recipient = env.recipientPublicKeyHex;
    if (typeof recipient !== 'string' || !HEX_RE.test(recipient) || recipient.length > LIMITS.maxKeyHexChars) return;
    if (typeof env.id !== 'string' || env.id.length > 128) return;
    const packet = JSON.stringify({ type: 'MESHORA_ENVELOPE', envelope: env, room: a.room });

    let delivered = false;
    for (const t of this.authed()) {
      if (t !== ws && this.att(t).pub === recipient) {
        try {
          t.send(packet);
          delivered = true;
        } catch {}
      }
    }
    if (delivered) return;

    const now = Date.now();
    this.sql.exec('DELETE FROM mailbox WHERE at < ?', now - LIMITS.mailboxTtlMs);
    const exists = this.sql.exec('SELECT 1 FROM mailbox WHERE recipient = ? AND sender = ? AND msg_id = ?', recipient, a.pub, env.id).toArray().length > 0;
    if (!exists) {
      const total = this.sql.exec('SELECT COUNT(*) AS n FROM mailbox').one().n;
      if (total >= LIMITS.mailboxPerRoom) return;
      const per = this.sql.exec('SELECT COUNT(*) AS n FROM mailbox WHERE recipient = ?', recipient).one().n;
      if (per >= LIMITS.mailboxPerRecipient) return;
    }
    // Un renvoi du même message (même expéditeur, même identifiant) remplace la copie en attente.
    this.sql.exec('INSERT OR REPLACE INTO mailbox (recipient, sender, msg_id, packet, at) VALUES (?, ?, ?, ?, ?)', recipient, a.pub, env.id, packet, now);
    await this.scheduleAlarm(now + LIMITS.mailboxTtlMs + 1000);
  }

  onAck(ws, a, msg) {
    const ack = msg.ack;
    if (!ack || typeof ack !== 'object' || !ack.signedAck || typeof ack.signedAck !== 'object') return;
    if (ack.signedAck.recipientPublicKeyHex !== a.pub) return;
    const senderKey = ack.signedAck.senderPublicKeyHex;
    if (typeof senderKey !== 'string' || !HEX_RE.test(senderKey)) return;
    const packet = JSON.stringify({ type: 'MESHORA_ACK', ack });
    for (const t of this.authed()) {
      if (this.att(t).pub === senderKey) {
        try {
          t.send(packet);
        } catch {}
      }
    }
  }

  broadcastPeers(except) {
    const list = this.authed().filter((w) => w !== except);
    const now = Date.now();
    const peers = list.map((w) => {
      const x = this.att(w);
      return { id: x.id, alias: x.alias || 'Pair-Meshora', publicKey: x.pub, transport: 'websocket', hops: 1, lastSeen: now, isGateway: false, verified: false };
    });
    const frame = JSON.stringify({ type: 'MESHORA_PEERS', peers });
    for (const w of list) {
      try {
        w.send(frame);
      } catch {}
    }
  }

  closeWith(ws, code, reason) {
    const wasAuth = this.att(ws).auth;
    try {
      ws.close(code, reason);
    } catch {}
    if (wasAuth) this.broadcastPeers(ws);
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, '');
    } catch {}
    if (this.att(ws).auth) this.broadcastPeers(ws);
  }

  async webSocketError(ws) {
    if (this.att(ws).auth) this.broadcastPeers(ws);
  }

  // --- minuterie : connexions non authentifiées après 10 s, purge des courriers de plus de 24 h ---
  async scheduleAlarm(at) {
    const cur = await this.ctx.storage.getAlarm();
    if (cur === null || at < cur) await this.ctx.storage.setAlarm(at);
  }

  async alarm() {
    const now = Date.now();
    let next = null;
    for (const w of this.ctx.getWebSockets()) {
      const x = this.att(w);
      if (x.auth) continue;
      const deadline = x.opened + LIMITS.helloTimeoutMs;
      if (now >= deadline) this.closeWith(w, 1008, 'hello timeout');
      else next = Math.min(next ?? Infinity, deadline + 500);
    }
    this.sql.exec('DELETE FROM mailbox WHERE at < ?', now - LIMITS.mailboxTtlMs);
    const oldest = this.sql.exec('SELECT MIN(at) AS m FROM mailbox').one().m;
    if (oldest !== null && oldest !== undefined) next = Math.min(next ?? Infinity, oldest + LIMITS.mailboxTtlMs + 1000);
    if (next !== null) await this.ctx.storage.setAlarm(next);
  }
}
