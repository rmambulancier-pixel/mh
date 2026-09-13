from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
V = (ROOT / 'VERSION').read_text(encoding='utf-8').strip()
props = dict(line.split('=', 1) for line in (ROOT/'version.properties').read_text(encoding='utf-8').splitlines() if '=' in line)
CODE = props['VERSION_CODE']
checks=[]
def check(name, ok): checks.append((name, bool(ok)))
def text(p): return p.read_text(encoding='utf-8')
build=text(ROOT/'app/build.gradle'); index=text(ROOT/'app/src/main/assets/web/index.html'); manifest=text(ROOT/'app/src/main/assets/web/manifest.json'); sw=text(ROOT/'app/src/main/assets/web/sw.js'); js=text(ROOT/'app/src/main/assets/web/scripts/app.js'); main=text(ROOT/'app/src/main/java/com/mesheures/app/MainActivity.java'); hybrid=text(ROOT/'app/src/main/java/com/mesheures/app/core/HybridCore.java'); workflow=text(ROOT/'.github/workflows/build-apk.yml')
check('VERSION canonical', V == '20.4.0')
check('VERSION_CODE canonical', CODE == '2040')
check('Gradle versionCode', f'versionCode {CODE}' in build)
check('Gradle versionName', f"versionName '{V}'" in build)
check('JS MH_V', f"MH_V='{V}'" in js)
check('HTML meta', f'application-version" content="{V}"' in index)
check('HTML visible', f'V{V}' in index)
check('Manifest version', f'"version": "{V}"' in manifest)
check('SW cache', f'mesheures-shell-v{V}' in sw)
check('Bridge version', f'\\"version\\":\\"{V}\\"' in main and f'return "{V}"' in main)
check('Secure WebView entry', 'ENTRY_URL = "https://" + DOMAIN + "/assets/web/index.html"' in hybrid and 'HybridCore.ENTRY_URL' in main)
check('Workflow version', f'Build MesHeures APK V{V}' in workflow and f'v{V}' in workflow)
check('Workflow APK verification', 'dump badging' in workflow and f"versionCode='{CODE}'" in workflow and f"versionName='{V}'" in workflow)
check('No old active runtime filenames', not any((ROOT/'app/src/main/assets/web/scripts'/n).exists() for n in ('app-v17.js','app-v18.js','app-v19.js')))
check('No old release label in workflow', 'v18.1.0' not in workflow and 'V20.3.0' not in workflow)
for name, ok in checks: print(('PASS' if ok else 'FAIL') + ': ' + name)
if not all(ok for _,ok in checks): sys.exit(1)
print(f'VERSION AUDIT: PASS — MesHeures V{V} / versionCode {CODE}')
