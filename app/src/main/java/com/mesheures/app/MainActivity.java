package com.mesheures.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.Settings;
import android.content.ContentResolver;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.mesheures.app.core.HybridCore;

import com.mesheures.app.widget.MhWidgetProvider;

public class MainActivity extends ComponentActivity {

    private WebView web;
    private WebView printWeb;
    private int pendingDocumentAction = 0; // 1=file chooser, 2=export
    private ValueCallback<Uri[]> uploadCallback;
    private String pendingExportName;
    private String pendingExportMime;
    private StringBuilder pendingExportContent;

    // V20 Hybrid Core: native Android owns secure asset delivery/interception.
    private HybridCore hybridCore;

    private com.mesheures.app.core.BackupManager backupManager;

    private String pendingDeepLink;
    private boolean webReady = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);

        backupManager = new com.mesheures.app.core.BackupManager(this);

        WindowCompat.enableEdgeToEdge(getWindow());
        getWindow().setStatusBarColor(0xFF07100D);
        getWindow().setNavigationBarColor(0xFF07100D);

        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.setBackgroundColor(0xFF07100D);

        web = new WebView(this);
        web.setBackgroundColor(0xFF07100D);

        root.addView(web, new android.widget.FrameLayout.LayoutParams(
            android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
            android.widget.FrameLayout.LayoutParams.MATCH_PARENT
        ));

        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        setContentView(root);
        setupWebView();
        installModernBack();

        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                Manifest.permission.POST_NOTIFICATIONS
            }, 77);
        }

        web.loadUrl(HybridCore.ENTRY_URL);

        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String link = intent.getStringExtra("mh_deeplink");
        if (link == null) return;
        pendingDeepLink = link;
        tryConsumeDeepLink();
    }

    private void tryConsumeDeepLink() {
        if (pendingDeepLink == null || !webReady || web == null) return;
        String link = pendingDeepLink;
        pendingDeepLink = null;
        if ("jour".equals(link)) {
            web.evaluateJavascript("(function(){try{"
                + "var k=(typeof today==='function')?today():null;"
                + "if(typeof mhOpenDay==='function'&&k)mhOpenDay(k);"
                + "}catch(e){}})();", null);
        }
    }

    private void setupWebView() {
        hybridCore = new HybridCore(this);
        hybridCore.prepare(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        // Keep the secure HybridCore policy: assets are served through WebViewAssetLoader.
        // File/content URL access is intentionally disabled for the main WebView.
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setOffscreenPreRaster(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = hybridCore.intercept(request);
                return local;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return hybridCore.intercept(url);
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                try {
                    android.view.ViewParent parent = view.getParent();
                    if (parent instanceof android.view.ViewGroup) ((android.view.ViewGroup) parent).removeView(view);
                    view.destroy();
                } catch (Exception ignored) {}
                web = null; webReady = false;
                if (!isFinishing()) recreate();
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                restoreLocalStorage();
                installAutoBackup();
                webReady = true;
                // Legacy: normal launch always lands on Accueil; widget deep-links remain explicit.
                if (pendingDeepLink == null) {
                    web.evaluateJavascript("(function(){try{if(typeof tab==='function')tab('home');}catch(e){}})();", null);
                }
                tryConsumeDeepLink();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                uploadCallback = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                pendingDocumentAction = 1;
                documentLauncher.launch(i);
                return true;
            }
        });

        web.addJavascriptInterface(new AndroidBridge(this), "MesHeuresAndroid");
    }

    private void installAutoBackup() {
        String js =
            "(function(){"
          + "if(window.__mesHeuresBackupInstalled)return;"
          + "window.__mesHeuresBackupInstalled=true;"
          + "var timer=null,last=null;"
          + "function snapshot(){var o={};"
          + "for(var i=0;i<localStorage.length;i++){"
          + "var k=localStorage.key(i);o[k]=localStorage.getItem(k);}"
          + "return JSON.stringify(o); }"
          + "function save(force){try{if(!window.MesHeuresAndroid)return;"
          + "var json=snapshot();if(!force&&json===last)return;"
          + "last=json;window.MesHeuresAndroid.saveLocalStorage(json);"
          + "}catch(e){}}"
          + "function schedule(){clearTimeout(timer);timer=setTimeout(function(){save(false);},2000);}"
          + "var st=localStorage.setItem,rm=localStorage.removeItem,cl=localStorage.clear;"
          + "localStorage.setItem=function(){var r=st.apply(this,arguments);schedule();return r;};"
          + "localStorage.removeItem=function(){var r=rm.apply(this,arguments);schedule();return r;};"
          + "localStorage.clear=function(){var r=cl.apply(this,arguments);schedule();return r;};"
          + ""
          + "document.addEventListener('visibilitychange',function(){"
          + "if(document.visibilityState==='hidden')save(true);});"
          + "window.addEventListener('pagehide',function(){save(true);});})();";
        web.evaluateJavascript(js, null);
    }

    private void restoreLocalStorage() {
        String snapshot = backupManager.load();
        if (snapshot == null || snapshot.isEmpty()) return;

        String escaped = snapshot
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\u2028", "\\u2028")
            .replace("\u2029", "\\u2029");

        String js =
            "(function(){try{var o=JSON.parse('" + escaped + "');"
          + "Object.keys(o).forEach(function(k){"
          + "if(localStorage.getItem(k)===null&&o[k]!==null)"
          + "localStorage.setItem(k,o[k]);"
          + "});}catch(e){}})();";
        web.evaluateJavascript(js, null);
    }

    @Override protected void onPause() {
        saveWebViewStorage();
        super.onPause();
    }

    @Override protected void onStop() {
        saveWebViewStorage();
        super.onStop();
    }

    private void saveWebViewStorage() {
        if (web == null || !webReady) return;
        String js =
            "(function(){try{var o={};"
          + "for(var i=0;i<localStorage.length;i++){"
          + "var k=localStorage.key(i);o[k]=localStorage.getItem(k);}"
          + "if(window.MesHeuresAndroid)"
          + "window.MesHeuresAndroid.saveLocalStorage(JSON.stringify(o));"
          + "}catch(e){}})();";
        web.evaluateJavascript(js, null);
    }

    private final ActivityResultLauncher<Intent> documentLauncher = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(), result -> {
            Intent data = result.getData();
            if (pendingDocumentAction == 1 && uploadCallback != null) {
                Uri[] uris = (result.getResultCode() == RESULT_OK && data != null)
                    ? WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), data) : null;
                uploadCallback.onReceiveValue(uris);
                uploadCallback = null;
            } else if (pendingDocumentAction == 2) {
                if (result.getResultCode() == RESULT_OK && data != null) writePendingExport(data.getData());
                else { pendingExportContent = null; pendingExportName = null; pendingExportMime = null; }
            }
            pendingDocumentAction = 0;
        });

    private void installModernBack() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (web != null && web.canGoBack()) web.goBack(); else finish();
            }
        });
    }

    private void openFileExportPicker() {
        try {
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(pendingExportMime == null ? "application/octet-stream" : pendingExportMime);
            i.putExtra(Intent.EXTRA_TITLE, pendingExportName == null ? "MesHeures-export" : pendingExportName);
            pendingDocumentAction = 2;
            documentLauncher.launch(i);
        } catch (Exception e) {
            Toast.makeText(this, "Enregistrement impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
            pendingExportContent = null;
        }
    }

    private void writePendingExport(Uri uri) {
        try {
            if (uri == null || pendingExportContent == null) throw new IllegalStateException("Export annulé");
            ContentResolver cr = getContentResolver();
            try (OutputStream out = cr.openOutputStream(uri)) {
                if (out == null) throw new IllegalStateException("Impossible d’ouvrir le fichier");
                out.write(pendingExportContent.toString().getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
            Toast.makeText(this, "✅ Fichier enregistré", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "❌ Enregistrement impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
        } finally {
            pendingExportContent = null; pendingExportName = null; pendingExportMime = null;
        }
    }

    public class AndroidBridge {
        private final Context c;
        AndroidBridge(Context x) { c = x; }

        @JavascriptInterface public String platform() { return "android"; }

        @JavascriptInterface
        public String capabilities() {
            return "{\"version\":\"21.0.0\",\"nativeDashboard\":true,\"widgetBridge\":true,\"fileExport\":true,\"print\":true}";
        }

        @JavascriptInterface
        public void openNativeDashboard() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(MainActivity.this, com.mesheures.app.nativeui.NativeDashboardActivity.class));
                } catch (Exception e) {
                    Toast.makeText(c, "Dashboard natif indisponible", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface public String version() { return "21.0.0"; }

        @JavascriptInterface
        public void setSystemBarsLight(boolean light) {
            runOnUiThread(() -> {
                try {
                    androidx.core.view.WindowInsetsControllerCompat c =
                        androidx.core.view.WindowCompat.getInsetsController(getWindow(), web);
                    if (c != null) {
                        c.setAppearanceLightStatusBars(light);
                        c.setAppearanceLightNavigationBars(light);
                    }
                    getWindow().setStatusBarColor(light ? 0xFFF5F7F9 : 0xFF07100D);
                    getWindow().setNavigationBarColor(light ? 0xFFF5F7F9 : 0xFF07100D);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void saveLocalStorage(String json) {
            if (json == null) return;
            backupManager.save(json);
        }

        @JavascriptInterface
        public void updateWidgetData(String json) {
            if (json == null || json.length() > 64_000) return;
            try {
                getSharedPreferences(MhWidgetProvider.PREFS, MODE_PRIVATE)
                    .edit().putString(MhWidgetProvider.KEY_PAYLOAD, json).commit();
            } catch (Exception ignored) {}
            runOnUiThread(() -> { try { MhWidgetProvider.refreshAll(MainActivity.this); } catch (Exception ignored) {} });
        }

        @JavascriptInterface
        public boolean beginFileExport(String filename, String mime) {
            try {
                pendingExportName = filename;
                pendingExportMime = mime;
                pendingExportContent = new StringBuilder();
                return true;
            } catch (Exception e) {
                pendingExportContent = null;
                return false;
            }
        }

        @JavascriptInterface
        public void appendFileExportChunk(String chunk) {
            if (pendingExportContent != null && chunk != null) pendingExportContent.append(chunk);
        }

        @JavascriptInterface
        public void finishFileExport() {
            if (pendingExportContent == null) return;
            runOnUiThread(() -> openFileExportPicker());
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                try {
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (pm == null) {
                        Toast.makeText(c, "Impression indisponible", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    PrintDocumentAdapter adapter = web.createPrintDocumentAdapter("MesHeures");
                    pm.print("MesHeures", adapter, new PrintAttributes.Builder().build());
                } catch (Exception e) {
                    Toast.makeText(c, "Impression impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void printHtml(String html) {
            runOnUiThread(() -> {
                try {
                    if (html == null || html.length() > 2_000_000) {
                        Toast.makeText(c, "Document trop volumineux", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    if (printWeb != null) {
                        try { ((android.view.ViewGroup) printWeb.getParent()).removeView(printWeb); } catch (Exception ignored) {}
                        printWeb.destroy();
                    }
                    printWeb = new WebView(MainActivity.this);
                    printWeb.getSettings().setJavaScriptEnabled(false);
                    printWeb.setBackgroundColor(android.graphics.Color.WHITE);
                    printWeb.setWebViewClient(new WebViewClient() {
                        @Override public void onPageFinished(WebView view, String url) {
                            try {
                                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                if (pm == null) throw new IllegalStateException("Impression indisponible");
                                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter("MesHeures-dossier");
                                pm.print("MesHeures — Dossier", adapter, new PrintAttributes.Builder().build());
                            } catch (Exception e) {
                                Toast.makeText(c, "Impression impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
                            }
                        }
                    });
                    android.widget.FrameLayout root = (android.widget.FrameLayout) web.getParent();
                    root.addView(printWeb, new android.widget.FrameLayout.LayoutParams(1, 1));
                    printWeb.loadDataWithBaseURL("file:///android_asset/web/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    Toast.makeText(c, "Impression impossible : " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void toast(String msg) {
            runOnUiThread(() ->
                Toast.makeText(c, msg, Toast.LENGTH_SHORT).show()
            );
        }

        @JavascriptInterface
        public void openSettings() {
            startActivity(new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getPackageName())
            ));
        }

    }
    @Override protected void onDestroy() {
        if (web != null) { try { web.stopLoading(); web.loadUrl("about:blank"); } catch (Exception ignored) {} try { web.destroy(); } catch (Exception ignored) {} web = null; }
        if (printWeb != null) { try { printWeb.destroy(); } catch (Exception ignored) {} printWeb = null; }
        super.onDestroy();
    }

}
