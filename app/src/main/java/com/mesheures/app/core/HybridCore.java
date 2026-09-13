package com.mesheures.app.core;

import android.content.Context;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import androidx.webkit.WebViewAssetLoader;

/**
 * MesHeures V20 — Hybrid Core.
 *
 * Native shell owns WebView plumbing and asset delivery; the existing JavaScript
 * application remains the single source of truth for business rules and UI.
 * No payroll/legal calculation is duplicated here.
 */
public final class HybridCore {
    public static final String DOMAIN = "appassets.androidplatform.net";
    public static final String ENTRY_URL = "https://" + DOMAIN + "/assets/web/index.html";

    private final WebViewAssetLoader assetLoader;

    public HybridCore(Context context) {
        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(DOMAIN)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(context))
                .build();
    }

    /** Intercepts only the appassets origin; everything else follows WebView defaults. */
    public WebResourceResponse intercept(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return null;
        return assetLoader.shouldInterceptRequest(request.getUrl());
    }

    /** Compatibility path for older WebView callback implementations. */
    public WebResourceResponse intercept(String url) {
        if (url == null) return null;
        return assetLoader.shouldInterceptRequest(android.net.Uri.parse(url));
    }

    public boolean isAppAssetUrl(String url) {
        return url != null && url.startsWith("https://" + DOMAIN + "/assets/");
    }

    public void prepare(WebView webView) {
        if (webView == null) return;
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(true);
    }
}
