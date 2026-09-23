package com.mesheures.app.core.engine

import android.content.Context
import com.mesheures.app.core.model.PayConfig
import com.mesheures.app.core.model.RomiReference
import com.mesheures.app.core.repository.AndroidMesHeuresRepository
import com.mesheures.app.core.storage.NativeStore
import java.time.LocalDate
import java.time.YearMonth

data class DashboardData(
    val monthLabel: String,
    val workCount: Int,
    val restCount: Int,
    val cpCount: Int,
    val malCount: Int,
    val tteJourMinutes: Int,
    val tteSemaineMinutes: Int,
    val tteMoisMinutes: Int,
    val ttePeriodeMinutes: Int,
    val hs25PeriodeMinutes: Int,
    val hs50PeriodeMinutes: Int,
    val margeAvant46hMinutes: Int,
    val rcRomiHours: Double,
    val rcLocalEquivHours: Double,
    val grossEstimate: Double,
    val netEstimate: Double,
    val nextDayLabel: String,
    val nextDayHours: String,
    val alertesMois: Int
)

object DashboardMetrics {
    fun build(context: Context, referenceDate: LocalDate = LocalDate.now()): DashboardData {
        val repo = AndroidMesHeuresRepository(context)
        val raw = NativeStore.rawDb(context)
        val cfg = PayConfig.fromRawDb(raw)
        val romi = RomiReference.fromRawDb(raw)

        val month = YearMonth.from(referenceDate)
        val monthDays = repo.getRange(month.atDay(1).toString(), month.atEndOfMonth().toString())
        val monthCalc = monthDays.map(WorkDayEngine::calculate)

        val work = monthDays.count { it.type == "T" || it.type == "NUIT" }
        val rest = monthDays.count { it.type == "REPOS" || it.type == "RC" }
        val cp = monthDays.count { it.type == "CP" }
        val mal = monthDays.count { it.type == "MAL" }

        val today = repo.getDay(referenceDate.toString())
        val tteDay = today?.let { WorkDayEngine.calculate(it).effectiveMinutes } ?: 0

        val weekStart = referenceDate.minusDays((referenceDate.dayOfWeek.value - 1).toLong())
        val weekEnd = weekStart.plusDays(6)
        val tteWeek = repo.getRange(weekStart.toString(), weekEnd.toString()).sumOf { WorkDayEngine.calculate(it).effectiveMinutes }
        val tteMonth = monthCalc.sumOf { it.effectiveMinutes }
        val alerts = monthCalc.sumOf { it.alerts.size }

        val per = raw.optJSONObject("per")
        val periodStart = per?.optString("start", "")?.takeIf { it.isNotBlank() } ?: referenceDate.minusDays(27).toString()
        val quatorzaines = (per?.optInt("nb", 2) ?: 2).coerceIn(1, 3)

        val aggregate = PeriodPayEngine.forRange(repo, cfg, periodStart, quatorzaines)
        val gross = PeriodPayEngine.grossBreakdown(aggregate, cfg)
        val net = PeriodPayEngine.netEstimate(gross, cfg)
        val rcLocal = PeriodPayEngine.rcLocalEquivalentHours(aggregate)
        val margin = (cfg.weeklyCeilingHours * 60).toInt() - tteWeek

        var nextLabel = "Aucune journée planifiée"
        var nextHours = ""
        for (offset in 0..30) {
            val date = referenceDate.plusDays(offset.toLong())
            val day = repo.getDay(date.toString()) ?: continue
            if ((day.type == "T" || day.type == "NUIT") && day.start != null) {
                nextLabel = date.toString()
                nextHours = "%02d:%02d".format(day.start / 60, day.start % 60) +
                    (day.end?.let { " → %02d:%02d".format(it / 60, it % 60) } ?: "")
                break
            }
        }

        return DashboardData(
            monthLabel = "${month.monthValue}/${month.year}",
            workCount = work,
            restCount = rest,
            cpCount = cp,
            malCount = mal,
            tteJourMinutes = tteDay,
            tteSemaineMinutes = tteWeek,
            tteMoisMinutes = tteMonth,
            ttePeriodeMinutes = aggregate.ttePeriodMinutes,
            hs25PeriodeMinutes = aggregate.hs25Minutes,
            hs50PeriodeMinutes = aggregate.hs50Minutes,
            margeAvant46hMinutes = margin,
            rcRomiHours = romi?.rcCumuleHours ?: 0.0,
            rcLocalEquivHours = rcLocal,
            grossEstimate = gross.total,
            netEstimate = net,
            nextDayLabel = nextLabel,
            nextDayHours = nextHours,
            alertesMois = alerts
        )
    }
}
