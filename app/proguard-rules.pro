# MesHeures V18.1 — JS bridge methods are invoked reflectively by WebView.
-keepclassmembers class com.mesheures.app.MainActivity$AndroidBridge {
    <methods>;
}
-keep class com.mesheures.app.widget.MhWidgetProvider { *; }
