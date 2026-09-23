package com.mesheures.app.widget

import android.content.Context
import com.mesheures.app.core.engine.DashboardMetrics
import org.json.JSONObject
import java.time.LocalDate

object WidgetPayloadWriter {
    fun write(context: Context) {
        val today = LocalDate.now()
        val data = DashboardMetrics.build(context, today)
        val payload = JSONObject().apply {
            put("version", "37.0.0")
            put("source", "Repository natif")
            put("monthLabel", data.monthLabel)
            put("dayIndex", today.dayOfMonth)
            put("monthDays", today.lengthOfMonth())
            put("tteJourMin", data.tteJourMinutes)
            put("tteMoisMin", data.tteMoisMinutes)
            put("tteSemaineMin", data.tteSemaineMinutes)
            put("ttePeriodeMin", data.ttePeriodeMinutes)
            put("hs25PeriodeMin", data.hs25PeriodeMinutes)
            put("hs50PeriodeMin", data.hs50PeriodeMinutes)
            put("workCount", data.workCount)
            put("restCount", data.restCount)
            put("cpCount", data.cpCount)
            put("malCount", data.malCount)
            put("alertesMois", data.alertesMois)
            put("grossCents", Math.round(data.grossEstimate * 100))
            put("netCents", Math.round(data.netEstimate * 100))
            put("netLabel", "Net estimé")
            put("rcSoldeMin", Math.round(data.rcRomiHours * 60))
            put("nextDayLabel", data.nextDayLabel)
            put("nextDayHours", data.nextDayHours)
            put("margeAvant46hMin", data.margeAvant46hMinutes)
            put("timerRunning", false)
        }
        context.getSharedPreferences(MhWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit().putString(MhWidgetProvider.KEY_PAYLOAD, payload.toString()).apply()
        MhWidgetProvider.refreshAll(context)
    }
}
