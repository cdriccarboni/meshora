/**
 * MESHORA — Résilience du relais de référence avec le VRAI code web (tools/audit/app-client.ts).
 *  R1  échange et « Délivré » de référence ;
 *  R2  redémarrage du relais (redéploiement du Worker de PRÉPRODUCTION) : reconnexion automatique, puis échange ;
 *  R3  destinataire absent ~3 min (le salon hiberne) : message remis à son retour, puis « Délivré » ;
 *  R4  aucun doublon chez le destinataire malgré les renvois de l'Outbox.
 * Usage (depuis prototype/) : RELAY=wss://meshora-relay-preprod… REDEPLOY_CMD="cd ../relay/cloudflare && npx wrangler@4 deploy --env=''" npx tsx ../tools/audit/relay-resilience.ts
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fork, ChildProcess } from 'node:child_process';

const RELAY = process.env.RELAY!;
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOM = 'res' + crypto.randomBytes(4).toString('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: boolean[] = [];
const rec = (ok: boolean, id: string, label: string, ev: string) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${id} — ${label}\n   ${ev}`); };

type Client = { proc: ChildProcess; call: (cmd: any) => Promise<any> };
async function appClient(): Promise<Client> {
  const proc = fork(path.join(HERE, 'app-client.ts'), [], {
    execArgv: ['--import', 'tsx'], cwd: path.resolve(HERE, '../../prototype'),
    env: { ...process.env, RELAY, ROOM }, stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  });
  let seq = 0; const pending = new Map<number, (v: any) => void>();
  await new Promise<void>((res) => proc.on('message', (m: any) => { if (m.ready) res(); else if (pending.has(m.rid)) { pending.get(m.rid)!(m); pending.delete(m.rid); } }));
  const call = (cmd: any) => new Promise<any>((res) => { const rid = ++seq; pending.set(rid, res); proc.send({ ...cmd, rid }); }).then((m: any) => { if (!m.ok) throw new Error(m.error); return m.data; });
  return { proc, call };
}
async function until(f: () => Promise<boolean>, ms: number) { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(500); } return false; }
async function exchange(A: Client, B: Client, tag: string, ms = 30000) {
  const secret = tag + '-' + crypto.randomBytes(3).toString('hex');
  const { id } = await A.call({ cmd: 'send', text: secret });
  const got = await until(async () => (await B.call({ cmd: 'received' })).some((m: any) => m.content === secret), ms);
  const del = await until(async () => (await A.call({ cmd: 'status', id })) === 'delivered', ms);
  return { got, del, secret };
}

(async () => {
  console.log(`Relais : ${RELAY} ; salon ${ROOM}\n`);
  const A = await appClient(); let B = await appClient(); await sleep(3000);
  const r1 = await exchange(A, B, 'R1');
  rec(r1.got && r1.del, 'R1', 'Échange de référence', `reçu=${r1.got} ; délivré=${r1.del}`);

  const t0 = Date.now();
  try { execSync(process.env.REDEPLOY_CMD!, { stdio: 'ignore', shell: '/bin/bash' }); } catch (e) { console.log('redéploiement : ' + e); }
  const tDeploy = Math.round((Date.now() - t0) / 1000);
  await sleep(8000);
  const r2 = await exchange(A, B, 'R2', 60000);
  rec(r2.got && r2.del, 'R2', 'Après redémarrage du relais (redéploiement) : reconnexion automatique et échange', `redéploiement ${tDeploy} s ; reçu=${r2.got} ; délivré=${r2.del}`);

  B.proc.kill(); await sleep(2000);
  const secret3 = 'R3-' + crypto.randomBytes(3).toString('hex');
  const { id: id3 } = await A.call({ cmd: 'send', text: secret3 });
  await sleep(180_000); // ~3 min sans destinataire : le salon peut hiberner
  B = await appClient();
  const got3 = await until(async () => (await B.call({ cmd: 'received' })).some((m: any) => m.content === secret3), 60000);
  const del3 = await until(async () => (await A.call({ cmd: 'status', id: id3 })) === 'delivered', 60000);
  rec(got3 && del3, 'R3', 'Destinataire absent 3 min : message remis à son retour, puis « Délivré »', `reçu=${got3} ; délivré=${del3}`);

  await sleep(20000); // laisser passer des renvois éventuels de l'Outbox
  const copies = (await B.call({ cmd: 'received' })).filter((m: any) => m.content === secret3).length;
  rec(copies === 1, 'R4', 'Aucun doublon chez le destinataire', `exemplaires reçus=${copies}`);

  A.proc.kill(); B.proc.kill();
  const fails = results.filter((x) => !x).length;
  console.log(`\nRÉSULTAT : ${results.length - fails}/${results.length} vérifications réussies`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
