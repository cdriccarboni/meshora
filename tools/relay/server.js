#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * MESHORA — Relais WebSocket Standalone Sans Dépendance Externe
 * 
 * Conforme aux règles d'audit :
 * - Zéro dépendance npm requise (utilise uniquement node:http et node:crypto standard)
 * - Support des salons (rooms) via ?room=
 * - Routage des enveloppes chiffrées de bout en bout (E2EE)
 * - Zéro stockage ou inspection de texte en clair (relais aveugle)
 * - File d'attente (mailbox) pour clients temporairement déconnectés
 * - Accusés de réception (ACK) signés acheminés en retour
 */

const http = require('http');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8787;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// Salons -> Set de clients connectés
// clientId -> { socket, room, peerId, peerAlias, publicKey }
const clients = new Map();
// room -> Map(recipientPublicKey -> Array<envelope>)
const offlineMailboxes = new Map();

// Helper framing WebSocket RFC6455
function encodeWsFrame(data, isBinary = false) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const length = payload.length;

  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = (isBinary ? 0x82 : 0x81);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = (isBinary ? 0x82 : 0x81);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = (isBinary ? 0x82 : 0x81);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

function parseWsFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];

    const fin = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLen = secondByte & 0x7f;

    let headerSize = 2;
    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerSize = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset + 2));
      headerSize = 10;
    }

    let mask = null;
    if (isMasked) {
      if (offset + headerSize + 4 > buffer.length) break;
      mask = buffer.slice(offset + headerSize, offset + headerSize + 4);
      headerSize += 4;
    }

    if (offset + headerSize + payloadLen > buffer.length) break;

    const rawPayload = buffer.slice(offset + headerSize, offset + headerSize + payloadLen);
    let payload = rawPayload;

    if (isMasked && mask) {
      payload = Buffer.alloc(payloadLen);
      for (let i = 0; i < payloadLen; i++) {
        payload[i] = rawPayload[i] ^ mask[i % 4];
      }
    }

    frames.push({ opcode, fin, payload });
    offset += headerSize + payloadLen;
  }

  const remaining = buffer.slice(offset);
  return { frames, remaining };
}

// Serveur HTTP pour le handshake et le contrôle de santé
const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (reqUrl.pathname === '/health' || reqUrl.pathname === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'meshora-relay',
      activeClients: clients.size,
      roomsCount: new Set([...clients.values()].map(c => c.room)).size,
      timestamp: Date.now()
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.on('upgrade', (req, socket, head) => {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const upgrade = req.headers['upgrade'];

  if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  // Handshake SHA-1
  const accept = crypto
    .createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`
  ];

  socket.write(headers.join('\r\n') + '\r\n\r\n');

  const clientId = 'client_' + crypto.randomBytes(6).toString('hex');
  const room = (reqUrl.searchParams.get('room') || 'public_meshora').toString();

  const clientInfo = {
    id: clientId,
    socket,
    room,
    peerId: null,
    peerAlias: null,
    publicKey: null
  };

  clients.set(clientId, clientInfo);

  let recvBuffer = head && head.length > 0 ? head : Buffer.alloc(0);

  socket.on('data', (chunk) => {
    recvBuffer = Buffer.concat([recvBuffer, chunk]);
    const { frames, remaining } = parseWsFrames(recvBuffer);
    recvBuffer = remaining;

    for (const frame of frames) {
      if (frame.opcode === 0x08) {
        // Close frame
        clients.delete(clientId);
        broadcastPeerList(room);
        socket.end(encodeWsFrame(Buffer.alloc(0), false));
        return;
      }

      if (frame.opcode === 0x09) {
        // Ping -> Pong
        socket.write(encodeWsFrame(frame.payload, false));
        continue;
      }

      if (frame.opcode === 0x01) {
        // Text message
        try {
          const text = frame.payload.toString('utf8');
          const data = JSON.parse(text);
          handleClientMessage(clientInfo, data);
        } catch (err) {
          // Message invalide ignoré
        }
      }
    }
  });

  socket.on('close', () => {
    clients.delete(clientId);
    broadcastPeerList(room);
  });

  socket.on('error', () => {
    socket.destroy();
    clients.delete(clientId);
  });
});

function handleClientMessage(client, msg) {
  if (!msg || typeof msg !== 'object') return;

  switch (msg.type) {
    case 'MESHORA_HELLO': {
      client.peerId = msg.senderId;
      client.peerAlias = msg.senderAlias;
      client.publicKey = msg.publicKey || null;

      // Envoyer confirmation et liste des pairs du salon
      broadcastPeerList(client.room);

      // Vérifier et délivrer les messages en attente (mailbox) pour ce client
      if (client.publicKey && offlineMailboxes.has(client.room)) {
        const roomBox = offlineMailboxes.get(client.room);
        const pending = roomBox.get(client.publicKey) || [];
        if (pending.length > 0) {
          for (const envelope of pending) {
            client.socket.write(encodeWsFrame(JSON.stringify(envelope)));
          }
          roomBox.delete(client.publicKey);
        }
      }
      break;
    }

    case 'MESHORA_ENVELOPE': {
      const env = msg.envelope || msg;
      const recipientKey = env.recipientPublicKeyHex || msg.recipientPublicKeyHex;
      let delivered = false;

      // Trouver le ou les destinataires connectés et actifs dans le même salon
      for (const target of clients.values()) {
        if (target.room === client.room && target.id !== client.id && !target.socket.destroyed && target.socket.writable) {
          if (!recipientKey || target.publicKey === recipientKey || recipientKey === 'broadcast') {
            try {
              target.socket.write(encodeWsFrame(JSON.stringify(msg)));
              delivered = true;
            } catch {}
          }
        }
      }

      // Si destinataire spécifique déconnecté ou introuvable, mise en file d'attente (store-and-forward)
      if (!delivered && recipientKey && recipientKey !== 'broadcast') {
        if (!offlineMailboxes.has(client.room)) {
          offlineMailboxes.set(client.room, new Map());
        }
        const roomBox = offlineMailboxes.get(client.room);
        if (!roomBox.has(recipientKey)) {
          roomBox.set(recipientKey, []);
        }
        const list = roomBox.get(recipientKey);
        // Limite à 50 messages en attente par destinataire
        if (list.length < 50) {
          list.push(msg);
        }
      }
      break;
    }

    case 'MESHORA_ACK': {
      // Acheminement de l'accusé de réception signé au destinataire (expéditeur du message original)
      for (const target of clients.values()) {
        if (target.room === client.room && target.id !== client.id) {
          target.socket.write(encodeWsFrame(JSON.stringify(msg)));
        }
      }
      break;
    }

    case 'MESHORA_MSG': {
      // Message générique broadcasté dans le salon
      for (const target of clients.values()) {
        if (target.room === client.room && target.id !== client.id) {
          target.socket.write(encodeWsFrame(JSON.stringify(msg)));
        }
      }
      break;
    }
  }
}

function broadcastPeerList(room) {
  const roomClients = [...clients.values()].filter(c => c.room === room && c.peerId);
  const peers = roomClients.map(c => ({
    id: c.peerId,
    alias: c.peerAlias || 'Pair-Meshora',
    publicKey: c.publicKey,
    transport: 'websocket',
    hops: 1,
    lastSeen: Date.now(),
    isGateway: false,
    verified: !!c.publicKey
  }));

  const payload = JSON.stringify({
    type: 'MESHORA_PEERS',
    peers
  });

  const frame = encodeWsFrame(payload);
  for (const client of roomClients) {
    try {
      client.socket.write(frame);
    } catch {}
  }
}

if (require.main === module || !module.parent) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[MESHORA RELAY] Actif sur http://0.0.0.0:${PORT} (WebSocket ws://0.0.0.0:${PORT})`);
    console.log(`[MESHORA RELAY] Prêt pour communications entre appareils physiques ou navigateurs distincts.`);
  });
}

module.exports = { server, clients, offlineMailboxes };
