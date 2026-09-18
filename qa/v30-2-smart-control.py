from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "app/src/main/assets/web"
JS = WEB / "scripts"

def ok(name, value):
    print(("PASS" if value else "FAIL") + ": " + name)
    return value

version = (ROOT / "VERSION").read_text().strip()
props = (ROOT / "version.properties").read_text()
index = (WEB / "index.html").read_text()
sw = (WEB / "sw.js").read_text()
runtime = (JS / "app-v30.js").read_text()
smart = (JS / "app-v30-smart.js").read_text()
css = (WEB / "style/v30.css").read_text()

checks = []

checks += [ok("VERSION canonique", version == "30.2.2")]
checks += [ok("VERSION_CODE canonique", "VERSION_CODE=3022" in props)]
checks += [ok("Smart JS chargé", "scripts/app-v30-smart.js" in index)]
checks += [ok("Smart JS dans Service Worker", "app-v30-smart.js" in sw)]
checks += [ok("runtime canonique V30.2", "const V='" + version + "'" in runtime)]
checks += [ok("SMART CONTROL", "SMART CONTROL" in smart)]
checks += [ok("cockpit", "renderHome" in smart)]
checks += [ok("Quick Add", "mh302OpenQuickAdd" in smart and "mh302SaveQuickAdd" in smart)]
checks += [ok("Smart time", "smartTime" in smart)]
checks += [ok("Insights", "function insights" in smart)]
checks += [ok("Anomalies", "function anomalies" in smart)]
checks += [ok("Paie moteur existant", "calcPer" in smart and "brutOf" in smart)]
checks += [ok("Calendrier", "dayStatus" in smart)]
checks += [ok("FAB global", "mh302Fab" in smart)]
checks += [ok("Swipe", "touchstart" in smart and "touchend" in smart)]
checks += [ok("CSS Smart Control", ".mh302-shell" in css and ".mh302-fab" in css)]
checks += [ok("Pas de runtime V24", "app-v24.js" not in index + sw)]
checks += [ok("Pas de runtime V25", "app-v25.js" not in index + sw)]
checks += [ok("Pas de runtime V26", "app-v26.js" not in index + sw)]
checks += [ok("Pas de runtime V27", "app-v27.js" not in index + sw)]
checks += [ok("Pas de runtime V28", "app-v28.js" not in index + sw)]

if not all(checks):
    print("\nSMART CONTROL AUDIT: FAIL")
    sys.exit(1)

print("\nSMART CONTROL AUDIT: PASS")
