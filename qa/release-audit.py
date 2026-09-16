from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]; WEB=ROOT/'app/src/main/assets/web'; S=WEB/'scripts'
version=(ROOT/'VERSION').read_text().strip(); props={}
for line in (ROOT/'version.properties').read_text().splitlines():
    if '=' in line: k,v=line.split('=',1); props[k.strip()]=v.strip()
code=props.get('VERSION_CODE','')
def text(p): return p.read_text(encoding='utf-8')
index=text(WEB/'index.html'); manifest=text(WEB/'manifest.json'); sw=text(WEB/'sw.js'); build=text(ROOT/'app/build.gradle'); hybrid=text(ROOT/'app/src/main/java/com/mesheures/app/core/HybridCore.java'); main=text(ROOT/'app/src/main/java/com/mesheures/app/MainActivity.java'); workflow=text(ROOT/'.github/workflows/build-apk.yml'); backup=text(S/'app-backup.js'); v27=text(S/'app-v27.js'); v25=text(S/'app-v25.js')
checks=[]
def check(n,ok,d=''): checks.append((n,bool(ok),d))
check('Canonical VERSION',bool(re.fullmatch(r'\d+\.\d+\.\d+',version)))
check('Canonical VERSION_CODE',code.isdigit())
check('Release target',version=='27.0.0' and code=='2700')
check('Gradle reads canonical version',"file('../version.properties')" in build and 'releaseVersion' in build and 'releaseCode' in build)
check('Manifest web version',f'"version": "{version}"' in manifest)
check('HTML title/meta','MesHeures V27.0' in index and f'application-version" content="{version}"' in index)
check('V27 runtime referenced','scripts/app-v27.js' in index and (S/'app-v27.js').exists())
check('V27 stylesheet referenced','./style/v27.css' in index and (WEB/'style/v27.css').exists())
check('Service Worker cache version',f'mesheures-shell-v{version}' in sw)
check('Hybrid Core version',f'VERSION = "{version}"' in hybrid)
check('Secure WebView','WebViewAssetLoader' in hybrid and 'setAllowFileAccess(false)' in hybrid and 'setAllowContentAccess(false)' in hybrid)
check('Backup namespace',"BACKUP_VERSION='27.0.0'" in backup and "LS+'_v27_backup_'" in backup)
check('Backup compatibility','LS+\'_v26_backup_\'' in backup and 'LEGACY_V25_PREFIX' in backup and 'LEGACY_V24_PREFIX' in backup)
check('V27 reactive orchestrator','window.MH27' in v27 and 'requestAnimationFrame' in v27 and 'setTimeout(liveLoop,1000)' in v27 and 'window.tab=t=>window.MH27.navigate(t)' in v27)
check('V26 compatibility bridge','window.MH26' in text(S/'app-v26.js') and 'compat:true' in text(S/'app-v26.js'))
check('V25 live engine retained','DB.days' in v25 and 'startEpoch' in v25 and 'Date.now()' in v25)
check('Smart time retained','normalizeTimeInput' in v25 and 'data-time-smart' in v25)
# all local scripts in index and SW shell exist
idx_scripts=re.findall(r'<script\s+(?:[^>]*?)src=["\'](\./?scripts/[^"\']+)["\']',index)
shell=set(re.findall(r'["\'](\./[^"\']+)["\']',sw))
missing=[x for x in idx_scripts if not (WEB/(x[2:] if x.startswith('./') else x)).exists()]
uncached=[]
for x in idx_scripts:
    rel='./'+x[2:] if x.startswith('./') else './'+x
    if rel.split('?',1)[0] not in {a.split('?',1)[0] for a in shell}: uncached.append(rel)
check('Index scripts exist',not missing,','.join(missing)); check('Index scripts in SW shell',not uncached,','.join(uncached))
missing_shell=[a for a in shell if a.startswith('./') and not (WEB/a[2:].split('?',1)[0]).exists()]
check('SW shell assets exist',not missing_shell,','.join(sorted(set(missing_shell))))
check('Modern back dispatcher','OnBackPressedCallback' in main)
check('Modern Activity Result','registerForActivityResult' in main and 'onActivityResult' not in main)
check('No WebView database API','setDatabaseEnabled(true)' not in main and 'setDatabaseEnabled(true)' not in hybrid)
check('Android 17 target','targetSdk 37' in text(ROOT/'app/build.gradle') and 'compileSdk 37' in text(ROOT/'app/build.gradle'))
check('Application bootstrap','MesHeuresApplication' in main or (ROOT/'app/src/main/java/com/mesheures/app/MesHeuresApplication.java').exists())
for n,ok,d in checks: print(('PASS' if ok else 'FAIL')+': '+n+((' — '+d) if d else ''))
if not all(ok for _,ok,_ in checks): sys.exit(1)
print(f'RELEASE AUDIT: PASS — MesHeures V{version} / versionCode {code}')
