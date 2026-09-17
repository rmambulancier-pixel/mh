from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return path.read_text(encoding='utf-8')

def props(path):
    out = {}
    for line in read(path).splitlines():
        if '=' in line:
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip()
    return out

version = read(ROOT / 'VERSION').strip()
version_props = props(ROOT / 'version.properties')
code = version_props.get('VERSION_CODE', '')

checks = []
def check(name, ok):
    checks.append((name, bool(ok)))

build = read(ROOT / 'app/build.gradle')
index = read(ROOT / 'app/src/main/assets/web/index.html')
manifest = read(ROOT / 'app/src/main/assets/web/manifest.json')
sw = read(ROOT / 'app/src/main/assets/web/sw.js')
js = read(ROOT / 'app/src/main/assets/web/scripts/app.js')
main = read(ROOT / 'app/src/main/java/com/mesheures/app/MainActivity.java')
hybrid = read(ROOT / 'app/src/main/java/com/mesheures/app/core/HybridCore.java')
workflow = read(ROOT / '.github/workflows/build-apk.yml')

check('VERSION canonical', bool(re.fullmatch(r'\d+\.\d+\.\d+', version)))
check('VERSION_CODE canonical', code.isdigit() and int(code) > 0)
check('Version metadata aligned', version_props.get('VERSION') == version)
check('Gradle reads canonical version', "file('../version.properties')" in build and 'releaseVersion' in build and 'releaseCode' in build)
check('Gradle uses canonical variables', 'versionCode releaseCode' in build and 'versionName releaseVersion' in build)
check('JS MH_V', f"const MH_V='{version}'" in js)
check('HTML meta', f'application-version" content="{version}"' in index)
check('HTML visible', f'>V{version}<' in index)
check('Manifest version', f'"version": "{version}"' in manifest)
check('SW cache', f'mesheures-shell-v{version}' in sw)
check('Bridge version', f'VERSION = "{version}"' in hybrid and f'return "{version}"' in main)
check('Secure WebView entry', 'WebViewAssetLoader' in hybrid and 'ENTRY_URL = "https://" + DOMAIN + "/assets/web/index.html"' in hybrid)
check('Workflow uses release audit', 'python3 qa/release-audit.py' in workflow)
check('Workflow dynamic version', 'MESHEURES_VERSION=${{ steps.version.outputs.version }}' in workflow and 'MESHEURES_VERSION_CODE=${{ steps.version.outputs.code }}' in workflow)
check('Workflow APK verification', 'dump badging' in workflow and 'versionCode' in workflow and 'versionName' in workflow)
check('Workflow no invalid secrets if', 'secrets.' not in workflow.split('if:', 1)[1].split('env:', 1)[0] if 'if:' in workflow else True)
check('Main WebView access remains hardened', 'setAllowFileAccess(true)' not in main and 'setAllowContentAccess(true)' not in main)

active_web = ROOT / 'app/src/main/assets/web'
old_active = ('app-v17.js','app-v18.js','app-v19.js','legal-v16.2.4.js','pay-fix-v16.2.js')
check('No old active runtime filenames', not any((active_web / n).exists() or (active_web / 'scripts' / n).exists() for n in old_active))

for name, ok in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + name)

if not all(ok for _, ok in checks):
    sys.exit(1)
print(f'VERSION AUDIT: PASS — MesHeures V{version} / versionCode {code}')
