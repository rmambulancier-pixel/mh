from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'app/src/main/assets/web'
SCRIPTS = WEB / 'scripts'

version = (ROOT / 'VERSION').read_text(encoding='utf-8').strip()
props = {}
for line in (ROOT / 'version.properties').read_text(encoding='utf-8').splitlines():
    if '=' in line:
        k, v = line.split('=', 1)
        props[k.strip()] = v.strip()
code = props.get('VERSION_CODE', '')

checks = []
def check(name, ok, detail=''):
    checks.append((name, bool(ok), detail))

def text(path):
    return path.read_text(encoding='utf-8')

index = text(WEB / 'index.html')
manifest = text(WEB / 'manifest.json')
sw = text(WEB / 'sw.js')
build = text(ROOT / 'app/build.gradle')
hybrid = text(ROOT / 'app/src/main/java/com/mesheures/app/core/HybridCore.java')
main = text(ROOT / 'app/src/main/java/com/mesheures/app/MainActivity.java')
workflow = text(ROOT / '.github/workflows/build-apk.yml')
appjs = text(SCRIPTS / 'app.js')
app25 = text(SCRIPTS / 'app-v25.js')
backup = text(SCRIPTS / 'app-backup.js')

check('Canonical VERSION', bool(re.fullmatch(r'\d+\.\d+\.\d+', version)))
check('Canonical VERSION_CODE', code.isdigit())
check('Release target', version == '25.0.0' and code == '2500')
check('Gradle reads canonical version', "file('../version.properties')" in build and 'releaseVersion' in build and 'releaseCode' in build)
check('Gradle does not hardcode release number', "versionName '20.5.0'" not in build and 'versionCode 2050' not in build)
check('Manifest web version', f'"version": "{version}"' in manifest)
check('HTML title/meta', ('MesHeures V25.0' in index or f'MesHeures V{version}' in index) and f'application-version" content="{version}"' in index)
check('V25 Flow script referenced', ('scripts/app-v25.js' in index or './scripts/app-v25.js' in index) and (SCRIPTS/'app-v25.js').exists())
check('V25 stylesheet referenced', './style/v25.css' in index and (WEB/'style/v25.css').exists())
check('Service Worker cache version', f"mesheures-shell-v{version}" in sw)
check('Hybrid Core version', f'VERSION = "{version}"' in hybrid)
check('Hybrid secure entry', 'WebViewAssetLoader' in hybrid and 'ENTRY_URL = "https://" + DOMAIN + "/assets/web/index.html"' in hybrid)
check('Service Worker native interception', 'ServiceWorkerControllerCompat' in hybrid and 'ServiceWorkerClientCompat' in hybrid)
check('File access hardened', 'setAllowFileAccess(false)' in hybrid and 'setAllowContentAccess(false)' in hybrid and 'setAllowFileAccess(true)' not in main and 'setAllowContentAccess(true)' not in main)
check('Lifecycle backup guard', 'if (web == null || !webReady) return;' in main)
check('No legacy full-storage interval', 'setInterval(save, 30000)' not in main and 'setInterval(save,30000)' not in main)
check('Backup namespace current', "BACKUP_VERSION='25.0.0'" in backup and "LS+'_v25_backup_'" in backup)
check('Backup previous compatibility', "LS+'_v24_backup_'" in backup and "LS+'_v23_backup_'" in backup)
check('V25 live engine', 'window.MH25Live' in app25 and 'startEpoch' in app25 and 'cd(day())' in app25)
check('V25 automatic live tick', 'setInterval' in app25 and 'Live.render()' in app25)
check('V25 smart time input', 'normalizeTimeInput' in app25 and 'data-time-smart' in app25)
check('V25 compact navigation', 'Accueil' in app25 and 'Saisie' in app25 and 'Planning' in app25 and 'Paie' in app25 and 'Analyse' in app25)

# Every local script referenced by index must exist and be cached by the SW.
index_scripts = re.findall(r'<script\s+(?:[^>]*?)src=["\'](\./?scripts/[^"\']+)["\']', index)
shell_entries = set(re.findall(r"['\"](\./[^'\"]+)['\"]", sw))
missing_scripts = []
uncached_scripts = []
for src in index_scripts:
    rel = './' + src[2:] if src.startswith('./') else './' + src
    if not (WEB / rel[2:]).exists():
        missing_scripts.append(rel)
    if rel not in {x.split('?',1)[0] for x in shell_entries}:
        uncached_scripts.append(rel)
check('Index scripts exist', not missing_scripts, ', '.join(missing_scripts))
check('Index scripts in SW shell', not uncached_scripts, ', '.join(uncached_scripts))

# Every local SW shell entry must point at an existing asset.
missing_shell = []
for entry in shell_entries:
    clean = entry.split('?',1)[0]
    if clean.startswith('./') and not (WEB / clean[2:]).exists():
        missing_shell.append(clean)
check('SW shell assets exist', not missing_shell, ', '.join(sorted(set(missing_shell))))

# No old runtime filenames in the active web tree.
old_names = {'app-v17.js','app-v18.js','app-v19.js','pay-fix-v16.2.js','legal-v16.2.4.js'}
found_old = [str(p.relative_to(WEB)) for p in WEB.rglob('*') if p.is_file() and p.name in old_names]
check('No legacy runtime filenames', not found_old, ', '.join(found_old))

# No obsolete release labels in active UI/runtime files.
active_files = [p for p in WEB.rglob('*') if p.is_file() and p.suffix in {'.js','.html','.json','.css'} and 'data/' not in str(p.relative_to(WEB))]
combined = '\n'.join(text(p) for p in active_files)
for phrase in ['MesHeures V18', 'MesHeures V19', 'MesHeures V17', 'V18 Paie', 'Backup V18', 'sauvegarde renforcée V21']:
    check(f'No stale UI label: {phrase}', phrase not in combined)
for phrase in ['20.5.0', '20.4.0', '20.3.0']:
    check(f'No stale release literal {phrase}', phrase not in combined and phrase not in workflow)

check('Workflow derives release version', 'Read release version' in workflow and 'steps.version.outputs.version' in workflow)
check('Workflow reads plain VERSION file', 'tr -d \'\\r\\n\' < VERSION' in workflow or 'cat VERSION' in workflow)
check('Workflow runs release audit', 'python3 qa/release-audit.py' in workflow)
check('Workflow verifies built APK', 'dump badging' in workflow and 'steps.version.outputs.code' in workflow and 'steps.version.outputs.version' in workflow)
check('Workflow artifact is versioned dynamically', 'MesHeures-${{ steps.version.outputs.version }}' in workflow)
check('Modern back dispatcher', 'OnBackPressedCallback' in main and 'onBackPressed()' not in main)
check('Activity Result API', 'registerForActivityResult' in main and 'onActivityResult' not in main)
check('No WebView database API', 'setDatabaseEnabled(true)' not in main and 'setDatabaseEnabled(true)' not in hybrid)
check('Android 17 target', 'compileSdk 37' in build and 'targetSdk 37' in build)
check('V25 Application bootstrap', 'MesHeuresApplication' in main or (ROOT / 'app/src/main/java/com/mesheures/app/MesHeuresApplication.java').exists())

for name, ok, detail in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + name + (f' — {detail}' if detail and not ok else ''))

if not all(ok for _, ok, _ in checks):
    print('\nRELEASE AUDIT: FAIL')
    sys.exit(1)
print(f'\nRELEASE AUDIT: PASS — MesHeures V{version} / versionCode {code}')
