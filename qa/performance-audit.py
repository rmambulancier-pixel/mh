from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]; WEB=ROOT/'app/src/main/assets/web'; S=WEB/'scripts'
main=(ROOT/'app/src/main/java/com/mesheures/app/MainActivity.java').read_text(); hybrid=(ROOT/'app/src/main/java/com/mesheures/app/core/HybridCore.java').read_text(); index=(WEB/'index.html').read_text(); manifest=(ROOT/'app/src/main/AndroidManifest.xml').read_text(); v27=(S/'app-v27.js').read_text(); v25=(S/'app-v25.js').read_text()
checks={
'predictive back':'OnBackPressedCallback' in main,
'modern activity results':'registerForActivityResult' in main and 'onActivityResult' not in main,
'secure file access':'setAllowFileAccess(false)' in main and 'setAllowContentAccess(false)' in main,
'no database API':'setDatabaseEnabled(true)' not in main and 'setDatabaseEnabled(true)' not in hybrid,
'render process recovery':'onRenderProcessGone' in main,
'edge-to-edge':'enableEdgeToEdge' in main,
'V27 loaded':'scripts/app-v27.js' in index,
'V27 batched rendering':'requestAnimationFrame' in v27 and 'let raf=0' in v27,
'V27 adaptive live timer':'setTimeout(liveLoop,1000)' in v27 and 'clearTimeout(liveTimer)' in v27 and 'stopLive' in v27,
'V27 navigation owner':'window.MH27' in v27 and 'window.tab=t=>window.MH27.navigate(t)' in v27,
'V25 live DB state':'DB.days' in v25 and 'startEpoch' in v25 and 'Date.now()' in v25,
'V25 canonical calculations':'cd(day())' in v25,
'V25 smart time entry':'normalizeTimeInput' in v25 and 'data-time-smart' in v25,
'adaptive activities':'screenOrientation="portrait"' not in manifest,
}
for k,v in checks.items(): print(('PASS' if v else 'FAIL')+': '+k)
if not all(checks.values()): sys.exit(1)
print('PERFORMANCE AUDIT: PASS')
