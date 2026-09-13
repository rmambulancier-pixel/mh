package com.mesheures.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;

import com.mesheures.app.MainActivity;
import com.mesheures.app.R;

import org.json.JSONObject;

/** MesHeures widget: display-only cache. No legal/pay calculations run here. */
public class MhWidgetProvider extends AppWidgetProvider {
    public static final String PREFS = "mh_widget";
    public static final String KEY_PAYLOAD = "payload";
    public static final String ACTION_REFRESH = "com.mesheures.app.widget.REFRESH";

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null && ACTION_REFRESH.equals(intent.getAction())) refreshAll(context);
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) updateOne(context, manager, id);
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, MhWidgetProvider.class);
        for (int id : manager.getAppWidgetIds(name)) updateOne(context, manager, id);
    }

    private static void updateOne(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mesheures);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_PAYLOAD, null);

        String tte = "—", net = "—", week = "Semaine —", period = "14 j —";
        String margin = "Ouvre l'app pour synchroniser", updated = "";
        int dot = Color.parseColor("#68737D");

        if (raw != null) {
            try {
                JSONObject o = new JSONObject(raw);
                tte = formatMinutes(o.optInt("tteJourMin", 0));
                if (o.has("netEstimeCents") && !o.isNull("netEstimeCents"))
                    net = formatMoneyCents(o.optInt("netEstimeCents", 0));
                week = "Semaine " + formatMinutes(o.optInt("tteSemaineMin", 0));
                period = "14 j " + formatMinutes(o.optInt("ttePeriodeMin", 0));

                if (!o.has("margeAvant46hMin") || o.isNull("margeAvant46hMin")) {
                    margin = "Marge 46h : pas encore calculée";
                } else {
                    int m = o.optInt("margeAvant46hMin", Integer.MIN_VALUE);
                    if (m < 0) { margin = "Seuil 46h dépassé de " + formatMinutes(-m); dot = Color.parseColor("#C62828"); }
                    else if (m < 300) { margin = "Marge avant 46h : " + formatMinutes(m); dot = Color.parseColor("#9A6700"); }
                    else { margin = "Marge avant 46h : " + formatMinutes(m); dot = Color.parseColor("#16803C"); }
                }
                int alerts = o.optInt("alertesMois", 0);
                if (alerts > 0) margin += " · " + alerts + " alerte" + (alerts > 1 ? "s" : "") + " ce mois";
                String date = o.optString("dateISO", "");
                updated = date.isEmpty() ? "" : "Maj " + date;
            } catch (Exception e) {
                margin = "Données du widget invalides";
            }
        }

        views.setTextViewText(R.id.widget_tte, tte);
        views.setTextViewText(R.id.widget_net, net);
        views.setTextViewText(R.id.widget_week, week);
        views.setTextViewText(R.id.widget_period, period);
        views.setTextViewText(R.id.widget_marge, margin);
        views.setTextViewText(R.id.widget_updated, updated);
        views.setInt(R.id.widget_dot, "setColorFilter", dot);

        Intent open = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, openPi);

        Intent add = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        add.putExtra("mh_deeplink", "jour");
        PendingIntent addPi = PendingIntent.getActivity(context, widgetId, add, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_add, addPi);

        manager.updateAppWidget(widgetId, views);
    }

    private static String formatMinutes(int total) {
        int abs = Math.abs(total);
        return (total < 0 ? "-" : "") + (abs / 60) + "h" + String.format(java.util.Locale.FRANCE, "%02d", abs % 60);
    }
    private static String formatMoneyCents(int cents) {
        return String.format(java.util.Locale.FRANCE, "%.2f €", cents / 100.0);
    }
}
