package com.mesheures.app.core.engine

import com.mesheures.app.core.model.DayRecord
import com.mesheures.app.core.model.PayConfig
import com.mesheures.app.core.repository.MesHeuresRepository
import java.time.LocalDate

data class PeriodAggregate(
    val ttePeriodMinutes: Int = 0,
    val amplitudePeriodMinutes: Int = 0,
    val normalMinutes: Int = 0,
    val hs25Minutes: Int = 0,
    val hs50Minutes: Int = 0,
    val idajMinutes: Int = 0,
    val holidayMinutes: Int = 0,
    val rcMinutes: Int = 0,
    val habillageMinutes: Int = 0,
    val nightMinutes: Int = 0,
    val sundayCount: Int = 0,
    val presenceDays: Int = 0,
    val panierExterieurCount: Int = 0,
    val panierInterieurCount: Int = 0
)

data class GrossLine(val label: String, val baseLabel: String, val rateLabel: String, val amount: Double)
data class GrossBreakdown(val lines: List<GrossLine>, val total: Double)

object PeriodPayEngine {
    fun splitOvertime(seuilMinutes: Int, cfg: PayConfig): Triple<Int, Int, Int> {
        val normalCap = (cfg.baseHoursPerWeek * 120).toInt()
        val normal = minOf(seuilMinutes, normalCap)
        val hs25Cap = (cfg.hs25CapHoursPerQuatorzaine * 60).toInt()
        val hs25 = (seuilMinutes - normalCap).coerceIn(0, hs25Cap)
        val hs50 = maxOf(seuilMinutes - normalCap - hs25Cap, 0)
        return Triple(normal, hs25, hs50)
    }

    fun aggregate(quatorzaines: List<Int>, days: List<Pair<DayRecord, PayDayResult>>, cfg: PayConfig): PeriodAggregate {
        var normal = 0
        var hs25 = 0
        var hs50 = 0
        quatorzaines.forEach { minutes ->
            val (n, h25, h50) = splitOvertime(minutes, cfg)
            normal += n
            hs25 += h25
            hs50 += h50
        }

        var tte = 0
        var amplitude = 0
        var idaj = 0
        var holiday = 0
        var rc = 0
        var night = 0
        var sunday = 0
        var presence = 0
        var ext = 0
        var ent = 0

        days.forEach { (day, result) ->
            if (day.type == "T" || day.type == "NUIT") {
                val calc = WorkDayEngine.calculate(day)
                tte += calc.effectiveMinutes
                amplitude += calc.amplitudeMinutes
                idaj += calc.idajMinutes
                presence++
            }
            holiday += result.holidayMinutes
            rc += result.rcMinutes
            night += result.nightMinutes
            if (result.sunday) sunday++
            if (result.panierExterieur) ext++
            if (result.panierInterieur) ent++
        }

        return PeriodAggregate(
            ttePeriodMinutes = tte,
            amplitudePeriodMinutes = amplitude,
            normalMinutes = normal,
            hs25Minutes = hs25,
            hs50Minutes = hs50,
            idajMinutes = idaj,
            holidayMinutes = holiday,
            rcMinutes = rc,
            habillageMinutes = presence * cfg.habillageMinutesPerDay,
            nightMinutes = night,
            sundayCount = sunday,
            presenceDays = presence,
            panierExterieurCount = ext,
            panierInterieurCount = ent
        )
    }

    fun forRange(repo: MesHeuresRepository, cfg: PayConfig, start: String, quatorzaines: Int): PeriodAggregate {
        val first = LocalDate.parse(start)
        val days = mutableListOf<Pair<DayRecord, PayDayResult>>()
        val q = mutableListOf<Int>()

        repeat(quatorzaines) { index ->
            var threshold = 0
            repeat(14) { offset ->
                val date = first.plusDays((index * 14 + offset).toLong()).toString()
                val day = repo.getDay(date) ?: DayRecord(date = date)
                val result = PayDayCalculator.calculate(day, cfg)
                threshold += result.seuilMinutes
                days += day to result
            }
            q += threshold
        }
        return aggregate(q, days, cfg)
    }

    fun grossBreakdown(agg: PeriodAggregate, cfg: PayConfig): GrossBreakdown {
        val rate = cfg.hourlyRate
        val lines = mutableListOf<GrossLine>()
        lines += GrossLine("Heures normales", hm(agg.normalMinutes), "%.2f €/h".format(rate), agg.normalMinutes / 60.0 * rate)
        if (agg.hs25Minutes > 0) lines += GrossLine("HS 25 %", hm(agg.hs25Minutes), "%.2f €/h".format(rate * 1.25), agg.hs25Minutes / 60.0 * rate * 1.25)
        if (agg.hs50Minutes > 0) lines += GrossLine("HS 50 %", hm(agg.hs50Minutes), "%.2f €/h".format(rate * 1.50), agg.hs50Minutes / 60.0 * rate * 1.50)
        if (agg.holidayMinutes > 0) lines += GrossLine("Majoration fériés", hm(agg.holidayMinutes), "%.2f €/h".format(rate), agg.holidayMinutes / 60.0 * rate)
        if (agg.rcMinutes > 0) lines += GrossLine("Repos compensateur", hm(agg.rcMinutes), "%.2f €/h".format(rate), agg.rcMinutes / 60.0 * rate)
        if (agg.habillageMinutes > 0) lines += GrossLine("Habillage/déshabillage", hm(agg.habillageMinutes), "%.4f €/h".format(cfg.habillageRate), agg.habillageMinutes / 60.0 * cfg.habillageRate)
        if (agg.idajMinutes > 0) lines += GrossLine("IDAJ", hm(agg.idajMinutes), "%.2f €/h".format(rate), agg.idajMinutes / 60.0 * rate)
        if (agg.sundayCount > 0 && cfg.dimPrime > 0) lines += GrossLine("Prime dimanche", "${agg.sundayCount} dim.", "%.2f €/dim.".format(cfg.dimPrime), agg.sundayCount * cfg.dimPrime)
        if (agg.nightMinutes > 0 && cfg.nuitMajPercent > 0) lines += GrossLine("Majoration nuit", hm(agg.nightMinutes), "${cfg.nuitMajPercent}%", agg.nightMinutes / 60.0 * rate * cfg.nuitMajPercent / 100.0)

        val beforeAnc = lines.sumOf { it.amount }
        val anc = cfg.ancienneteRatePercent()
        if (anc > 0) lines += GrossLine("Prime d'ancienneté", "$anc %", "sur brut", beforeAnc * anc / 100.0)

        return GrossBreakdown(lines, lines.sumOf { it.amount })
    }

    fun netEstimate(gross: GrossBreakdown, cfg: PayConfig): Double = gross.total * cfg.netRatio

    fun rcLocalEquivalentHours(agg: PeriodAggregate): Double =
        agg.hs25Minutes / 60.0 * 1.25 + agg.hs50Minutes / 60.0 * 1.50

    private fun hm(minutes: Int): String = "%dh%02d".format(minutes / 60, minutes % 60)
}
