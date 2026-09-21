"""
Test navigateur de la feuille de route hebdomadaire (Paie > Générer le PDF).

Régression V32.2.0 : meal() lisait `S.panDeb` alors que `S` n'existe pas en global -> ReferenceError
silencieuse, bouton inerte. Ce test clique réellement le bouton avec un faux pont Android, vérifie
que le HTML d'impression est produit, que les jours sans pause saisie affichent « Repas AUTO »,
et qu'une erreur est signalée à l'utilisateur au lieu d'échouer en silence.

Usage :  python3 qa/roadmap-browser.py
"""
import functools, http.server, os, re, socketserver, sys, threading
from pathlib import Path
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("SKIP: playwright non installé"); sys.exit(0)

WEB = Path(__file__).resolve().parents[1] / "app/src/main/assets/web"
results = []
def check(name, ok, detail=""):
    results.append(bool(ok)); print(("PASS: " if ok else "FAIL: ") + name + ((" · " + str(detail)) if detail and not ok else ""))

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

SEED = """()=>{
const W=(k,deb,fin,p)=>{DB.days[k]={t:'T',deb,fin,p:p||[]}};
W('2026-09-14','06:50','17:00',[{d:'11:45',f:'12:15',ty:'EXT'}]);W('2026-09-15','06:20','14:20',[{d:'11:00',f:'11:30',ty:'ENT'}]);
W('2026-09-16','07:20','18:20');W('2026-09-17','07:50','17:50');W('2026-09-18','07:20','15:00');
DB.per={start:'2026-08-24',nb:2};MH30DataEngine.invalidate('qa');
}"""

def main():
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(WEB)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    with sync_playwright() as p:
        kw = {"executable_path": os.environ["CHROMIUM_PATH"], "args": ["--no-sandbox"]} if os.environ.get("CHROMIUM_PATH") else {}
        b = p.chromium.launch(**kw)
        page = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block").new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(f"http://127.0.0.1:{port}/index.html"); page.wait_for_timeout(1500)
        page.evaluate(SEED)
        page.evaluate("window.__cap=null;window.__toast=null;window.MesHeuresAndroid={printHtml:h=>{window.__cap=h},toast:m=>{window.__toast=m},isSystemDark:()=>false,setSystemBarsLight:()=>{},saveLocalStorage:()=>{},updateWidgetData:()=>{},setCurrentTab:()=>{},platform:()=>'android'}")
        page.evaluate("tab('paie')"); page.wait_for_timeout(500)
        page.evaluate("document.getElementById('mhRoadmapDate').value='2026-09-14'")
        page.click('#mhRoadmapPdf'); page.wait_for_timeout(400)
        html = page.evaluate("window.__cap")
        check("Le bouton envoie un document à l'impression", bool(html))
        if html:
            check("Pauses saisies conservées (11:45–12:15 · EXT)", "11:45–12:15 · EXT" in html)
            check("Repas AUTO sur les 3 jours sans pause saisie", html.count("Repas AUTO") == 3, html.count("Repas AUTO"))
            check("TTE inchangé (11h00 le mercredi, pas de déduction)", "TTE 11h00" in html)
        page.evaluate("window.__toast=null;window.__save=DB.s;DB.s=undefined")
        page.click('#mhRoadmapPdf'); page.wait_for_timeout(300)
        check("Une erreur est signalée à l'utilisateur", "impossible" in (page.evaluate("window.__toast") or ""))
        page.evaluate("DB.s=window.__save")
        check("Aucune erreur JS non gérée", not errs, errs[:2])
        b.close()
    print("\nROADMAP TEST: " + ("PASS" if all(results) else "FAIL"))
    sys.exit(0 if all(results) else 1)

if __name__ == "__main__":
    main()
