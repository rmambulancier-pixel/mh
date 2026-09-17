from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "app/src/main/assets/web"
S = WEB / "scripts"

def text(path):
    return path.read_text(encoding="utf-8")

checks = []

def check(name, ok, detail=""):
    checks.append((name, bool(ok), detail))

# --------------------------------------------------
# Required architecture
# --------------------------------------------------

required = [
    ROOT / "VERSION",
    ROOT / "version.properties",
    ROOT / "app/build.gradle",
    ROOT / "app/src/main/AndroidManifest.xml",
    ROOT / "app/src/main/java/com/mesheures/app/MainActivity.java",
    ROOT / "app/src/main/java/com/mesheures/app/core/HybridCore.java",
    WEB / "index.html",
    WEB / "manifest.json",
    WEB / "sw.js",
    WEB / "style/v30.css",
    S / "app-v30.js",
]

for path in required:
    check(
        f"Required file: {path.relative_to(ROOT)}",
        path.exists()
    )

# --------------------------------------------------
# Version
# --------------------------------------------------

version = text(ROOT / "VERSION").strip()

props = {}
for line in text(ROOT / "version.properties").splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        props[k.strip()] = v.strip()

code = props.get("VERSION_CODE", "")

check(
    "Canonical VERSION",
    re.fullmatch(r"\d+\.\d+\.\d+", version) is not None
)

check(
    "Canonical VERSION_CODE",
    code.isdigit()
)

check(
    "Release version",
    version == "30.0.2"
)

check(
    "Release code",
    code == "3001"
)

# --------------------------------------------------
# Build
# --------------------------------------------------

build = text(ROOT / "app/build.gradle")

check(
    "Gradle canonical version source",
    "file('../version.properties')" in build
    and "releaseVersion" in build
    and "releaseCode" in build
)

check(
    "Android compileSdk 37",
    "compileSdk 37" in build
)

check(
    "Android targetSdk 37",
    "targetSdk 37" in build
)

# --------------------------------------------------
# Web
# --------------------------------------------------

index = text(WEB / "index.html")

check(
    "HTML version",
    'application-version" content="30.0.2"' in index
)

check(
    "V30 runtime referenced",
    "scripts/app-v30.js" in index
    and (S / "app-v30.js").exists()
)

check(
    "V30 stylesheet referenced",
    "./style/v30.css" in index
    and (WEB / "style/v30.css").exists()
)

check(
    "No legacy runtime in HTML",
    not any(
        old in index
        for old in [
            "app-v24.js",
            "app-v25.js",
            "app-v26.js",
            "app-v27.js",
            "app-v28.js",
            "app-runtime.js",
            "app-live-engine.js",
        ]
    )
)

# --------------------------------------------------
# V30 runtime
# --------------------------------------------------

v30 = text(S / "app-v30.js")

check(
    "V30 canonical runtime",
    "MesHeures V30.0.2" in v30
    and "canonical runtime" in v30
    and "const V='30.0.2'" in v30
)

check(
    "V30 live engine",
    "window.MH30Live=Live" in v30
    and "startEpoch" in v30
    and "Date.now()" in v30
)

check(
    "V30 dashboard",
    "renderHome" in v30
    and "renderHomeData" in v30
)

check(
    "V30 day editor",
    "renderDay" in v30
    and "renderDayEditor" in v30
)

# --------------------------------------------------
# Android
# --------------------------------------------------

main = text(
    ROOT / "app/src/main/java/com/mesheures/app/MainActivity.java"
)

hybrid = text(
    ROOT / "app/src/main/java/com/mesheures/app/core/HybridCore.java"
)

check(
    "Hybrid Core version",
    'VERSION = "30.0.2"' in hybrid
)

check(
    "Secure WebView",
    "WebViewAssetLoader" in hybrid
    and "setAllowFileAccess(false)" in hybrid
    and "setAllowContentAccess(false)" in hybrid
)

check(
    "Predictive back",
    "OnBackPressedCallback" in main
)

check(
    "Modern Activity Result",
    "registerForActivityResult" in main
    and "onActivityResult" not in main
)

check(
    "Render process recovery",
    "onRenderProcessGone" in main
)

check(
    "No WebView database API",
    "setDatabaseEnabled(true)" not in main
    and "setDatabaseEnabled(true)" not in hybrid
)

# --------------------------------------------------
# Backup
# --------------------------------------------------

backup = text(S / "app-backup.js")

check(
    "Backup namespace",
    "BACKUP_VERSION='30.0.2'" in backup
    and "v30_backup_" in backup
)

# --------------------------------------------------
# Service Worker
# --------------------------------------------------

sw = text(WEB / "sw.js")

check(
    "Service Worker V30 cache",
    "mesheures-shell-v30.0.2" in sw
)

legacy_runtime = [
    "app-v24.js",
    "app-v25.js",
    "app-v26.js",
    "app-v27.js",
    "app-v28.js",
    "app-runtime.js",
    "app-live-engine.js",
]

for old in legacy_runtime:
    check(
        f"SW clean: {old}",
        old not in sw
    )

sw_assets = re.findall(
    r"""['"](\./[^'"]+)['"]""",
    sw
)

missing = []

for asset in set(sw_assets):
    clean = asset.split("?", 1)[0]

    if clean == "./":
        path = WEB
    else:
        path = WEB / clean[2:]

    if not path.exists():
        missing.append(asset)

check(
    "Service Worker assets",
    not missing,
    ",".join(missing)
)

# --------------------------------------------------
# Index -> files -> SW
# --------------------------------------------------

idx_scripts = re.findall(
    r'<script[^>]+src=["\'](\./?scripts/[^"\']+)["\']',
    index,
    flags=re.I
)

missing_index = []

for src in idx_scripts:
    rel = src[2:] if src.startswith("./") else src
    rel = rel.split("?", 1)[0]

    if not (WEB / rel).exists():
        missing_index.append(src)

check(
    "Index scripts exist",
    not missing_index,
    ",".join(missing_index)
)

sw_clean = {
    x.split("?", 1)[0]
    for x in sw_assets
}

uncached = []

for src in idx_scripts:
    rel = src[2:] if src.startswith("./") else src
    rel = "./" + rel.split("?", 1)[0]

    if rel not in sw_clean:
        uncached.append(rel)

check(
    "Index scripts cached by SW",
    not uncached,
    ",".join(uncached)
)

# --------------------------------------------------
# Legacy files really gone
# --------------------------------------------------

legacy_files = [
    S / "app-v24.js",
    S / "app-v25.js",
    S / "app-v26.js",
    S / "app-v27.js",
    S / "app-v28.js",
    S / "app-runtime.js",
    S / "app-live-engine.js",
    WEB / "style/v22.css",
    WEB / "style/v24.css",
    WEB / "style/v24-modules.css",
    WEB / "style/v25.css",
    WEB / "style/v26.css",
    WEB / "style/v27.css",
    WEB / "style/v28.css",
    WEB / "style/v31.css",
]

for path in legacy_files:
    check(
        f"Legacy removed: {path.name}",
        not path.exists()
    )

# --------------------------------------------------
# Result
# --------------------------------------------------

failed = 0

for name, ok, detail in checks:
    if ok:
        print("PASS: " + name)
    else:
        print("FAIL: " + name + (f" — {detail}" if detail else ""))
        failed += 1

print()

if failed:
    print(f"RELEASE AUDIT: FAIL — {failed} check(s)")
    sys.exit(1)

print(
    f"RELEASE AUDIT: PASS — "
    f"MesHeures V{version} / versionCode {code}"
)
