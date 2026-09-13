package com.mesheures.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.mesheures.app.widget.MhWidgetProvider;

public class MainActivity extends Activity {

    private WebView web;
    private WebView printWeb;
    private static final int FILE_PICKER = 42;
    private static final int FILE_EXPORT = 43;
    private ValueCallback<Uri[]> uploadCallback;
    private String pendingExportName;
    private String pendingExportMime;
    private StringBuilder pendingExportContent;

    private static final String PREFS = "mesheures_android_backup";
    private static final String STORAGE_KEY = "local_storage_snapshot";
    private SharedPreferences backupPrefs;

    private String pendingDeepLink;
    private boolean webReady = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);

        backupPrefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
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

        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                Manifest.permission.POST_NOTIFICATIONS
            }, 77);
        }

        web.loadUrl("file:///android_asset/web/index.html");

        // V18.0.17: the splash must never depend on window.onload or CDN completion.
        // WebView can execute this while deferred external resources are still pending.
        dismissSplashSoon();

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

    private void dismissSplashSoon() {
        Runnable hide = () -> web.evaluateJavascript(
            "(function(){try{var s=document.getElementById('mhSplash');if(s){s.classList.add('off');s.style.opacity='0';s.style.visibility='hidden';s.style.pointerEvents='none';}}catch(e){}})();",
            null
        );
        web.postDelayed(hide, 250);
        web.postDelayed(hide, 700);
        web.postDelayed(hide, 1500);
        web.postDelayed(hide, 3000);
    }

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                dismissSplashSoon();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                dismissSplashSoon();
                restoreLocalStorage();
                installAutoBackup();
                webReady = true;
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
                startActivityForResult(i, FILE_PICKER);
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
          + "function save(){try{var o={};"
          + "for(var i=0;i<localStorage.length;i++){"
          + "var k=localStorage.key(i);o[k]=localStorage.getItem(k);}"
          + "if(window.MesHeuresAndroid)"
          + "window.MesHeuresAndroid.saveLocalStorage(JSON.stringify(o));"
          + "}catch(e){}}"
          + "setTimeout(save,3000);setInterval(save,30000);"
          + "document.addEventListener('visibilitychange',function(){"
          + "if(document.visibilityState==='hidden')save();});"
          + "window.addEventListener('pagehide',save);})();";
        web.evaluateJavascript(js, null);
    }

    private void restoreLocalStorage() {
        String snapshot = backupPrefs.getString(STORAGE_KEY, null);
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
        if (web == null) return;
        String js =
            "(function(){try{var o={};"
          + "for(var i=0;i<localStorage.length;i++){"
          + "var k=localStorage.key(i);o[k]=localStorage.getItem(k);}"
          + "if(window.MesHeuresAndroid)"
          + "window.MesHeuresAndroid.saveLocalStorage(JSON.stringify(o));"
          + "}catch(e){}})();";
        web.evaluateJavascript(js, null);
    }

    @Override protected void onActivityResult(
            int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_PICKER && uploadCallback != null) {
            uploadCallback.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            );
            uploadCallback = null;
        } else if (requestCode == FILE_EXPORT) {
            if (resultCode == RESULT_OK && data != null) writePendingExport(data.getData());
            else { pendingExportContent = null; pendingExportName = null; pendingExportMime = null; }
        }
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private void openFileExportPicker() {
        try {
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(pendingExportMime == null ? "application/octet-stream" : pendingExportMime);
            i.putExtra(Intent.EXTRA_TITLE, pendingExportName == null ? "MesHeures-export" : pendingExportName);
            startActivityForResult(i, FILE_EXPORT);
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

        @JavascriptInterface public String version() { return "18.0.17"; }

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
            backupPrefs.edit().putString(STORAGE_KEY, json).apply();
        }

        @JavascriptInterface
        public void updateWidgetData(String json) {
            if (json == null) return;
            SharedPreferences widgetPrefs = getSharedPreferences(MhWidgetProvider.PREFS, MODE_PRIVATE);
            widgetPrefs.edit().putString(MhWidgetProvider.KEY_PAYLOAD, json).apply();
            Intent refresh = new Intent(MainActivity.this, MhWidgetProvider.class);
            refresh.setAction(MhWidgetProvider.ACTION_REFRESH);
            sendBroadcast(refresh);
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

        @JavascriptInterface
        public void requestCamera() {
            if (Build.VERSION.SDK_INT >= 23
                    && checkSelfPermission(Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{
                    Manifest.permission.CAMERA
                }, 78);
            }
        }

        @JavascriptInterface
        public boolean cameraGranted() {
            return Build.VERSION.SDK_INT < 23
                || checkSelfPermission(Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED;
        }
    }
}
