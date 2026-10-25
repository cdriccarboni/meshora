#!/usr/bin/env python3
"""
MESHORA — construction du site public (Cloudflare Pages).

Usage :
    SITE_URL=https://exemple.pages.dev MESHORA_CHANNEL=preview python3 scripts/build_site.py

Produit dist/ à partir de site/ :
  - assemble chaque page de site/pages/*.html (fragment + métadonnées JSON en tête) avec la mise en page commune ;
  - génère les pages d'état réel depuis docs/STATUS.md ;
  - génère version.json, sitemap.xml, robots.txt et _headers ;
  - copie prototype/dist dans /app s'il existe, sinon la page d'attente ;
  - ÉCHOUE si un lien interne est cassé, si un secret est détecté ou si un lien de téléchargement
    apparaît sans version publiée dans site/releases.json.
Aucune dépendance externe : bibliothèque standard Python 3.9+.
"""
import datetime, html, json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DIST = ROOT / "site", ROOT / "dist"
SITE_URL = os.environ.get("SITE_URL", os.environ.get("CF_PAGES_URL", "https://meshora.pages.dev")).rstrip("/")
CHANNEL = os.environ.get("MESHORA_CHANNEL", "production" if os.environ.get("CF_PAGES_BRANCH") == "main" else "preview")
VERSION = (ROOT / "VERSION").read_text().strip()

def git_commit():
    sha = os.environ.get("CF_PAGES_COMMIT_SHA")
    if sha: return sha[:7]
    try: return subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception: return "local"

COMMIT = git_commit()
HAS_PROTO = (ROOT / "prototype" / "dist").is_dir()
BUILT_AT = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

L = {
    "fr": dict(home="/", discover="/fr/decouvrir/", install="/fr/installer/", status="/fr/etat/", privacy="/fr/confidentialite/",
               nav=[("discover", "Découvrir"), ("install", "Installer"), ("app", "Essayer")], other="en", other_label="English",
               main_nav="Navigation principale", share="Partager", sig="Un réseau qui relie les autres.",
               footer_nav="Pied de page", status_label="État réel", privacy_label="Confidentialité", version="Version",
               preview="Aperçu de validation — pas encore publié officiellement.", locale="fr_FR"),
    "en": dict(home="/en/", discover="/en/discover/", install="/en/install/", status="/en/status/", privacy="/en/privacy/",
               nav=[("discover", "Discover"), ("install", "Install"), ("app", "Try it")], other="fr", other_label="Français",
               main_nav="Main navigation", share="Share", sig="A network that connects the others.",
               footer_nav="Footer", status_label="Real status", privacy_label="Privacy", version="Version",
               preview="Validation preview — not officially published yet.", locale="en_GB"),
}

def layout(meta, body):
    lang = meta["lang"]; t = L[lang]
    path, alt = meta["path"], meta.get("alt")
    url = SITE_URL + path
    title = meta["title"]; desc = meta["description"]
    full_title = title if title.startswith("MESHORA") else f"{title} — MESHORA"
    alts = ""
    if alt:
        other = t["other"]
        alts = (f'  <link rel="alternate" hreflang="{lang}" href="{url}">\n'
                f'  <link rel="alternate" hreflang="{other}" href="{SITE_URL + alt}">\n'
                f'  <link rel="alternate" hreflang="x-default" href="{SITE_URL}/">\n')
    nav_links = []
    for key, label in t["nav"]:
        href = "/app/" if key == "app" else t[key]
        cur = ' aria-current="page"' if meta.get("nav") == key else ""
        nav_links.append(f'<a href="{href}"{cur}>{label}</a>')
    lang_link = f'<a class="lang" href="{alt or L[t["other"]]["home"]}" hreflang="{t["other"]}" lang="{t["other"]}">{t["other_label"]}</a>'
    band = f'<div class="preview-band" role="note">{t["preview"]}</div>\n' if CHANNEL != "production" else ""
    robots = '  <meta name="robots" content="noindex, nofollow">\n' if CHANNEL != "production" else ""
    return f"""<!doctype html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(full_title)}</title>
  <meta name="description" content="{html.escape(desc)}">
{robots}  <link rel="canonical" href="{url}">
{alts}  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MESHORA">
  <meta property="og:title" content="{html.escape(full_title)}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE_URL}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="MESHORA — {html.escape(t['sig'])}">
  <meta property="og:locale" content="{t['locale']}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#14171C" media="(prefers-color-scheme: dark)">
  <link rel="stylesheet" href="/assets/meshora.css?v={VERSION}">
  <script src="/assets/site.js?v={VERSION}" defer></script>
</head>
<body>
{band}  <div class="wrap">
    <header class="site">
      <a class="brand" href="{t['home']}"><img src="/assets/logo.svg" alt="" width="32" height="32">MESHORA</a>
      <nav class="site" aria-label="{t['main_nav']}">
        {' '.join(nav_links)}
        {lang_link}
      </nav>
    </header>

    <main id="contenu">
{body}
    </main>

    <footer class="site">
      <div class="row">
        <span>MESHORA — {t['sig']}</span>
        <button class="btn" type="button" data-share data-share-url="{url}">{t['share']}</button>
      </div>
      <div class="row">
        <nav aria-label="{t['footer_nav']}">
          <a href="{t['discover']}">{dict(t['nav'])['discover']}</a>
          <a href="{t['install']}">{dict(t['nav'])['install']}</a>
          <a href="{t['status']}">{t['status_label']}</a>
          <a href="{t['privacy']}">{t['privacy_label']}</a>
        </nav>
        <span class="version">{t['version']} {VERSION} · {COMMIT}</span>
      </div>
    </footer>
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
</body>
</html>
"""

def parse_page(p):
    text = p.read_text()
    m = re.match(r"\s*<!--(\{.*?\})-->\s*", text, re.S)
    if not m: sys.exit(f"Métadonnées manquantes : {p}")
    return json.loads(m.group(1)), text[m.end():]

# ---------- État réel depuis docs/STATUS.md ----------
def status_body(lang):
    md = (ROOT / "docs" / "STATUS.md").read_text()
    rows = [l for l in md.splitlines() if l.startswith("|") and not l.startswith("|---")]
    head, data = rows[0], rows[1:]
    cells = lambda r: [c.strip() for c in r.strip("|").split("|")]
    def cell(c):
        c = html.escape(c)
        return re.sub(r"`([^`]+)`", r"<code>\1</code>", c)
    legend = re.search(r"Légende : (.*)", md).group(1)
    tested = sum(1 for r in data if "✅" in cells(r)[2])
    if lang == "fr":
        intro = (f"<p>Cette page est générée automatiquement depuis le suivi interne du projet. "
                 f"Une fonction n'est marquée ✅ qu'après un test réel sur appareils physiques.</p>"
                 f"<p><strong>{tested} fonction(s) testée(s) sur appareil à ce jour.</strong></p><p class=\"muted\">Légende : {html.escape(legend)}</p>")
        title = "État réel des fonctions"
        heads = ["Pilier", "Fonction", "État", "Plateformes testées", "Test"]
    else:
        intro = (f"<p>This page is generated automatically from the project's internal tracker. "
                 f"A feature is marked ✅ only after a real test on physical devices.</p>"
                 f"<p><strong>{tested} feature(s) tested on devices so far.</strong></p>"
                 f"<p class=\"muted\">Legend: ⬜ Not started · 📐 Specified · 🎭 Simulated in the prototype · 🔧 Implemented, not tested · ✅ Tested on physical devices · ❌ Dropped. "
                 f"Feature names are currently listed in French.</p>")
        title = "Real feature status"
        heads = ["Pillar", "Feature", "Status", "Tested platforms", "Test"]
    trs = "\n".join("<tr>" + "".join(f"<td>{cell(c)}</td>" for c in cells(r)) + "</tr>" for r in data)
    ths = "".join(f'<th scope="col">{h}</th>' for h in heads)
    return f"""      <div class="hero"><h1>{title}</h1></div>
      <section>
        {intro}
        <div class="table-scroll"><table class="status-table"><thead><tr>{ths}</tr></thead><tbody>
{trs}
        </tbody></table></div>
        <p class="muted">{'Mis à jour lors de chaque version du site' if lang == 'fr' else 'Updated with every site release'} · {BUILT_AT[:10]}</p>
      </section>"""

# ---------- Construction ----------
def build():
    if DIST.exists(): shutil.rmtree(DIST)
    DIST.mkdir()
    shutil.copytree(SRC / "assets", DIST / "assets")
    shutil.copy(SRC / "manifest.webmanifest", DIST / "manifest.webmanifest")
    pages = []
    for p in sorted((SRC / "pages").glob("*.html")):
        meta, body = parse_page(p)
        pages.append((meta, body))
    pages.append(({"lang": "fr", "path": "/fr/etat/", "alt": "/en/status/", "title": "État réel des fonctions",
                   "description": "Ce qui fonctionne réellement dans MESHORA aujourd'hui, testé sur appareils.", "nav": "status"}, status_body("fr")))
    pages.append(({"lang": "en", "path": "/en/status/", "alt": "/fr/etat/", "title": "Real feature status",
                   "description": "What actually works in MESHORA today, tested on devices.", "nav": "status"}, status_body("en")))
    releases = json.loads((SRC / "releases.json").read_text())
    for meta, body in pages:
        body = render_releases(body, releases, meta["lang"])
        body = render_app_status(body, meta["lang"])
        out = DIST / meta["path"].lstrip("/") / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(layout(meta, body))
    # Page 404 bilingue (sinon Cloudflare Pages renvoie l'accueil pour toute adresse inconnue)
    nf_body = """      <div class="hero">
        <h1>Page introuvable</h1>
        <p>Cette adresse n'existe pas ou plus.</p>
        <p lang="en">This page doesn't exist (anymore).</p>
        <div class="actions"><a class="btn primary" href="/">Accueil</a><a class="btn" href="/en/" lang="en">Home (English)</a></div>
      </div>"""
    (DIST / "404.html").write_text(layout({"lang": "fr", "path": "/404.html", "title": "Page introuvable",
                                           "description": "Cette page n'existe pas.", "nav": ""}, nf_body)
                                    .replace('<meta name="description"', '<meta name="robots" content="noindex">\n  <meta name="description"', 1))
    # /app : prototype construit s'il existe, sinon page d'attente
    proto = ROOT / "prototype" / "dist"
    if proto.is_dir():
        shutil.copytree(proto, DIST / "app")
        app_source = "prototype/dist"
    else:
        shutil.copytree(SRC / "app-placeholder", DIST / "app")
        app_source = "site/app-placeholder"
    (DIST / "version.json").write_text(json.dumps({"version": VERSION, "channel": CHANNEL, "commit": COMMIT,
                                                    "builtAt": BUILT_AT, "app": app_source}, indent=2) + "\n")
    urls = [m["path"] for m, _ in pages]
    (DIST / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{SITE_URL}{u}</loc><lastmod>{BUILT_AT[:10]}</lastmod></url>\n" for u in urls) + "</urlset>\n")
    (DIST / "robots.txt").write_text(("User-agent: *\nAllow: /\n\nSitemap: " + SITE_URL + "/sitemap.xml\n") if CHANNEL == "production"
                                     else "# Aperçu de validation : non indexé\nUser-agent: *\nDisallow: /\n")
    headers = (SRC / "_headers").read_text()
    if CHANNEL != "production":
        headers = headers.replace("/*\n", "/*\n  X-Robots-Tag: noindex, nofollow\n", 1)
    (DIST / "_headers").write_text(headers)
    shutil.copy(SRC / "_redirects", DIST / "_redirects")
    return urls

APP_STATUS = {
    ("fr", False): """<p class="status"><span class="dot note" aria-hidden="true"></span>En préparation — la démo de l'interface sera disponible ici prochainement.</p>""",
    ("en", False): """<p class="status"><span class="dot note" aria-hidden="true"></span>In preparation — the interface demo will be available here soon.</p>""",
    ("fr", True): """<p class="status"><span class="dot note" aria-hidden="true"></span>Démo de l'interface disponible — réseau simulé, les messages ne sont pas encore réellement envoyés.</p>
        <div class="actions"><a class="btn primary" href="/app/">Ouvrir la démo</a><button class="btn" type="button" data-install hidden>Installer l'application web</button></div>
        <div data-platform="ios" hidden><p>Sur iPhone ou iPad, dans Safari :</p><ol class="steps"><li>touchez le bouton Partager ;</li><li>choisissez « Sur l'écran d'accueil ».</li></ol></div>""",
    ("en", True): """<p class="status"><span class="dot note" aria-hidden="true"></span>Interface demo available — simulated network, messages are not actually sent yet.</p>
        <div class="actions"><a class="btn primary" href="/app/">Open the demo</a><button class="btn" type="button" data-install hidden>Install the web app</button></div>
        <div data-platform="ios" hidden><p>On iPhone or iPad, in Safari:</p><ol class="steps"><li>tap the Share button;</li><li>choose “Add to Home Screen”.</li></ol></div>""",
}

def render_app_status(body, lang):
    return body.replace("<!--@app-status-->", APP_STATUS[(lang, HAS_PROTO)])

def render_releases(body, releases, lang):
    """Remplace <!--@releases--> par le tableau des versions publiées (vide => « Pas encore disponible »)."""
    if "<!--@releases-->" not in body: return body
    names = {"android": "Android", "ios": "iPhone / iPad", "macos": "macOS", "windows": "Windows", "linux": "Linux", "raspberry-pi": "Raspberry Pi"}
    na = "Pas encore disponible" if lang == "fr" else "Not available yet"
    rows = []
    for key, label in names.items():
        r = releases.get(key)
        if isinstance(r, dict) and r.get("published") and r.get("url"):
            cellv = f'<a href="{html.escape(r["url"])}" rel="noopener">{html.escape(r.get("label", r["url"]))}</a> <span class="muted">{html.escape(r.get("version", ""))}</span>'
        else:
            cellv = f'<span class="status"><span class="dot" aria-hidden="true"></span>{na}</span>'
        rows.append(f"<tr><td>{label}</td><td>{cellv}</td></tr>")
    h = ("<th scope=\"col\">Plateforme</th><th scope=\"col\">Application native</th>" if lang == "fr"
         else "<th scope=\"col\">Platform</th><th scope=\"col\">Native app</th>")
    return body.replace("<!--@releases-->", f'<table class="platforms"><thead><tr>{h}</tr></thead><tbody>{"".join(rows)}</tbody></table>')

# ---------- Contrôles bloquants ----------
SECRET_PATTERNS = [
    (r"AIza[0-9A-Za-z\-_]{35}", "clé API Google"),
    (r"sk-[A-Za-z0-9]{20,}", "clé API (format sk-)"),
    (r"gh[pousr]_[A-Za-z0-9]{30,}", "jeton GitHub"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "clé privée"),
    (r"(?i)(api[_-]?key|secret|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}['\"]", "secret en dur"),
    (r"xox[baprs]-[A-Za-z0-9-]{10,}", "jeton Slack"),
    (r"(?i)cloudflare[_-]?api[_-]?token", "jeton Cloudflare"),
]
DOWNLOAD_EXT = re.compile(r'href="[^"]+\.(apk|ipa|dmg|exe|msi|deb|rpm|appimage|zip)"', re.I)

def check(urls):
    errors = []
    releases = json.loads((SRC / "releases.json").read_text())
    published = {r.get("url") for r in releases.values() if isinstance(r, dict) and r.get("published")}
    for f in DIST.rglob("*"):
        if not f.is_file() or f.suffix in {".png", ".ico", ".woff2", ".jpg"}: continue
        text = f.read_text(errors="ignore")
        rel = f.relative_to(DIST)
        for pat, label in SECRET_PATTERNS:
            if re.search(pat, text): errors.append(f"Secret possible ({label}) dans {rel}")
        if f.suffix == ".html":
            for m in DOWNLOAD_EXT.finditer(text):
                href = re.search(r'href="([^"]+)"', m.group(0)).group(1)
                if href not in published: errors.append(f"Lien de téléchargement non publié dans {rel} : {href}")
            if not str(rel).startswith("app/"):
                for tag in re.findall(r'<(?:script|img|iframe|link)\b[^>]*>', text):
                    if tag.startswith("<link") and re.search(r'rel="(canonical|alternate)"', tag): continue
                    m = re.search(r'(?:src|href)="(https?://[^"]+)"', tag)
                    if m: errors.append(f"Ressource externe chargée dans {rel} : {m.group(1)}")
                for href in re.findall(r'(?:href|src)="(/[^"#?]*)', text):
                    target = DIST / href.lstrip("/")
                    if not (target.is_file() or (target / "index.html").is_file()):
                        errors.append(f"Lien interne cassé dans {rel} : {href}")
    return errors

if __name__ == "__main__":
    urls = build()
    errs = check(urls)
    if errs:
        print("ÉCHEC de la construction :", *errs, sep="\n  - ")
        sys.exit(1)
    print(f"OK — MESHORA {VERSION} ({CHANNEL}, {COMMIT}) — {len(urls)} pages + /app — {SITE_URL}")
