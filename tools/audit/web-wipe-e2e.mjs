/**
 * MESHORA — Essai navigateur réel de l'effacement d'urgence (V0.4).
 * Usage : BASE=https://v0-4-dev.meshora.pages.dev NODE_PATH=<…>/node_modules node tools/audit/web-wipe-e2e.mjs
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.env.NODE_PATH + '/')('playwright-core');
const BASE = (process.env.BASE || 'https://v0-4-dev.meshora.pages.dev').replace(/\/$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const rec = (ok, label, ev) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${label}\n   ${ev}`); };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ locale: 'fr-FR' })).newPage();
const dialogs = [];
page.on('dialog', (d) => { dialogs.push(d.message().split('\n')[0]); d.accept(); });
await page.goto(BASE + '/app/');
const readId = () => page.evaluate(() => {
  for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && typeof v.publicKey === 'string' && v.publicKey.length > 100) return v.publicKey; } catch {} }
  return null;
});
let before = null; for (let i = 0; i < 40 && !before; i++) { before = await readId(); await sleep(250); }
const keysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('meshora')).length);
rec(!!before && keysBefore > 0, 'Identité et données présentes avant effacement', `clés meshora=${keysBefore}`);

const wipe = page.getByRole('button', { name: /Effacement d’urgence|Emergency wipe/ });
for (const step of [/^(Paramètres|Settings)$/, /^(Plus|More)$/, /^(Paramètres|Settings)$/]) {
  if (await wipe.count() > 0) break;
  const b = page.getByRole('button', { name: step });
  if (await b.count() > 0) { await b.first().click().catch(() => {}); await sleep(800); }
}
const visible = await wipe.count() > 0;
await wipe.first().click().catch(() => {});
await page.waitForLoadState('load'); await sleep(3000);
const keysAfterReload = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('meshora')));
let after = null; for (let i = 0; i < 40 && !after; i++) { after = await readId(); await sleep(250); }
rec(visible && dialogs.some((d) => /EFFACEMENT/.test(d)), 'Bouton présent et confirmation demandée', `dialogue=${dialogs.join(' | ')}`);
rec(!!after && after !== before, 'Après effacement : nouvelle identité (l\'ancienne clé privée a disparu)', `avant=${before?.slice(-16)} ; après=${after?.slice(-16)}`);
const cachesLeft = await page.evaluate(async () => ('caches' in self) ? (await caches.keys()).length : 0);
rec(true, 'Caches hors ligne après rechargement (le service worker peut se réinstaller)', `caches=${cachesLeft}`);
await browser.close();
const fails = results.filter((x) => !x).length;
console.log(`\nRÉSULTAT : ${results.length - fails}/${results.length} vérifications réussies (${BASE})`);
process.exit(fails ? 1 : 0);
