/**
 * MESHORA — Contre-audit V0.2 : scénarios navigateur réels (Chrome) sur le site construit (dist/).
 * B1 deux onglets du même navigateur ; B2 deux navigateurs indépendants (deux instances, profils séparés) via le relais ;
 * B3 nettoyage utm_* ; B4 consentement au relais proposé par lien ; B5 bouton 112 (taille, position, accessibilité),
 * captures mobile et ordinateur.
 * Prérequis : `python3 scripts/build_site.py` (dist/), playwright-core et Google Chrome installés.
 * Usage : node tools/audit/browser.mjs   (depuis la racine du dépôt ; NODE_PATH vers playwright-core si besoin)
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require_ = createRequire(path.join(process.cwd(), 'noop.js'));
const { chromium } = require_('playwright-core');
const ROOT = process.cwd();
const SHOTS = path.join(ROOT, 'docs/tests/captures-v0.2');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (id, title, pass, evidence) => {
  results.push({ id, title, pass, evidence });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${id} — ${title}\n         ${evidence}`);
};

const web = spawn('python3', ['-m', 'http.server', '8810', '--bind', '127.0.0.1', '--directory', 'dist'], { stdio: 'ignore' });
const relay = spawn(process.execPath, ['tools/relay/server.js'], { env: { ...process.env, PORT: '8787', HOST: '127.0.0.1' }, stdio: 'ignore' });
await sleep(1200);
const BASE = 'http://127.0.0.1:8810';
const APP = `${BASE}/app/`;

async function openMessages(page) {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('nav').getByRole('button', { name: /Messages/ }).click();
  await page.getByPlaceholder(/Écrivez un message|Write a message/).waitFor();
}
async function send(page, text) {
  const input = page.getByPlaceholder(/Écrivez un message|Write a message/);
  await input.fill(text);
  await input.press('Enter');
}
const bodyHas = (page, text) => page.evaluate((t) => document.body.innerText.includes(t), text);

try {
  // B1 — deux onglets du même navigateur
  {
    const b = await chromium.launch({ channel: 'chrome', headless: true });
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const A = await ctx.newPage(); const B = await ctx.newPage();
    await openMessages(A); await openMessages(B); await sleep(1500);
    const msg = 'B1-' + Date.now();
    await send(A, msg); await sleep(2500);
    const got = await bodyHas(B, msg);
    record('B1', 'Deux onglets du même navigateur : le message apparaît dans l’autre onglet', got, `reçu dans l'onglet B=${got}`);
    await b.close();
  }

  // B2 — deux navigateurs indépendants (processus et profils distincts) : seul le relais les relie
  {
    const b1 = await chromium.launch({ channel: 'chrome', headless: true });
    const b2 = await chromium.launch({ channel: 'chrome', headless: true });
    const A = await (await b1.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const B = await (await b2.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
    await openMessages(A); await openMessages(B); await sleep(2500);
    const msg = 'B2-' + Date.now();
    await send(A, msg); await sleep(4000);
    const got = await bodyHas(B, msg);
    const delivered = await A.evaluate((t) => {
      const el = [...document.querySelectorAll('div')].reverse().find((d) => d.innerText && d.innerText.includes(t) && d.innerText.includes('Délivré'));
      return !!el;
    }, msg);
    const reply = 'B2-retour-' + Date.now();
    await send(B, reply); await sleep(4000);
    const back = await bodyHas(A, reply);
    await A.screenshot({ path: path.join(SHOTS, 'b2-navigateur-A-desktop.png') });
    await B.screenshot({ path: path.join(SHOTS, 'b2-navigateur-B-mobile.png') });
    record('B2', 'Deux navigateurs indépendants via le relais de test : réception, accusé, réponse',
      got && delivered && back, `A→B reçu=${got} ; « Délivré » chez A=${delivered} ; B→A reçu=${back}`);
    await b1.close(); await b2.close();
  }

  // B3/B4/B5 — adresse, consentement, bouton 112
  {
    const b = await chromium.launch({ channel: 'chrome', headless: true });
    // B3
    {
      const p = await (await b.newContext()).newPage();
      await p.goto(`${APP}?utm_source=news&utm_medium=mail&room=atelier&fbclid=x#messages`, { waitUntil: 'networkidle' });
      const href = await p.evaluate(() => location.href);
      record('B3', 'Paramètres utm_*/fbclid retirés de l’adresse, paramètres fonctionnels conservés',
        href === `${APP}?room=atelier#messages`, `adresse affichée=${href}`);
      const s = await (await b.newContext()).newPage();
      await s.goto(`${BASE}/fr/decouvrir/?utm_campaign=z&x=1`, { waitUntil: 'networkidle' });
      const shref = await s.evaluate(() => location.href);
      record('B3b', 'Site : utm_* retirés, autres paramètres conservés', shref === `${BASE}/fr/decouvrir/?x=1`, `adresse affichée=${shref}`);
    }
    // B4
    {
      const ctx = await b.newContext();
      const p = await ctx.newPage();
      let dialogText = '';
      p.on('dialog', async (d) => { dialogText = d.message(); await d.dismiss(); });
      await p.goto(`${APP}?relay=${encodeURIComponent('wss://relais-inconnu.example/ws')}`, { waitUntil: 'networkidle' });
      await sleep(500);
      const stored = await p.evaluate(() => localStorage.getItem('meshora_relay_url'));
      record('B4', 'Relais proposé par un lien : accord demandé, refus respecté',
        dialogText.includes('relais-inconnu.example') && stored === null, `demande affichée=${!!dialogText} ; relais enregistré après refus=${stored}`);
    }
    // B5
    for (const vp of [{ name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }, { name: 'desktop', width: 1280, height: 800 }]) {
      const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
      const p = await ctx.newPage();
      await p.goto(APP, { waitUntil: 'networkidle' });
      await p.locator('nav').getByRole('button', { name: /Résilience/ }).click();
      const btn = p.getByTestId('emergency-112');
      await btn.waitFor();
      const bb = await btn.boundingBox();
      const nb = await p.locator('nav').boundingBox();
      const style = await btn.evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundImage, shadow: c.boxShadow, anim: c.animationName, label: el.getAttribute('aria-label') }; });
      const sizeOk = bb.width >= 36 && bb.width <= 40 && bb.height >= 36 && bb.height <= 40;
      const aboveNav = bb.y + bb.height <= nb.y - 4;
      const rightSide = bb.x + bb.width >= vp.width - 32;
      await p.screenshot({ path: path.join(SHOTS, `b5-112-${vp.name}.png`) });
      await btn.focus(); await p.keyboard.press('Enter');
      const dlg = p.getByRole('dialog');
      await dlg.waitFor();
      const dlgName = await dlg.getAttribute('aria-labelledby');
      const telLinks = await dlg.locator('a[href^="tel:112"]').count();
      await p.screenshot({ path: path.join(SHOTS, `b5-112-fenetre-${vp.name}.png`) });
      await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
      const focusInside = await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      await p.keyboard.press('Escape'); await sleep(150);
      const closed = (await p.getByRole('dialog').count()) === 0;
      const focusBack = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'emergency-112');
      const pass = sizeOk && aboveNav && rightSide && style.bg === 'none' && style.anim === 'none' && !!style.label && !!dlgName && telLinks === 1 && focusInside && closed && focusBack;
      record(`B5-${vp.name}`, `Bouton 112 (${vp.name}) : 36–40 px, au-dessus de la navigation, sobre, fenêtre accessible`, pass,
        `taille=${Math.round(bb.width)}×${Math.round(bb.height)} ; bas du bouton=${Math.round(bb.y + bb.height)} / haut de la nav=${Math.round(nb.y)} ; dégradé=${style.bg !== 'none'} ; animation=${style.anim} ; ombre=${style.shadow.slice(0, 40)} ; aria-label=${style.label} ; dialog nommé=${!!dlgName} ; lien tel:112=${telLinks} ; focus piégé=${focusInside} ; Échap ferme=${closed} ; focus rendu=${focusBack}`);
      await ctx.close();
    }
    await b.close();
  }
} catch (e) {
  console.error(e);
  record('ERR', 'Exception pendant les scénarios navigateur', false, String(e).slice(0, 300));
} finally {
  web.kill(); relay.kill();
}
const fails = results.filter((r) => !r.pass).length;
console.log(`\nRÉSULTAT : ${results.length - fails}/${results.length} scénarios navigateur réussis.`);
console.log('JSON:' + JSON.stringify(results));
process.exit(0);
