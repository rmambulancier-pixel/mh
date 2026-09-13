package com.mesheures.app.core;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

/**
 * MesHeures V20.5 Hybrid Core.
 *
 * Android owns WebView plumbing and local asset delivery. The JavaScript layer
 * remains the single source of truth for hours, payroll, legal checks and data.
 */
public final class HybridCore {
    public static final String VERSION = "20.5.0";
    public static final String DOMAIN = "appassets.androidplatform.net";
    public static final String ENTRY_URL = "https://" + DOMAIN + "/assets/web/index.html";

    private final WebViewAssetLoader assetLoader;

    public HybridCore(Context context) {
        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(DOMAIN)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(context))
                .build();
    }

    /** Handles normal WebView requests for packaged assets. */
    public WebResourceResponse intercept(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return null;
        return assetLoader.shouldInterceptRequest(request.getUrl());
    }

    /** Compatibility path for older WebView callback implementations. */
    public WebResourceResponse intercept(String url) {
        if (url == null) return null;
        return assetLoader.shouldInterceptRequest(Uri.parse(url));
    }

    /**
     * Service Worker requests do not necessarily travel through WebViewClient.
     * Register the same asset loader with the WebView Service Worker controller
     * when the installed WebView supports that feature.
     */
    private void configureServiceWorker() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) return;
        ServiceWorkerControllerCompat controller = ServiceWorkerControllerCompat.getInstance();
        controller.setServiceWorkerClient(new ServiceWorkerClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return intercept(request);
            }
        });
    }

    public boolean isAppAssetUrl(String url) {
        return url != null && url.startsWith("https://" + DOMAIN + "/assets/");
    }

    public void prepare(WebView webView) {
        if (webView == null) return;
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setAllowFileAccessFromFileURLs(false);
        webView.getSettings().setAllowUniversalAccessFromFileURLs(false);
        configureServiceWorker();
    }
}
