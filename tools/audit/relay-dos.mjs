/**
 * MESHORA — Contre-audit : le relais limite-t-il la taille des trames ? (déni de service mémoire)
 * Lance tools/relay/server.js dans un processus séparé, annonce une trame de 1 Gio et envoie 96 Mio,
 * puis mesure la mémoire résidente (RSS) du relais. PASS = connexion coupée ou mémoire stable.
 * Usage : node tools/audit/relay-dos.mjs
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PORT = 18000 + Math.floor(Math.random() * 1000);
const relay = spawn(process.execPath, [path.resolve(HERE, '../relay/server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rssMiB = () => Math.round(Number(execSync(`ps -o rss= -p ${relay.pid}`).toString().trim()) / 1024);

await sleep(800);
const before = rssMiB();
const s = net.connect(PORT, '127.0.0.1');
let closedByServer = false;
s.on('close', () => (closedByServer = true));
s.on('error', () => {});
s.write(`GET /?room=dos HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
await sleep(200);
const hdr = Buffer.alloc(14); hdr[0] = 0x81; hdr[1] = 0x80 | 127; hdr.writeBigUInt64BE(1n << 30n, 2); crypto.randomBytes(4).copy(hdr, 10);
s.write(hdr);
const chunk = Buffer.alloc(1 << 20, 0x61);
let sent = 0;
for (let i = 0; i < 96 && !closedByServer; i++) { await new Promise((r) => s.write(chunk, r)); sent++; }
await sleep(1500);
const after = rssMiB();
const pass = closedByServer || after - before < 32;
console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  T10 — Le relais doit refuser une trame annoncée à 1 Gio`);
console.log(`         Mio envoyés=${sent} ; connexion coupée par le relais=${closedByServer} ; mémoire du relais : ${before} → ${after} Mio (+${after - before})`);
console.log('JSON:' + JSON.stringify([{ id: 'T10', title: 'Taille maximale de trame', pass, evidence: `+${after - before} Mio pour ${sent} Mio envoyés, coupure=${closedByServer}` }]));
s.destroy(); relay.kill();
