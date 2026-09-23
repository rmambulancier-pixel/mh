package com.mesheures.app.core.engine

import com.mesheures.app.core.model.DayRecord
import com.mesheures.app.core.model.PayConfig
import java.time.LocalDate

data class PayDayResult(
    val seuilMinutes: Int = 0,
    val panierExterieur: Boolean = false,
    val panierInterieur: Boolean = false,
    val rcMinutes: Int = 0,
    val holidayMinutes: Int = 0,
    val sunday: Boolean = false,
    val nightMinutes: Int = 0
)

object PayDayCalculator {
    fun calculate(day: DayRecord, cfg: PayConfig): PayDayResult {
        val calc = WorkDayEngine.calculate(day)
        val sunday = try { LocalDate.parse(day.date).dayOfWeek.value == 7 } catch (_: Exception) { false }

        return when (day.type) {
            "T", "NUIT" -> {
                var ext = false
                var ent = false
                when (day.panier) {
                    "EXT" -> ext = true
                    "ENT" -> ent = true
                    "NON" -> Unit
                    else -> {
                        val coversMealWindow = day.start != null && day.end != null &&
                            day.start <= (11 * 60 + 45) &&
                            day.end >= (14 * 60 + 15)
                        if (coversMealWindow) {
                            if (day.pauses.any { it.type == "ENT" }) ent = true else ext = true
                        }
                    }
                }
                PayDayResult(
                    seuilMinutes = calc.effectiveMinutes,
                    panierExterieur = ext,
                    panierInterieur = ent,
                    holidayMinutes = if (day.holiday) calc.effectiveMinutes else 0,
                    sunday = sunday && day.type == "T",
                    nightMinutes = nightMinutes(day, cfg)
                )
            }
            "RC" -> PayDayResult(rcMinutes = cfg.rcDayMinutes, sunday = sunday)
            "CP" -> PayDayResult(sunday = sunday)
            else -> PayDayResult(sunday = sunday)
        }
    }

    private fun nightMinutes(day: DayRecord, cfg: PayConfig): Int {
        if (cfg.nuitMajPercent <= 0.0 || day.start == null || day.end == null) return 0
        val start = day.start
        var end = day.end
        if (end <= start) end += 1440
        val nightStart = parseTime(cfg.nuitDeb) ?: return 0
        val nightEnd = parseTime(cfg.nuitFin) ?: return 0
        var count = 0
        for (minute in start until end) {
            val m = minute % 1440
            if (m >= nightStart || m < nightEnd) count++
        }
        return count
    }

    private fun parseTime(value: String): Int? {
        val p = value.split(":")
        if (p.size != 2) return null
        return p[0].toIntOrNull()?.times(60)?.plus(p[1].toIntOrNull() ?: return null)
    }
}
