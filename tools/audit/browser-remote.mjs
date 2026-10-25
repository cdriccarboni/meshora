/**
 * MESHORA — Essai via la prévisualisation HTTPS et un relais WSS (tunnel Cloudflare).
 * Deux instances Chrome indépendantes (profils séparés) ouvrent la prévisualisation publique,
 * acceptent le relais de test, échangent dans les deux sens et vérifient « Délivré ».
 * Ce n'est PAS un essai entre appareils : les deux navigateurs tournent sur la même machine,
 * mais tout le trafic passe par Internet (Cloudflare Pages + tunnel) en HTTPS/WSS.
 * Usage : APP_URL=https://….meshora.pages.dev/app/ RELAY=wss://….trycloudflare.com node tools/audit/browser-remote.mjs
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require_ = createRequire(path.join(process.cwd(), 'noop.js'));
const { chromium } = require_('playwright-core');
const APP = process.env.APP_URL;
const RELAY = process.env.RELAY;
if (!APP || !RELAY) { console.error('APP_URL et RELAY requis'); process.exit(2); }
const ROOM = process.env.ROOM || 'essai-auto-' + Date.now().toString(36);
const URL_ = `${APP}?relay=${encodeURIComponent(`${RELAY}/?room=${ROOM}`)}&room=${ROOM}&utm_source=test`;
const SHOTS = path.join(process.cwd(), 'docs/tests/captures-v0.2');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (id, title, pass, evidence) => { results.push({ id, title, pass, evidence }); console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${id} — ${title}\n         ${evidence}`); };

async function open(browser, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const dialogs = [];
  const wsUrls = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
  page.on('websocket', (ws) => wsUrls.push(ws.url()));
  const csp = [];
  page.on('console', (m) => { if (/Content Security Policy|CSP/i.test(m.text())) csp.push(m.text()); });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.locator('nav').getByRole('button', { name: /Messages/ }).click();
  await page.getByPlaceholder(/Écrivez un message|Write a message/).waitFor();
  return { page, dialogs, wsUrls, csp };
}
async function send(page, text) {
  const input = page.getByPlaceholder(/Écrivez un message|Write a message/);
  await input.fill(text); await input.press('Enter');
}
const bodyHas = (page, t) => page.evaluate((x) => document.body.innerText.includes(x), t);
const deliveredFor = (page, t) => page.evaluate((x) => [...document.querySelectorAll('div')].reverse().some((d) => d.innerText && d.innerText.includes(x) && d.innerText.includes('Délivré')), t);
async function waitFor(fn, ms = 20000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(500); } return false; }

const b1 = await chromium.launch({ channel: 'chrome', headless: true });
const b2 = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const A = await open(b1, { viewport: { width: 1280, height: 800 } });
  const B = await open(b2, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const shown = await A.page.evaluate(() => location.href);
  record('R0', 'Prévisualisation HTTPS, relais WSS accepté, CSP respectée, utm retiré',
    A.dialogs.length === 1 && A.wsUrls.some((u) => u.startsWith(RELAY)) && A.csp.length === 0 && !shown.includes('utm_'),
    `accord demandé=${A.dialogs.length} ; WebSocket ouverte=${A.wsUrls.filter((u) => u.startsWith('wss://')).length > 0} ; erreurs CSP=${A.csp.length} ; utm dans l'adresse=${shown.includes('utm_')}`);
  await sleep(4000);
  const m1 = 'R1-' + Date.now();
  await send(A.page, m1);
  const got = await waitFor(() => bodyHas(B.page, m1));
  const del = await waitFor(() => deliveredFor(A.page, m1));
  const m2 = 'R1-retour-' + Date.now();
  await send(B.page, m2);
  const back = await waitFor(() => bodyHas(A.page, m2));
  const delBack = await waitFor(() => deliveredFor(B.page, m2));
  record('R1', 'Deux navigateurs indépendants via Pages (HTTPS) + tunnel (WSS)', got && del && back && delBack,
    `A→B reçu=${got} ; « Délivré » chez A=${del} ; B→A reçu=${back} ; « Délivré » chez B=${delBack}`);
  // Réception différée : B se déconnecte, A envoie, B revient
  await B.page.context().close();
  const m3 = 'R2-differe-' + Date.now();
  await send(A.page, m3); await sleep(3000);
  const st = await A.page.evaluate((x) => { const d = [...document.querySelectorAll('div')].reverse().find((e) => e.innerText && e.innerText.includes(x)); return d ? d.innerText.slice(0, 200) : ''; }, m3);
  record('R2a', 'Destinataire absent : le message n’est pas marqué « Délivré »', !st.includes('Délivré'), `état affiché chez A : ${JSON.stringify(st.replace(/\s+/g, ' ').slice(0, 120))}`);
  await A.page.screenshot({ path: path.join(SHOTS, 'r-previsualisation-A-desktop.png') });
} catch (e) {
  record('ERR', 'Exception', false, String(e).slice(0, 300));
} finally {
  await b1.close(); await b2.close();
}
const fails = results.filter((r) => !r.pass).length;
console.log(`\nRÉSULTAT : ${results.length - fails}/${results.length} — salon ${ROOM}`);
process.exit(0);
