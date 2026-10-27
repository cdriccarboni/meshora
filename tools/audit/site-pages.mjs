/**
 * MESHORA — Vérification des pages publiques (Découvrir, Installer, Accueil, FR/EN) sur une prévisualisation :
 * rendu ordinateur et mobile, thème clair et sombre, débordement horizontal, variante du schéma affichée,
 * liens (internes et externes), accessibilité (axe-core, WCAG 2.1 AA), cohérence des versions. Captures dans docs/tests/captures-site-v0.3/.
 * Usage : BASE=https://….meshora.pages.dev NODE_PATH=<dossier>/node_modules node tools/audit/site-pages.mjs
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const req = createRequire(path.join(process.cwd(), 'noop.js'));
const { chromium } = req('playwright-core');
const AXE = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE.replace(/\/$/, '');
const SHOTS = path.join(process.cwd(), 'docs/tests/captures-site-v0.3');
fs.mkdirSync(SHOTS, { recursive: true });
const PAGES = ['/fr/decouvrir/', '/en/discover/', '/fr/installer/', '/en/install/', '/', '/en/'];
const VIEWPORTS = [{ name: 'ordinateur', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }];
const results = [];
const record = (id, pass, evidence) => { results.push({ id, pass, evidence }); console.log(`${pass ? '✅' : '❌'} ${id} — ${evidence}`); };

const b = await chromium.launch({ channel: 'chrome', headless: true });
const linkSet = new Set();
for (const vp of VIEWPORTS) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, colorScheme: scheme, bypassCSP: true }); // CSP contournée uniquement pour injecter axe-core (audit)
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      const resp = await page.goto(BASE + p, { waitUntil: 'networkidle' });
      const info = await page.evaluate(() => {
        const wide = document.querySelector('.md-wide'), tall = document.querySelector('.md-tall');
        const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          wide: vis(wide), tall: vis(tall),
          version: document.querySelector('footer .version')?.textContent?.trim(),
          lang: document.documentElement.lang,
          links: Array.from(document.querySelectorAll('a[href]')).map((a) => a.href)
        };
      });
      info.links.forEach((l) => linkSet.add(l));
      const tag = `${p} ${vp.name} ${scheme}`;
      record(`chargement ${tag}`, resp.status() === 200 && errors.length === 0, `HTTP ${resp.status()} ; erreurs JS=${errors.length}`);
      record(`pas de défilement horizontal ${tag}`, !info.overflow, `débordement=${info.overflow}`);
      if (p.includes('decouvrir') || p.includes('discover')) {
        const expectWide = vp.width > 680;
        record(`schéma adapté ${tag}`, info.wide === expectWide && info.tall === !expectWide, `large=${info.wide} portrait=${info.tall}`);
      }
      if (scheme === 'light') {
        await page.addScriptTag({ content: AXE });
        const axe = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
          return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
        });
        record(`accessibilité axe ${tag}`, axe.length === 0, axe.length ? axe.join(', ') : 'aucune violation WCAG 2.1 A/AA');
      } else {
        await page.addScriptTag({ content: AXE });
        const contrast = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['color-contrast'] })).violations.length);
        record(`contraste thème sombre ${tag}`, contrast === 0, `violations de contraste=${contrast}`);
      }
      const slug = p === '/' ? 'accueil-fr' : p === '/en/' ? 'home-en' : p.replace(/\//g, '-').replace(/^-|-$/g, '');
      if (!p.endsWith('/en/') && p !== '/') await page.screenshot({ path: path.join(SHOTS, `${slug}-${vp.name}-${scheme}.png`), fullPage: true });
      if (p === '/fr/decouvrir/' || p === '/en/discover/') {
        const fig = page.locator('figure.mesh-diagram');
        await fig.screenshot({ path: path.join(SHOTS, `schema-${slug}-${vp.name}-${scheme}.png`) });
      }
      record(`version affichée ${tag}`, /0\.3\.0-preview/.test(info.version || ''), `pied de page « ${info.version} »`);
      await page.close();
    }
    await ctx.close();
  }
}
// Liens
for (const url of linkSet) {
  if (url.startsWith('mailto:')) continue;
  let status = 0;
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow' });
    status = r.status;
  } catch (e) { status = -1; }
  record(`lien ${url}`, status >= 200 && status < 400, `HTTP ${status}`);
}
await b.close();
const fails = results.filter((r) => !r.pass);
console.log(`\nRÉSULTAT : ${results.length - fails.length}/${results.length} vérifications réussies.`);
if (fails.length) console.log('Échecs :\n' + fails.map((f) => ` - ${f.id} : ${f.evidence}`).join('\n'));
