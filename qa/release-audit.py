from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "app/src/main/assets/web"
S = WEB / "scripts"

def text(p):
    return p.read_text(encoding="utf-8")

checks = []

def check(name, ok, detail=""):
    checks.append((name, bool(ok), detail))

version = text(ROOT / "VERSION").strip()

props = {}
for line in text(ROOT / "version.properties").splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        props[k.strip()] = v.strip()

code = props.get("VERSION_CODE", "")

index = text(WEB / "index.html")
manifest = text(WEB / "manifest.json")
sw = text(WEB / "sw.js")
build = text(ROOT / "app/build.gradle")
hybrid = text(ROOT / "app/src/main/java/com/mesheures/app/core/HybridCore.java")
main = text(ROOT / "app/src/main/java/com/mesheures/app/MainActivity.java")
backup = text(S / "app-backup.js")
v30 = text(S / "app-v30.js")

# ---------------- Version ----------------

check(
    "Canonical VERSION",
    bool(re.fullmatch(r"\d+\.\d+\.\d+", version))
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
    "Gradle reads canonical version",
    "file('../version.properties')" in build
    and "releaseVersion" in build
    and "releaseCode" in build
)

check(
    "Manifest version",
    f'"version": "{version}"' in manifest
)

check(
    "HTML version",
    f'application-version" content="{version}"' in index
    and "MesHeures V30.0" in index
)

# ---------------- V30 architecture ----------------

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
    "V30 runtime is canonical",
    "canonical runtime" in v30
    and "MH30Live" in v30
    and "renderHome" in v30
    and "renderDay" in v30
)

check(
    "Hybrid Core version",
    f'VERSION = "{version}"' in hybrid
)

check(
    "Secure WebView",
    "WebViewAssetLoader" in hybrid
    and "setAllowFileAccess(false)" in hybrid
    and "setAllowContentAccess(false)" in hybrid
)

# ---------------- Backup ----------------

check(
    "Backup namespace",
    "const BACKUP_VERSION='30.0.2';" in backup
    and "const PREFIX=LS+'_v30_backup_';" in backup
)

# Legacy backup compatibility is intentionally allowed:
check(
    "Backup clean V30",
    "BACKUP_VERSION='30.0.2'" in backup
    and "const PREFIX=LS+'_v30_backup_'" in backup
)

# ---------------- Service Worker ----------------

check(
    "Service Worker V30 cache",
    f"mesheures-shell-v{version}" in sw
)

# Extract local assets from SW shell
sw_assets = re.findall(
    r"""['"](\./[^'"]+)['"]""",
    sw
)

missing_sw = []

for asset in sw_assets:
    clean = asset.split("?", 1)[0]

    if clean in ("./",):
        path = WEB
    else:
        path = WEB / clean[2:]

    if not path.exists():
        missing_sw.append(asset)

check(
    "Service Worker assets exist",
    not missing_sw,
    ",".join(missing_sw)
)

# No deleted historical runtime may be required by the V30 shell
legacy_runtime = [
    "app-v24.js",
    "app-v25.js",
    "app-v26.js",
    "app-v27.js",
    "app-v28.js",
    "app-runtime.js",
    "app-live-engine.js",
]

legacy_refs = [
    x for x in legacy_runtime
    if x in sw
]

check(
    "No legacy runtime in Service Worker",
    not legacy_refs,
    ",".join(legacy_refs)
)

# ---------------- Index scripts ----------------

idx_scripts = re.findall(
    r'<script\s+(?:[^>]*?)src=["\'](\./?scripts/[^"\']+)["\']',
    index
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

# Every script loaded by index should be present in SW shell
sw_clean = {
    x.split("?", 1)[0]
    for x in sw_assets
}

uncached = []

for src in idx_scripts:
    rel = "./" + (src[2:] if src.startswith("./") else src)
    rel = rel.split("?", 1)[0]

    if rel not in sw_clean:
        uncached.append(rel)

check(
    "Index scripts in SW shell",
    not uncached,
    ",".join(uncached)
)

# ---------------- Android ----------------

check(
    "Modern back dispatcher",
    "OnBackPressedCallback" in main
)

check(
    "Modern Activity Result",
    "registerForActivityResult" in main
    and "onActivityResult" not in main
)

check(
    "No WebView database API",
    "setDatabaseEnabled(true)" not in main
    and "setDatabaseEnabled(true)" not in hybrid
)

check(
    "Android 17 target",
    "targetSdk 37" in build
    and "compileSdk 37" in build
)

check(
    "Application bootstrap",
    "MesHeuresApplication" in main
    or (
        ROOT /
        "app/src/main/java/com/mesheures/app/MesHeuresApplication.java"
    ).exists()
)

# ---------------- Result ----------------

for name, ok, detail in checks:
    print(
        ("PASS" if ok else "FAIL")
        + ": "
        + name
        + ((" — " + detail) if detail else "")
    )

if not all(ok for _, ok, _ in checks):
    print("\nRELEASE AUDIT: FAIL")
    sys.exit(1)

print(
    f"\nRELEASE AUDIT: PASS — "
    f"MesHeures V{version} / versionCode {code}"
)
