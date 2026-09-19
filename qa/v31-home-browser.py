"""
Test navigateur réel de l'Accueil V31 (Chromium headless via Playwright).

Ce que node --check / release-audit ne voient pas : le rendu effectif.
Le bug V31.1.x (5 blocs en display:none à cause de `section{display:none}`)
aurait été détecté ici.

Usage :  python3 qa/v31-home-browser.py
Prérequis : pip install playwright && playwright install chromium
"""
import functools
import http.server
import socketserver
import sys
import threading
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("SKIP: playwright non installé")
    sys.exit(0)

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "app/src/main/assets/web"
OUT = ROOT / "qa" / "out"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS: " if ok else "FAIL: ") + name + ((" · " + str(detail)) if detail and not ok else ""))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    handler = functools.partial(Quiet, directory=str(WEB))
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


VISIBLE = """() => [...document.querySelectorAll('.mh31-home > *')].map(e => ({
  cls: e.className, h: e.offsetHeight, display: getComputedStyle(e).display }))"""

TEXT = "() => document.getElementById('s-home').innerText"


def open_page(browser, port, errors):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(f"http://127.0.0.1:{port}/index.html")
    page.wait_for_function("window.MH31 && document.querySelector('.mh31-home')", timeout=8000)
    page.wait_for_timeout(600)
    return ctx, page


def main():
    OUT.mkdir(exist_ok=True)
    srv = serve()
    port = srv.server_address[1]

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # 1. Données par défaut : tous les blocs visibles ------------------
        errors = []
        ctx, page = open_page(browser, port, errors)
        blocks = page.evaluate(VISIBLE)
        hidden = [b["cls"] for b in blocks if b["h"] == 0 or b["display"] == "none"]
        check("Home : tous les blocs ont une hauteur", not hidden, hidden)
        check("Home : au moins 7 blocs (hero, actions, 4 cartes, pied)", len(blocks) >= 7, len(blocks))
        txt = page.evaluate(TEXT)
        for label in ["PILOTAGE", "INTELLIGENCE", "ÉTAT DU DOSSIER", "PROCHAINE ACTION",
                      "Saisie", "Planning", "Paie", "Analyse", "Ajouter une journée", "Réglages"]:
            check(f"Home : « {label} » affiché", label in txt)
        check("Home : un seul conteneur .mh31-home", page.evaluate("document.querySelectorAll('.mh31-home').length") == 1)
        check("Home : aucun <section> imbriqué dans #s-home",
              page.evaluate("document.querySelectorAll('#s-home section').length") == 0)
        check("Home : ancien Home statique absent", page.evaluate("!document.getElementById('homeTodayTte')"))
        check("Home : aucune erreur JS au chargement", not errors, errors[:3])
        page.screenshot(path=str(OUT / "home-default.png"), full_page=True)

        # 2. Navigation aller-retour : pas de doublon, toujours visible ----
        page.evaluate("tab('jour')")
        page.wait_for_timeout(150)
        page.evaluate("tab('home')")
        page.wait_for_timeout(300)
        check("Navigation : retour Accueil visible", page.evaluate("document.getElementById('s-home').offsetHeight") > 300)
        check("Navigation : toujours un seul .mh31-home", page.evaluate("document.querySelectorAll('.mh31-home').length") == 1)

        # 3. Ré-rendu idempotent : pas de réécriture DOM inutile -----------
        same = page.evaluate("""() => {
          const el = document.querySelector('.mh31-home');
          MH31.renderHome(); MH31.renderHome();
          return el === document.querySelector('.mh31-home');
        }""")
        check("Rendu : DOM conservé si rien n'a changé", same)

        # 4. Service en cours -------------------------------------------
        page.evaluate("""() => {
          const k = today();
          DB.days[k] = { t: 'T', deb: '06:00', fin: null, running: true, startEpoch: Date.now() - 3 * 3600e3, p: [] };
          save(); MH31.renderHome();
        }""")
        page.wait_for_timeout(300)
        txt = page.evaluate(TEXT)
        check("Live : état « En service »", "En service" in txt)
        check("Live : bouton Arrêter", "Arrêter" in txt)
        check("Live : horloge écoulée renseignée", page.evaluate("document.querySelector('[data-live-clock]').textContent").startswith("3h"))

        # 5. Journée sans fin (service non lancé) -----------------------
        page.evaluate("""() => {
          const k = today();
          DB.days[k] = { t: 'T', deb: '06:00', fin: null, p: [] };
          save(); MH31.renderHome();
        }""")
        page.wait_for_timeout(300)
        txt = page.evaluate(TEXT)
        check("Journée sans fin : « À compléter »", "À compléter" in txt)
        check("Journée sans fin : action « Compléter la journée »", "Compléter la journée" in txt)

        # 6. Aucune donnée du tout ------------------------------------
        page.evaluate("() => { DB.days = {}; save(); MH31.renderHome(); }")
        page.wait_for_timeout(300)
        blocks = page.evaluate(VISIBLE)
        txt = page.evaluate(TEXT)
        check("Sans données : blocs toujours visibles", all(b["h"] > 0 for b in blocks))
        check("Sans données : message neutre, pas de valeur inventée",
              "Données insuffisantes" in txt or "Aucune anomalie" in txt)
        check("Sans données : action « Saisir la journée »", "Saisir la journée" in txt)
        page.screenshot(path=str(OUT / "home-empty.png"), full_page=True)

        # 7. Isolation des blocs : un module en panne ne casse pas l'Accueil
        page.evaluate("""() => {
          window.MH302.period = () => { throw new Error('panne simulée'); };
          window.MH302.anomalies = () => { throw new Error('panne simulée'); };
          MH31.renderHome();
        }""")
        page.wait_for_timeout(300)
        blocks = page.evaluate(VISIBLE)
        check("Panne module : l'Accueil reste rendu", len(blocks) >= 7 and all(b["h"] > 0 for b in blocks))
        ctx.close()

        # 8. Thème clair : les cartes restent lisibles ---------------------
        errors = []
        ctx, page = open_page(browser, port, errors)
        page.evaluate("document.documentElement.setAttribute('data-theme','light')")
        page.wait_for_timeout(300)
        bg = page.evaluate("getComputedStyle(document.querySelector('.mh31-card')).backgroundColor")
        check("Thème clair : fond de carte clair", bg in ("rgb(255, 255, 255)",), bg)
        page.screenshot(path=str(OUT / "home-light.png"), full_page=True)
        ctx.close()

        # 9. Viewport étroit --------------------------------------------
        ctx = browser.new_context(viewport={"width": 320, "height": 700}, service_workers="block")
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_function("window.MH31 && document.querySelector('.mh31-home')", timeout=8000)
        page.wait_for_timeout(500)
        overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        check("320 px : pas de débordement horizontal", not overflow)
        ctx.close()

        browser.close()

    srv.shutdown()
    failed = [r for r in results if not r[1]]
    print()
    if failed:
        print(f"V31 HOME BROWSER TEST: FAIL ({len(failed)}/{len(results)})")
        sys.exit(1)
    print(f"V31 HOME BROWSER TEST: PASS ({len(results)} contrôles)")


main()
