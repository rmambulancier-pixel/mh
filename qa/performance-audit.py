from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
main=(ROOT/'app/src/main/java/com/mesheures/app/MainActivity.java').read_text(encoding='utf-8')
hybrid=(ROOT/'app/src/main/java/com/mesheures/app/core/HybridCore.java').read_text(encoding='utf-8')
checks={
    'predictive back': 'OnBackPressedCallback' in main,
    'modern activity results': 'registerForActivityResult' in main and 'onActivityResult' not in main,
    'secure file access': 'setAllowFileAccess(false)' in main and 'setAllowContentAccess(false)' in main,
    'no database API': 'setDatabaseEnabled(true)' not in main and 'setDatabaseEnabled(true)' not in hybrid,
    'splash timer removed': 'dismissSplashSoon' not in main,
    'backup debounced': '2000' in main,
    'renderer recovery': 'onRenderProcessGone' in main,
    'edge-to-edge': 'enableEdgeToEdge' in main,
    'V24 smooth pointer swipe': 'app-v24.js' in (ROOT/'app/src/main/assets/web/index.html').read_text(encoding='utf-8') and 'requestAnimationFrame' in (ROOT/'app/src/main/assets/web/scripts/app-v24.js').read_text(encoding='utf-8'),
    'V24 shared store facade': 'MHStore' in (ROOT/'app/src/main/assets/web/scripts/app-v24.js').read_text(encoding='utf-8'),
    'adaptive activities': 'screenOrientation="portrait"' not in (ROOT/'app/src/main/AndroidManifest.xml').read_text(encoding='utf-8'),
}
for k,v in checks.items(): print(('PASS' if v else 'FAIL')+': '+k)
if not all(checks.values()): sys.exit(1)
print('PERFORMANCE AUDIT: PASS')
