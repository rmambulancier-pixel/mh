from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
V='20.3.0'; C='2030'
checks=[]
def c(n,ok): checks.append((n,ok))
b=(ROOT/'app/build.gradle').read_text()
j=(ROOT/'app/src/main/assets/web/scripts/app.js').read_text()
m=(ROOT/'app/src/main/assets/web/manifest.json').read_text()
sw=(ROOT/'app/src/main/assets/web/sw.js').read_text()
i=(ROOT/'app/src/main/assets/web/index.html').read_text()
a=(ROOT/'app/src/main/java/com/mesheures/app/MainActivity.java').read_text()
h=(ROOT/'app/src/main/java/com/mesheures/app/core/HybridCore.java').read_text()
c('Gradle code',f'versionCode {C}' in b)
c('Gradle name',f"versionName '{V}'" in b)
c('JS MH_V',f"MH_V='{V}'" in j)
c('manifest',f'"version": "{V}"' in m)
c('SW cache',f"mesheures-shell-v{V}" in sw)
c('SW CSS',f'refonte.css?v={V}' in sw)
c('HTML meta',f'application-version" content="{V}"' in i)
c('HTML visible',f'V{V}' in i)
c('bridge capabilities',f'\\"version\\":\\"{V}\\"' in a)
c('bridge version',f'return "{V}"' in a)
c('secure entry',f'ENTRY_URL = "https://" + DOMAIN + "/assets/web/index.html"' in h and 'HybridCore.ENTRY_URL' in a)
for n,ok in checks: print(('PASS' if ok else 'FAIL')+': '+n)
if not all(ok for _,ok in checks): sys.exit(1)
print(f'VERSION AUDIT: PASS — MesHeures V{V} / versionCode {C}')
