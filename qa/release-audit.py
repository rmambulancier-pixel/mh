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
backup = text(SCRIPTS / 'app-backup.js')

check('Canonical VERSION', bool(re.fullmatch(r'\d+\.\d+\.\d+', version)))
check('Canonical VERSION_CODE', code.isdigit())
check('Release target', version == '23.0.0' and code == '2300')
check('Gradle reads canonical version', "file('../version.properties')" in build and 'releaseVersion' in build and 'releaseCode' in build)
check('Gradle does not hardcode release number', "versionName '20.5.0'" not in build and 'versionCode 2050' not in build)
check('Manifest web version', f'"version": "{version}"' in manifest)
check('HTML title/meta', f'MesHeures V{version}' in index and f'application-version" content="{version}"' in index)
check('HTML visible version', f'>V{version}<' in index)
check('JS canonical version', f"const MH_V='{version}'" in appjs)
check('Service Worker cache version', f"mesheures-shell-v{version}" in sw)
check('Hybrid Core version', f'VERSION = "{version}"' in hybrid)
check('Hybrid secure entry', 'WebViewAssetLoader' in hybrid and 'ENTRY_URL = "https://" + DOMAIN + "/assets/web/index.html"' in hybrid)
check('Service Worker native interception', 'ServiceWorkerControllerCompat' in hybrid and 'ServiceWorkerClientCompat' in hybrid)
check('File access hardened', 'setAllowFileAccess(false)' in hybrid and 'setAllowContentAccess(false)' in hybrid and 'setAllowFileAccess(true)' not in main and 'setAllowContentAccess(true)' not in main)
check('Lifecycle backup guard', 'if (web == null || !webReady) return;' in main)
check('No legacy full-storage interval', 'setInterval(save, 30000)' not in main and 'setInterval(save,30000)' not in main)
check('Backup namespace current', "LS+'_v23_backup_'" in backup and "BACKUP_VERSION='23.0.0'" in backup)
check('Legacy backup compatibility', "LS+'_v18_backup_'" in backup and "LS+'_v17_backup_'" in backup)

# Every local script referenced by index must exist and be cached by the SW.
index_scripts = re.findall(r'<script\s+(?:[^>]*?)src="(\./scripts/[^\"]+)"', index)
shell_entries = set(re.findall(r"'([^']+)'", sw))
missing_scripts = []
uncached_scripts = []
for src in index_scripts:
    rel = src.split('?', 1)[0]
    if not (WEB / rel[2:]).exists():
        missing_scripts.append(rel)
    if rel not in {x.split('?',1)[0] for x in shell_entries}:
        uncached_scripts.append(rel)
check('Index scripts exist', not missing_scripts, ', '.join(missing_scripts))
check('Index scripts in SW shell', not uncached_scripts, ', '.join(uncached_scripts))

# Every local SW shell entry must point at an existing asset.
shell_local = []
for entry in shell_entries:
    if entry.startswith('./') and not entry.startswith('./style/'):
        shell_local.append(entry.split('?',1)[0])
missing_shell = [x for x in shell_local if not (WEB / x[2:]).exists()]
check('SW shell assets exist', not missing_shell, ', '.join(sorted(set(missing_shell))))

# No old runtime files anywhere in the packaged web tree.
old_names = {'app-v17.js','app-v18.js','app-v19.js','pay-fix-v16.2.js','legal-v16.2.4.js'}
found_old = [str(p.relative_to(WEB)) for p in WEB.rglob('*') if p.is_file() and p.name in old_names]
check('No legacy runtime filenames in active Web tree', not found_old, ', '.join(found_old))

# Old version labels may remain in compatibility namespaces/comments, but not as current UI labels.
active_files = [p for p in WEB.rglob('*') if p.is_file() and p.suffix in {'.js','.html','.json'}]
combined = '\n'.join(text(p) for p in active_files)
for phrase in [
    'MesHeures V18', 'MesHeures V19', 'MesHeures V17',
    'Contrôle légal V18', 'Intelligence V18', 'V18 Paie',
    'Backup V18', 'sauvegarde renforcée V21',
]:
    check(f'No stale UI label: {phrase}', phrase not in combined)
check('No stale release literal 20.5.0 in active Web tree', '20.5.0' not in combined)
check('No stale V20.5 UI label in active Web tree', 'V20.5' not in combined)
check('No stale release literal 20.4.0 in active Web tree', '20.4.0' not in combined)
check('No stale release literal 20.3.0 in workflow', '20.3.0' not in workflow)
check('Workflow derives release version', 'Read canonical release version' in workflow and 'GITHUB_ENV' in workflow and 'MESHEURES_VERSION' in workflow)
check('Workflow reads plain VERSION file', 'tr -d \'\\r\\n\' < VERSION' in workflow or 'cat VERSION' in workflow)
check('Workflow runs release audit', 'python3 qa/release-audit.py' in workflow)
check('Workflow verifies built APK', 'dump badging' in workflow and 'MESHEURES_VERSION_CODE' in workflow and 'MESHEURES_VERSION' in workflow)
check('Workflow artifact is versioned dynamically', 'MesHeures-APK-release-v${{ env.MESHEURES_VERSION }}' in workflow)
check('No hardcoded old artifact label', 'v18.1.0' not in workflow)
check('Modern back dispatcher', 'OnBackPressedCallback' in main and 'onBackPressed()' not in main)
check('Activity Result API', 'registerForActivityResult' in main and 'onActivityResult' not in main)
check('No WebView database API', 'setDatabaseEnabled(true)' not in main and 'setDatabaseEnabled(true)' not in hybrid)
check('Android 17 target', 'compileSdk 37' in build and 'targetSdk 37' in build)
check('V21 Application bootstrap', 'MesHeuresApplication' in main or 'MesHeuresApplication' in (ROOT / 'app/src/main/java/com/mesheures/app/MesHeuresApplication.java').read_text(encoding='utf-8'))

for name, ok, detail in checks:
    print(('PASS' if ok else 'FAIL') + ': ' + name + (f' — {detail}' if detail and not ok else ''))

if not all(ok for _, ok, _ in checks):
    print('\nRELEASE AUDIT: FAIL')
    sys.exit(1)
print(f'\nRELEASE AUDIT: PASS — MesHeures V{version} / versionCode {code}')
