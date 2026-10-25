#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Relais WebSocket de TEST, sans dépendance externe (node:http + node:crypto).
 *
 * Version durcie par le contre-audit V0.2 (Claude). Voir docs/audits/CONTRE-AUDIT-V0.2.md.
 *
 * Ce que fait le relais :
 *  - salons (?room=), liste des pairs AUTHENTIFIÉS du salon ;
 *  - acheminement d'enveloppes chiffrées de bout en bout (il ne voit jamais le contenu) ;
 *  - boîte aux lettres en mémoire (store-and-forward) pour un destinataire authentifié absent ;
 *  - acheminement des accusés de réception signés.
 *
 * Contrôles ajoutés :
 *  - authentification du HELLO par défi signé (ECDSA P-256) + identifiant dérivé de la clé publique ;
 *  - aucun message en clair relayé (MESHORA_MSG refusé) ; enveloppe acceptée seulement si l'expéditeur
 *    déclaré est la clé authentifiée de la connexion ;
 *  - trames : taille maximale, masquage client obligatoire, fragmentation refusée (RFC 6455 §5.1, §5.3) ;
 *  - contrôle de l'en-tête Origin (liste blanche) ; limites de débit, de clients, de salons, de boîtes ;
 *  - écoute par défaut sur 127.0.0.1 (exposition explicite via HOST=0.0.0.0 ou un tunnel).
 *
 * Ce que le relais NE garantit PAS : disponibilité, persistance (mémoire vive uniquement),
 * anonymat (il voit adresses IP, horaires, tailles, clés publiques), vérification hors bande des clés.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;
const HOST = process.env.HOST || '127.0.0.1';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const LIMITS = {
  maxFrameBytes: 256 * 1024, // une enveloppe de texte fait quelques Kio
  maxClients: 500,
  maxClientsPerRoom: 64,
  maxRooms: 200,
  msgsPerWindow: 60, // messages par fenêtre et par connexion
  windowMs: 10_000,
  mailboxPerRecipient: 50,
  mailboxPerRoom: 1000,
  mailboxTtlMs: 24 * 3600 * 1000,
  helloTimeoutMs: 10_000,
  pingIntervalMs: 30_000
};

const DEFAULT_ORIGINS = [
  'https://meshora.pages.dev',
  'https://*.meshora.pages.dev',
  'http://localhost:*',
  'http://127.0.0.1:*'
];
const ALLOWED_ORIGINS = (process.env.MESHORA_ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HEX_RE = /^[0-9a-f]+$/i;

// clientId -> client
const clients = new Map();
// room -> Map(recipientPublicKeyHex -> Array<{ packet, at }>)
const offlineMailboxes = new Map();

// ---------------------------------------------------------------- utilitaires

function originAllowed(origin) {
  if (!origin) return true; // clients non navigateurs (tests, outils) : l'Origin ne protège que les navigateurs
  return ALLOWED_ORIGINS.some((pattern) => {
    if (pattern === origin) return true;
    const re = new RegExp(
      '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'
    );
    return re.test(origin);
  });
}

/** Identifiant MESHORA dérivé d'une clé publique SPKI hex : 'msh_' + 12 premiers hex de SHA-256. */
function deriveId(publicKeyHex) {
  return 'msh_' + crypto.createHash('sha256').update(Buffer.from(publicKeyHex, 'hex')).digest('hex').slice(0, 12);
}

/** Vérifie une signature WebCrypto ECDSA P-256 / SHA-256 (format brut r||s). */
function verifyEcdsa(publicKeyHex, signatureHex, text) {
  try {
    if (!HEX_RE.test(publicKeyHex) || !HEX_RE.test(signatureHex) || publicKeyHex.length > 400) return false;
    const key = crypto.createPublicKey({ key: Buffer.from(publicKeyHex, 'hex'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ec') return false;
    return crypto.verify(
      'sha256',
      Buffer.from(text, 'utf8'),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureHex, 'hex')
    );
  } catch {
    return false;
  }
}

function encodeWsFrame(data, opcode = 0x1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, payload]);
}

function closeWith(client, code, reason) {
  if (client.closed) return;
  client.closed = true;
  const body = Buffer.alloc(2 + Buffer.byteLength(reason || ''));
  body.writeUInt16BE(code, 0);
  if (reason) body.write(reason, 2);
  try {
    client.socket.write(encodeWsFrame(body, 0x8));
  } catch {}
  try {
    client.socket.end();
  } catch {}
  setTimeout(() => {
    try {
      client.socket.destroy();
    } catch {}
  }, 200);
  dropClient(client);
}

function dropClient(client) {
  if (!clients.has(client.id)) return;
  clients.delete(client.id);
  clearTimeout(client.helloTimer);
  if (client.authenticated) broadcastPeerList(client.room);
}

function sendJson(client, obj) {
  if (client.closed || client.socket.destroyed || !client.socket.writable) return false;
  try {
    client.socket.write(encodeWsFrame(JSON.stringify(obj)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Analyse des trames client. Retourne { frames, remaining, error }.
 * error = { code, reason } si la trame viole les limites ou la RFC 6455.
 */
function parseWsFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const fin = (b0 & 0x80) !== 0;
    const rsv = b0 & 0x70;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let hdr = 2;

    if (rsv !== 0) return { frames, remaining: Buffer.alloc(0), error: { code: 1002, reason: 'rsv' } };
    if (!masked) return { frames, remaining: Buffer.alloc(0), error: { code: 1002, reason: 'unmasked' } };
    if (!fin || opcode === 0x0) return { frames, remaining: Buffer.alloc(0), error: { code: 1003, reason: 'fragmented' } };

    if (len === 126) {
      if (offset + 4 > buffer.length) break;
      len = buffer.readUInt16BE(offset + 2);
      hdr = 4;
    } else if (len === 127) {
      if (offset + 10 > buffer.length) break;
      const big = buffer.readBigUInt64BE(offset + 2);
      if (big > BigInt(LIMITS.maxFrameBytes)) {
        return { frames, remaining: Buffer.alloc(0), error: { code: 1009, reason: 'too big' } };
      }
      len = Number(big);
      hdr = 10;
    }
    if (len > LIMITS.maxFrameBytes) return { frames, remaining: Buffer.alloc(0), error: { code: 1009, reason: 'too big' } };
    if (offset + hdr + 4 > buffer.length) break;
    const mask = buffer.subarray(offset + hdr, offset + hdr + 4);
    hdr += 4;
    if (offset + hdr + len > buffer.length) break;

    const payload = Buffer.alloc(len);
    for (let i = 0; i < len; i++) payload[i] = buffer[offset + hdr + i] ^ mask[i & 3];
    frames.push({ opcode, payload });
    offset += hdr + len;
  }
  return { frames, remaining: buffer.subarray(offset), error: null };
}

// ---------------------------------------------------------------- serveur

const server = http.createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (path === '/health' || path === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok', service: 'meshora-relay', mode: 'test' }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

function reject(socket, status, text) {
  try {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  } catch {}
  socket.destroy();
}

server.on('upgrade', (req, socket, head) => {
  const reqUrl = new URL(req.url || '/', 'http://relay.invalid');
  const upgrade = String(req.headers['upgrade'] || '').toLowerCase();
  const key = req.headers['sec-websocket-key'];
  if (upgrade !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') return reject(socket, 400, 'Bad Request');
  if (!originAllowed(req.headers['origin'])) return reject(socket, 403, 'Forbidden');

  const room = reqUrl.searchParams.get('room') || 'public_meshora';
  if (!ROOM_RE.test(room)) return reject(socket, 400, 'Bad Request');
  if (clients.size >= LIMITS.maxClients) return reject(socket, 503, 'Service Unavailable');
  const inRoom = [...clients.values()].filter((c) => c.room === room).length;
  const rooms = new Set([...clients.values()].map((c) => c.room));
  if (inRoom >= LIMITS.maxClientsPerRoom || (!rooms.has(room) && rooms.size >= LIMITS.maxRooms)) {
    return reject(socket, 503, 'Service Unavailable');
  }

  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`].join('\r\n') +
      '\r\n\r\n'
  );
  socket.setNoDelay(true);

  const client = {
    id: 'client_' + crypto.randomBytes(6).toString('hex'),
    socket,
    room,
    nonce: crypto.randomBytes(16).toString('hex'),
    authenticated: false,
    peerId: null,
    peerAlias: null,
    publicKey: null,
    closed: false,
    windowStart: Date.now(),
    windowCount: 0,
    alive: true,
    helloTimer: null
  };
  clients.set(client.id, client);
  client.helloTimer = setTimeout(() => {
    if (!client.authenticated) closeWith(client, 1008, 'hello timeout');
  }, LIMITS.helloTimeoutMs);
  client.helloTimer.unref?.();

  // Défi d'authentification : le client doit signer ce nonce avec sa clé d'identité.
  sendJson(client, { type: 'MESHORA_CHALLENGE', nonce: client.nonce, room });

  let buf = head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);
  socket.on('data', (chunk) => {
    if (client.closed) return;
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    if (buf.length > LIMITS.maxFrameBytes + 14) {
      // une trame partielle ne peut pas dépasser la taille maximale + en-tête
      const peek = parseWsFrames(buf);
      if (peek.error || peek.remaining.length > LIMITS.maxFrameBytes + 14) return closeWith(client, 1009, 'too big');
    }
    const { frames, remaining, error } = parseWsFrames(buf);
    buf = Buffer.from(remaining);
    for (const frame of frames) {
      if (client.closed) return;
      if (frame.opcode === 0x8) return closeWith(client, 1000, '');
      if (frame.opcode === 0x9) {
        try {
          socket.write(encodeWsFrame(frame.payload, 0xa));
        } catch {}
        continue;
      }
      if (frame.opcode === 0xa) {
        client.alive = true;
        continue;
      }
      if (frame.opcode !== 0x1) return closeWith(client, 1003, 'text only');

      const now = Date.now();
      if (now - client.windowStart > LIMITS.windowMs) {
        client.windowStart = now;
        client.windowCount = 0;
      }
      if (++client.windowCount > LIMITS.msgsPerWindow) return closeWith(client, 1008, 'rate limit');

      let data;
      try {
        data = JSON.parse(frame.payload.toString('utf8'));
      } catch {
        continue;
      }
      handleClientMessage(client, data);
    }
    if (error) closeWith(client, error.code, error.reason);
  });

  socket.on('close', () => dropClient(client));
  socket.on('error', () => {
    try {
      socket.destroy();
    } catch {}
    dropClient(client);
  });
});

// Détection des connexions mortes
const pinger = setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) {
      closeWith(c, 1001, 'timeout');
      continue;
    }
    c.alive = false;
    try {
      c.socket.write(encodeWsFrame(Buffer.alloc(0), 0x9));
    } catch {}
  }
  purgeMailboxes();
}, LIMITS.pingIntervalMs);
pinger.unref();

function purgeMailboxes() {
  const limit = Date.now() - LIMITS.mailboxTtlMs;
  for (const [room, box] of offlineMailboxes) {
    for (const [k, list] of box) {
      const kept = list.filter((e) => e.at >= limit);
      if (kept.length) box.set(k, kept);
      else box.delete(k);
    }
    if (box.size === 0) offlineMailboxes.delete(room);
  }
}

function mailboxCount(box) {
  let n = 0;
  for (const list of box.values()) n += list.length;
  return n;
}

// ---------------------------------------------------------------- protocole

function handleClientMessage(client, msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'MESHORA_HELLO') {
    const pub = typeof msg.publicKey === 'string' ? msg.publicKey : '';
    const id = typeof msg.senderId === 'string' ? msg.senderId : '';
    const sig = typeof msg.helloSignature === 'string' ? msg.helloSignature : '';
    const payload = `MESHORA-HELLO|v1|${client.room}|${client.nonce}|${pub}`;
    if (!pub || id !== deriveId(pub) || !verifyEcdsa(pub, sig, payload)) {
      return closeWith(client, 1008, 'hello rejected');
    }
    // Une même clé ne garde qu'une connexion par salon : la plus récente (authentifiée) gagne.
    for (const other of clients.values()) {
      if (other !== client && other.authenticated && other.room === client.room && other.publicKey === pub) {
        closeWith(other, 1000, 'replaced');
      }
    }
    client.authenticated = true;
    clearTimeout(client.helloTimer);
    client.peerId = id;
    client.peerAlias = typeof msg.senderAlias === 'string' ? msg.senderAlias.slice(0, 64) : null;
    client.publicKey = pub;
    broadcastPeerList(client.room);

    // Boîte aux lettres : remise uniquement au détenteur PROUVÉ de la clé destinataire.
    const box = offlineMailboxes.get(client.room);
    const pending = box && box.get(pub);
    if (pending && pending.length) {
      for (const e of pending) sendJson(client, e.packet);
      box.delete(pub);
    }
    return;
  }

  // Tout le reste exige une connexion authentifiée.
  if (!client.authenticated) return;

  switch (msg.type) {
    case 'MESHORA_ENVELOPE': {
      const env = msg.envelope;
      if (!env || typeof env !== 'object') return;
      if (env.senderPublicKeyHex !== client.publicKey) return; // expéditeur déclaré ≠ clé authentifiée
      const recipientKey = env.recipientPublicKeyHex;
      if (typeof recipientKey !== 'string' || !HEX_RE.test(recipientKey)) return;
      const packet = { type: 'MESHORA_ENVELOPE', envelope: env, room: client.room };

      let delivered = false;
      for (const target of clients.values()) {
        if (target.authenticated && target.room === client.room && target.id !== client.id && target.publicKey === recipientKey) {
          delivered = sendJson(target, packet) || delivered;
        }
      }
      if (!delivered) {
        if (!offlineMailboxes.has(client.room)) offlineMailboxes.set(client.room, new Map());
        const box = offlineMailboxes.get(client.room);
        if (mailboxCount(box) >= LIMITS.mailboxPerRoom) return;
        const list = box.get(recipientKey) || [];
        if (list.length < LIMITS.mailboxPerRecipient) {
          list.push({ packet, at: Date.now() });
          box.set(recipientKey, list);
        }
      }
      return;
    }

    case 'MESHORA_ACK': {
      const ack = msg.ack;
      if (!ack || typeof ack !== 'object' || !ack.signedAck) return;
      // L'ACK doit être signé par la clé authentifiée de la connexion émettrice.
      if (ack.signedAck.recipientPublicKeyHex !== client.publicKey) return;
      const packet = { type: 'MESHORA_ACK', ack };
      for (const target of clients.values()) {
        if (target.authenticated && target.room === client.room && target.id !== client.id) sendJson(target, packet);
      }
      return;
    }

    default:
      // MESHORA_MSG (clair) et types inconnus : refusés.
      return;
  }
}

function broadcastPeerList(room) {
  const roomClients = [...clients.values()].filter((c) => c.room === room && c.authenticated && !c.closed);
  const peers = roomClients.map((c) => ({
    id: c.peerId,
    alias: c.peerAlias || 'Pair-Meshora',
    publicKey: c.publicKey,
    transport: 'websocket',
    hops: 1,
    lastSeen: Date.now(),
    isGateway: false,
    verified: false // clé prouvée auprès du relais, mais non vérifiée hors bande par l'utilisateur
  }));
  const frame = encodeWsFrame(JSON.stringify({ type: 'MESHORA_PEERS', peers }));
  for (const c of roomClients) {
    try {
      c.socket.write(frame);
    } catch {}
  }
}

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[MESHORA RELAY — TEST] Écoute sur http://${HOST}:${PORT} (WebSocket ws://${HOST}:${PORT})`);
    console.log(`[MESHORA RELAY — TEST] Origines autorisées : ${ALLOWED_ORIGINS.join(', ')}`);
  });
} else if (process.env.PORT && process.env.MESHORA_RELAY_AUTOSTART !== '0') {
  // Compatibilité avec les tests d'intégration qui importent le module après avoir fixé PORT.
  server.listen(PORT, HOST);
}

module.exports = { server, clients, offlineMailboxes, deriveId, verifyEcdsa, originAllowed, LIMITS };
