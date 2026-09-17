from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "app/src/main/assets/web"
S = WEB / "scripts"

def read(p):
    return p.read_text(encoding="utf-8")

main = read(ROOT / "app/src/main/java/com/mesheures/app/MainActivity.java")
hybrid = read(ROOT / "app/src/main/java/com/mesheures/app/core/HybridCore.java")
index = read(WEB / "index.html")
manifest = read(ROOT / "app/src/main/AndroidManifest.xml")
build = read(ROOT / "app/build.gradle")
v30 = read(S / "app-v30.js")
sw = read(WEB / "sw.js")

checks = {
    "predictive back":
        "OnBackPressedCallback" in main,

    "modern activity result":
        "registerForActivityResult" in main
        and "onActivityResult" not in main,

    "secure WebView":
        "WebViewAssetLoader" in hybrid
        and "setAllowFileAccess(false)" in hybrid
        and "setAllowContentAccess(false)" in hybrid,

    "render process recovery":
        "onRenderProcessGone" in main,

    "edge to edge":
        "enableEdgeToEdge" in main,

    "no WebView database API":
        "setDatabaseEnabled(true)" not in main
        and "setDatabaseEnabled(true)" not in hybrid,

    "V30 runtime loaded":
        "scripts/app-v30.js" in index
        and (S / "app-v30.js").exists(),

    "V30 stylesheet loaded":
        "./style/v30.css" in index
        and (WEB / "style/v30.css").exists(),

    "V30 canonical runtime":
        "canonical runtime" in v30
        and "const V=\\'" + read(ROOT / "VERSION").strip() + "\\'" in v30
        and "One calculation engine" in v30,

    "V30 live engine":
        "window.MH30Live=Live" in v30
        and "startEpoch" in v30
        and "Date.now()" in v30,

    "V30 dashboard":
        "renderHome" in v30
        and "renderHomeData" in v30,

    "V30 day editor":
        "renderDay" in v30
        and "renderDayEditor" in v30,

    "V30 smart time":
        "normalizeTimeInput" in v30
        and "data-time-smart" in v30,

    "V30 refresh":
        "mhRefresh" in v30
        and "live-mutation" in v30,

    "adaptive UI":
        'screenOrientation="portrait"' not in manifest,

    "Android 17 compile":
        "compileSdk 37" in build,

    "Android 17 target":
        "targetSdk 37" in build,

    "V30 Service Worker":
        "mesheures-shell-v" + read(ROOT / "VERSION").strip() in sw
        and "scripts/app-v30.js" in sw,

    "no legacy Service Worker":
        not any(x in sw for x in (
            "app-v24.js",
            "app-v25.js",
            "app-v26.js",
            "app-v27.js",
            "app-v28.js",
            "app-runtime.js",
            "app-live-engine.js",
        )),

    "no legacy HTML":
        not any(x in index for x in (
            "app-v24.js",
            "app-v25.js",
            "app-v26.js",
            "app-v27.js",
            "app-v28.js",
            "app-runtime.js",
            "app-live-engine.js",
        )),
}

failed = 0

for name, ok in checks.items():
    print(("PASS" if ok else "FAIL") + ": " + name)
    if not ok:
        failed += 1

if failed:
    print()
    print("PERFORMANCE AUDIT: FAIL")
    sys.exit(1)

print()
print("PERFORMANCE AUDIT: PASS — MesHeures V" + read(ROOT / "VERSION").strip())
