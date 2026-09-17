from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]; WEB=ROOT/'app/src/main/assets/web'; S=WEB/'scripts'
main=(ROOT/'app/src/main/java/com/mesheures/app/MainActivity.java').read_text(); hybrid=(ROOT/'app/src/main/java/com/mesheures/app/core/HybridCore.java').read_text(); index=(WEB/'index.html').read_text(); manifest=(ROOT/'app/src/main/AndroidManifest.xml').read_text(); v27=(S/'app-v27.js').read_text()
v28=(S/'app-v28.js').read_text(); v25=(S/'app-v25.js').read_text(); sw=(WEB/'sw.js').read_text(); ui=(S/'app-ui.js').read_text(); parser=(S/'app-parser.js').read_text(); app=(S/'app.js').read_text()
checks={
'predictive back':'OnBackPressedCallback' in main,
'modern activity results':'registerForActivityResult' in main and 'onActivityResult' not in main,
'secure file access':'setAllowFileAccess(false)' in main and 'setAllowContentAccess(false)' in main,
'no database API':'setDatabaseEnabled(true)' not in main and 'setDatabaseEnabled(true)' not in hybrid,
'render process recovery':'onRenderProcessGone' in main,
'edge-to-edge':'enableEdgeToEdge' in main,
'V30 loaded':'scripts/app-v28.js' in index,
'V30 batched rendering':'requestAnimationFrame' in v28 and 'let raf=0' in v28,
'V30 adaptive live timer':'setTimeout(liveTick,15000)' in v28 and 'clearTimeout(liveTimer)' in v28 and 'stopLive' in v28,
'V30 navigation owner':'window.MH28' in v28 and 'window.tab=navigation' in v28 and 'activate(t)' in v28,
'V30 render gateway':"window.renderAll=function(){engine.invalidate('legacy-render');schedule('legacy-render');}" in v28 and all('window.renderAll=function' not in x for x in [v25,(S/'app-runtime.js').read_text(),(S/'app-intelligence.js').read_text(),(S/'app-evidence.js').read_text(),(S/'app-reconciliation.js').read_text()]),
'No mutation render bypass':'save();renderDay' not in ui and 'save();renderMonth' not in ui and 'save();renderPay' not in ui and 'save();renderRomiTab' not in parser and 'save();renderReg' not in app,
'Background trajectory recompute':'firstRiskFromSnapshot' in sw and 'pauseDueFromSnapshot' in sw,
'No periodic success spam':"Vérification en arrière-plan effectuée" not in sw,
'V25 live DB state':'DB.days' in v25 and 'startEpoch' in v25 and 'Date.now()' in v25,
'V25 canonical calculations':'cd(day())' in v25,
'V25 smart time entry':'normalizeTimeInput' in v25 and 'data-time-smart' in v25,
'adaptive activities':'screenOrientation="portrait"' not in manifest,
}
for k,v in checks.items(): print(('PASS' if v else 'FAIL')+': '+k)
if not all(checks.values()): sys.exit(1)
print('PERFORMANCE AUDIT: PASS')
