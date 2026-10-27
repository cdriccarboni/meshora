/**
 * MESHORA — Essai de bout en bout : application Android (APK signé, émulateur) ↔ client web réel, via le relais de référence.
 *  A1  l'APK se connecte seul au relais ;
 *  A2  invitation PAR QR CODE : capture d'écran du téléphone → décodage (zbarimg) → le client web rejoint le groupe ;
 *  A3  web → Android : message reçu, discussion individuelle ouverte ;
 *  A4  Android → web : réponse saisie dans l'interface, reçue par le web, « Délivré » (accusé signé) côté Android ;
 *  B1  invitation PAR LIEN venant du web (meshora://join#…) : dialogue, « Rejoindre », changement de groupe ;
 *  B2  contact « vérifié » (clé reçue hors relais) et message reçu de lui.
 * Prérequis : émulateur démarré (adb), APK installé, zbarimg, python3 tools/audit/adb_ui.py.
 * Usage (depuis prototype/) : UI=/chemin/adb_ui.py RELAY=wss://… npx tsx ../tools/audit/e2e-android-emulator.ts
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, fork, ChildProcess } from 'node:child_process';

const RELAY = process.env.RELAY!;
const UI = process.env.UI || path.resolve(path.dirname(new URL(import.meta.url).pathname), 'adb_ui.py');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ui = (...args: string[]) => { try { return execSync(`python3 ${UI} ${args.map((a) => JSON.stringify(a)).join(' ')}`, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', LC_ALL: 'en_US.UTF-8' } }); } catch (e: any) { return String(e.stdout || ''); } };
const adb = (a: string) => execSync(`adb ${a}`, { encoding: 'utf8' });
const results: boolean[] = [];
const rec = (ok: boolean, id: string, label: string, ev: string) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${id} — ${label}\n   ${ev}`); };

type Client = { proc: ChildProcess; call: (cmd: any) => Promise<any> };
async function webClient(room: string): Promise<Client> {
  const proc = fork(path.join(HERE, 'app-client.ts'), [], { execArgv: ['--import', 'tsx'], cwd: path.resolve(HERE, '../../prototype'),
    env: { ...process.env, RELAY, ROOM: room }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let seq = 0; const pending = new Map<number, (v: any) => void>();
  await new Promise<void>((res) => proc.on('message', (m: any) => { if (m.ready) res(); else if (pending.has(m.rid)) { pending.get(m.rid)!(m); pending.delete(m.rid); } }));
  const call = (cmd: any) => new Promise<any>((res) => { const rid = ++seq; pending.set(rid, res); proc.send({ ...cmd, rid }); }).then((m: any) => { if (!m.ok) throw new Error(m.error); return m.data; });
  return { proc, call };
}
async function until(f: () => Promise<boolean> | boolean, ms: number) { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(1500); } return !!(await f()); }

(async () => {
  adb('shell am force-stop org.meshora.app');
  adb('shell am start -n org.meshora.app/.MainActivity');
  await sleep(4000);
  ui('tap', '^Allow \\|');
  ui('tap', '^Network \\||^Réseau \\|');
  const connected = ui('wait', 'Connected — identity proven|Connecté — identité prouvée', '45').includes('yes');
  const groupLine = ui('dump').match(/(?:Your group|Votre groupe) ?: (g[a-z0-9]+)/);
  rec(connected && !!groupLine, 'A1', 'Connexion automatique au relais de référence', `connecté=${connected} ; groupe=${groupLine?.[1]}`);

  // A2 — QR code
  ui('tap', '^Contacts \\|'); await sleep(1500);
  ui('tap', 'Invite someone|Inviter un proche'); await sleep(2500);
  execSync('adb exec-out screencap -p > /tmp/emu-tools/invite-qr.png');
  let link = '';
  try { link = execSync('zbarimg -q --raw /tmp/emu-tools/invite-qr.png', { encoding: 'utf8' }).trim(); } catch {}
  const m = link.match(/#join=([A-Za-z0-9_-]+)&k=([0-9a-f]+)/);
  rec(!!m && m[1] === groupLine?.[1], 'A2', 'QR code d\'invitation lisible par un appareil photo, groupe correct', `lien=${link.slice(0, 70)}…`);
  const room = m?.[1] || groupLine?.[1] || 'x';
  const androidKey = m?.[2] || '';

  ui('tap', 'Invite someone|Inviter un proche'); await sleep(1000); // replie la carte d'invitation
  const W = await webClient(room);
  const webId = await W.call({ cmd: 'identity' });
  const webName = webId.alias as string;
  const seen = await until(() => ui('dump').includes(webName), 40);
  rec(seen, 'A2b', 'Le client web apparaît dans « Connectés maintenant » du téléphone', `nom web=${webName}`);

  // A3 — web → Android
  const s1 = 'Bonjour-' + crypto.randomBytes(2).toString('hex');
  await W.call({ cmd: 'send', text: s1 });
  ui('tap', '^Chats \\||^Discussions \\|');
  const inList = await until(() => ui('dump').includes(s1), 40);
  ui('tap', s1); await sleep(2000);
  const inThread = ui('dump');
  rec(inList && inThread.includes(s1) && inThread.includes(webName), 'A3', 'Web → Android : reçu, discussion individuelle avec le bon interlocuteur', `dans la liste=${inList} ; fil ouvert=${inThread.includes(s1)}`);

  // A4 — Android → web
  const s2 = 'Reponse-' + crypto.randomBytes(2).toString('hex');
  ui('tap', 'End-to-end encrypted message|Message chiffré de bout en bout'); ui('text', s2); await sleep(500);
  ui('tap', '\\| (Send|Envoyer)$');
  const webGot = await until(async () => (await W.call({ cmd: 'received' })).some((x: any) => x.content === s2), 40);
  const delivered = await until(() => /Delivered \(signed receipt\)|Délivré \(accusé signé\)/.test(ui('dump')), 40);
  execSync('adb exec-out screencap -p > /tmp/emu-tools/chat-delivered.png');
  adb('shell input keyevent 111'); await sleep(800); // ferme le clavier (sinon il recouvre la barre d'onglets)
  rec(webGot && delivered, 'A4', 'Android → web : reçu par le web, « Délivré » sur le téléphone (accusé signé)', `reçu web=${webGot} ; délivré=${delivered}`);
  W.proc.kill();
  // A5 — après déconnexion du web, la discussion garde son nom (non-régression du 27/10)
  ui('tap', '\\| Back$'); await sleep(1500);
  const offlineName = await until(() => { const d = ui('dump'); return d.includes(webName) && d.includes(s2); }, 30);
  rec(offlineName, 'A5', 'Interlocuteur déconnecté : son nom reste affiché dans les discussions', `nom=${webName} présent=${offlineName}`);

  // B1 — invitation venant du web
  const room2 = 'g' + crypto.randomBytes(6).toString('hex').slice(0, 12);
  const W2 = await webClient(room2);
  const id2 = await W2.call({ cmd: 'identity' });
  const invite = `meshora://join#join=${room2}&k=${id2.publicKey}&n=${encodeURIComponent('Web-B')}`;
  adb(`shell "am start -a android.intent.action.VIEW -d '${invite}' org.meshora.app"`);
  const dialog = ui('wait', 'Invitation from Web-B|Invitation de Web-B', '20').includes('yes');
  ui('tap', '^(Join|Rejoindre) \\|'); await sleep(3000);
  ui('tap', '^Network \\||^Réseau \\|');
  const switched = await until(() => ui('dump').includes(room2), 40);
  rec(dialog && switched, 'B1', 'Lien d\'invitation : dialogue, « Rejoindre », nouveau groupe', `dialogue=${dialog} ; groupe=${switched ? room2 : '?'}`);

  // B2 — contact vérifié + message
  await until(async () => (await W2.call({ cmd: 'peers' })).some((p: any) => p.publicKey === androidKey), 40);
  const s3 = 'Verifie-' + crypto.randomBytes(2).toString('hex');
  await W2.call({ cmd: 'send', text: s3 });
  ui('tap', '^Chats \\||^Discussions \\|');
  const got3 = await until(() => ui('dump').includes(s3), 40);
  ui('tap', s3); await sleep(1500);
  adb('shell input keyevent 111');
  const verified = /Verified|Vérifié/.test(ui('dump'));
  execSync('adb exec-out screencap -p > /tmp/emu-tools/verified-contact.png');
  rec(got3 && verified, 'B2', 'Contact invitant marqué « vérifié », message reçu', `reçu=${got3} ; vérifié=${verified}`);
  W2.proc.kill();

  const fails = results.filter((x) => !x).length;
  console.log(`\nRÉSULTAT : ${results.length - fails}/${results.length} vérifications réussies`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
