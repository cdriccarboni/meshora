/**
 * MESHORA — Essai navigateur réel : connexion automatique au relais de référence et invitation (V0.3).
 * Deux navigateurs indépendants (Chrome) ouvrent l'application web déployée :
 *  A se connecte seul (aucune saisie) ; B ouvre le lien d'invitation de A, accepte ;
 *  chacun voit l'autre dans la liste des pairs AUTHENTIFIÉS du relais (même groupe).
 * Usage : BASE=https://v0-3.meshora.pages.dev NODE_PATH=/tmp/pw/node_modules node tools/audit/web-invite-e2e.mjs
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.env.NODE_PATH + '/')('playwright-core');
const BASE = (process.env.BASE || 'https://v0-3.meshora.pages.dev').replace(/\/$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watch(page, log) {
  const state = { wsUrl: null, peers: [], challenge: false, cspErrors: [] };
  page.on('websocket', (ws) => {
    state.wsUrl = ws.url();
    ws.on('framereceived', (f) => {
      try {
        const p = JSON.parse(String(f.payload));
        if (p.type === 'MESHORA_CHALLENGE') state.challenge = true;
        if (p.type === 'MESHORA_PEERS') state.peers = p.peers.map((x) => x.publicKey);
      } catch {}
    });
  });
  page.on('console', (m) => { if (/Content Security Policy|CSP/i.test(m.text())) state.cspErrors.push(m.text()); });
  page.on('dialog', (d) => { log.push(`dialogue : ${d.message().split('\n')[0]}`); d.accept(); });
  return state;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const rec = (ok, label, ev) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${label}\n   ${ev}`); };
  const logA = [], logB = [];
  const A = await (await browser.newContext({ locale: 'fr-FR' })).newPage();
  const sA = watch(A, logA);
  await A.goto(BASE + '/app/');
  for (let i = 0; i < 60 && sA.peers.length === 0; i++) await sleep(500);
  const info = await A.evaluate(() => {
    const room = localStorage.getItem('meshora_room');
    const keys = Object.keys(localStorage);
    let pub = null, alias = null;
    for (const k of keys) {
      try { const v = JSON.parse(localStorage.getItem(k)); if (v && typeof v.publicKey === 'string' && v.publicKey.length > 100) { pub = v.publicKey; alias = v.alias; } } catch {}
    }
    return { room, pub, alias };
  });
  rec(!!sA.wsUrl && sA.wsUrl.startsWith('wss://meshora-relay-preprod.') && sA.challenge && sA.peers.includes(info.pub) && sA.cspErrors.length === 0,
    'A : connexion automatique au relais de référence, identité prouvée, aucune erreur CSP',
    `ws=${sA.wsUrl} ; défi=${sA.challenge} ; A dans la liste=${sA.peers.includes(info.pub)} ; groupe=${info.room} ; CSP=${sA.cspErrors.length}`);
  rec(/^g[a-z2-9]{12}$/.test(info.room || ''), 'A : groupe privé aléatoire (pas de salon public)', `groupe=${info.room}`);

  const link = `${BASE}/app/#join=${info.room}&k=${info.pub}&n=${encodeURIComponent(info.alias || 'A')}`;
  const B = await (await browser.newContext({ locale: 'fr-FR' })).newPage();
  const sB = watch(B, logB);
  await B.goto(link);
  for (let i = 0; i < 60 && !(sB.peers.includes(info.pub)); i++) await sleep(500);
  const bInfo = await B.evaluate(() => ({ room: localStorage.getItem('meshora_room'), url: location.href, contacts: localStorage.getItem('meshora_contacts') }));
  for (let i = 0; i < 20 && sA.peers.length < 2; i++) await sleep(500);
  rec(sB.peers.includes(info.pub) && sA.peers.length === 2 && bInfo.room === info.room,
    'B : invitation acceptée → même groupe, A et B se voient (pairs authentifiés)',
    `B voit A=${sB.peers.includes(info.pub)} ; A voit ${sA.peers.length} pair(s) ; groupe B=${bInfo.room} ; ${logB.join(' | ')}`);
  rec(!bInfo.url.includes('#') && bInfo.url.indexOf(info.pub) < 0, 'B : invitation retirée de la barre d\'adresse après lecture', `adresse=${bInfo.url}`);
  rec(!!bInfo.contacts && bInfo.contacts.includes(info.pub) && bInfo.contacts.includes('"verified":true'), 'B : A enregistré comme contact vérifié', `contacts=${(bInfo.contacts || '').slice(0, 80)}…`);

  await browser.close();
  const fails = results.filter((x) => !x).length;
  console.log(`\nRÉSULTAT : ${results.length - fails}/${results.length} vérifications réussies (${BASE})`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
