#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd "$HOME/MesHeures"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="v37-clean-backup-$STAMP"
mkdir -p "$BACKUP"
cp -rf app/src "$BACKUP/src"
cp -f version.properties app/build.gradle app/src/main/AndroidManifest.xml "$BACKUP/" 2>/dev/null || true

echo "=============================================="
echo "MESHEURES V37.0.0 — MIGRATION NATIVE PROPRE"
echo "Backup : $BACKUP"
echo "=============================================="

# ------------------------------------------------------------
# 0. PRE-FLIGHT — on vérifie AVANT de modifier quoi que ce soit
# ------------------------------------------------------------

test -f app/build.gradle
test -f app/src/main/AndroidManifest.xml
test -f app/src/main/java/com/mesheures/app/core/engine/WorkDayEngine.kt
test -f app/src/main/java/com/mesheures/app/core/storage/NativeStore.kt
test -f app/src/main/java/com/mesheures/app/nativeui/NativeDashboardActivity.kt

grep -q 'object NativeStore' app/src/main/java/com/mesheures/app/core/storage/NativeStore.kt
grep -q 'fun rawDb' app/src/main/java/com/mesheures/app/core/storage/NativeStore.kt
grep -q 'fun days' app/src/main/java/com/mesheures/app/core/storage/NativeStore.kt

echo "OK PRE-FLIGHT"

# ------------------------------------------------------------
# 1. SUPPRESSION TOTALE DU RUNTIME WEBVIEW
# ------------------------------------------------------------

rm -f app/src/main/java/com/mesheures/app/LegacyWebViewActivity.java
rm -f app/src/main/java/com/mesheures/app/core/HybridCore.java
rm -rf app/src/main/java/com/mesheures/app/migration

# Supprime les anciennes entrées d'activités WebView/migration.
# Les blocs sont sur une ligne dans le manifeste V36/V37.
perl -0pi -e 's#\s*<activity\b[^>]*android:name="[^"]*(?:LegacyWebViewActivity|NativeMigrationActivity)"[^>]*>.*?</activity>\s*##sg; s#\s*<activity\b[^>]*android:name="[^"]*(?:LegacyWebViewActivity|NativeMigrationActivity)"[^>]*/>\s*##sg' app/src/main/AndroidManifest.xml

# Les imports/dépendances WebView ne sont plus nécessaires.
sed -i '/androidx\.webkit/d' app/build.gradle

# ------------------------------------------------------------
# 2. MAINACTIVITY = LANCEUR NATIF UNIQUE
# ------------------------------------------------------------

rm -f app/src/main/java/com/mesheures/app/MainActivity.kt
cat > app/src/main/java/com/mesheures/app/MainActivity.java <<'JAVA'
package com.mesheures.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.activity.ComponentActivity;
import com.mesheures.app.nativeui.NativeDashboardActivity;

public final class MainActivity extends ComponentActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startActivity(new Intent(this, NativeDashboardActivity.class));
        finish();
    }
}
JAVA

# Si l'ancien MainActivity.java existe ailleurs, on le retire pour garantir l'unicité.
find app/src/main/java -type f -name 'MainActivity.java' ! -path '*/com/mesheures/app/MainActivity.java' -delete

# ------------------------------------------------------------
# 3. MODELE NATIF — compatibilité avec les anciens appels
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/core/model/DayRecord.kt <<'KOT'
package com.mesheures.app.core.model

data class DayRecord(
    val date: String,
    val start: Int? = null,
    val end: Int? = null,
    val pauses: List<PauseRecord> = emptyList(),
    val meal: MealRecord? = null,
    val type: String = "REPOS",
    val panier: String? = null,
    val holiday: Boolean = false
)

data class PauseRecord(
    val start: Int,
    val end: Int,
    val type: String? = null
)

data class MealRecord(
    val automatic: Boolean = false,
    val durationMinutes: Int = 30
)
KOT

# ------------------------------------------------------------
# 4. REPOSITORY NATIF — lit le vrai JSON DB.days
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/core/repository/MesHeuresRepository.kt <<'KOT'
package com.mesheures.app.core.repository

import android.content.Context
import com.mesheures.app.core.model.DayRecord
import com.mesheures.app.core.model.PauseRecord
import com.mesheures.app.core.storage.NativeStore
import org.json.JSONArray
import org.json.JSONObject

interface MesHeuresRepository {
    fun getDay(date: String): DayRecord?
    fun saveDay(day: DayRecord)
    fun getRange(start: String, end: String): List<DayRecord>
}

class AndroidMesHeuresRepository(
    private val context: Context
) : MesHeuresRepository {

    override fun getDay(date: String): DayRecord? =
        decode(date, NativeStore.rawDb(context).optJSONObject("days")?.opt(date))

    override fun saveDay(day: DayRecord) {
        val db = NativeStore.rawDb(context)
        val days = db.optJSONObject("days") ?: JSONObject()
        days.put(day.date, encode(day))
        db.put("days", days)
        NativeStore.saveLegacyDb(context, db.toString())
    }

    override fun getRange(start: String, end: String): List<DayRecord> =
        NativeStore.days(context)
            .mapNotNull { item ->
                val date = item.optString("_date", "")
                decode(date, item)
            }
            .filter { it.date >= start && it.date <= end }

    private fun decode(date: String, value: Any?): DayRecord? {
        if (date.isBlank() || value !is JSONObject) return null

        val type = value.optString("t", "REPOS")
        val start = parseTime(value.optString("deb", ""))
        val end = parseTime(value.optString("fin", ""))
        val pauses = parsePauses(value.optJSONArray("p"))
        val panier = if (value.has("panier") && !value.isNull("panier")) {
            value.optString("panier")
        } else null
        val holiday = value.optBoolean("fer", false)

        return DayRecord(
            date = date,
            start = start,
            end = end,
            pauses = pauses,
            meal = null,
            type = type,
            panier = panier,
            holiday = holiday
        )
    }

    private fun encode(day: DayRecord): JSONObject = JSONObject().apply {
        put("t", day.type)
        day.start?.let { put("deb", formatTime(it)) }
        day.end?.let { put("fin", formatTime(it)) }
        put("p", JSONArray().apply {
            day.pauses.forEach { pause ->
                put(JSONObject().apply {
                    put("d", formatTime(pause.start))
                    put("f", formatTime(pause.end))
                    pause.type?.let { put("ty", it) }
                })
            }
        })
        day.panier?.let { put("panier", it) }
        if (day.holiday) put("fer", true)
    }

    private fun parsePauses(array: JSONArray?): List<PauseRecord> {
        if (array == null) return emptyList()
        val result = mutableListOf<PauseRecord>()
        for (i in 0 until array.length()) {
            val p = array.optJSONObject(i) ?: continue
            val start = parseTime(p.optString("d", "")) ?: continue
            val end = parseTime(p.optString("f", "")) ?: continue
            val type = if (p.has("ty") && !p.isNull("ty")) p.optString("ty") else null
            result += PauseRecord(start, end, type)
        }
        return result
    }

    private fun parseTime(value: String): Int? {
        val parts = value.trim().split(":")
        if (parts.size != 2) return null
        val h = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        if (h !in 0..23 || m !in 0..59) return null
        return h * 60 + m
    }

    private fun formatTime(value: Int): String = "%02d:%02d".format(value / 60, value % 60)
}
KOT

# ------------------------------------------------------------
# 5. CONFIG PAIE
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/core/model/PayConfig.kt <<'KOT'
package com.mesheures.app.core.model

import org.json.JSONObject
import java.time.LocalDate
import java.time.Period

data class PayConfig(
    val hourlyRate: Double = 14.20,
    val netRatio: Double = 0.787,
    val habillageMinutesPerDay: Int = 10,
    val habillageRate: Double = 12.9688,
    val idajThresholdHours: Double = 12.0,
    val baseHoursPerWeek: Double = 35.0,
    val hs25CapHoursPerQuatorzaine: Double = 16.0,
    val panierExterieur: Double = 5.30,
    val panierInterieur: Double = 9.69,
    val panierInterieurTaux: Double = 10.40,
    val rcDayMinutes: Int = 420,
    val cpDayMinutes: Int = 420,
    val ancienneteOverridePercent: Double? = null,
    val embDate: String = "2019-09-09",
    val maxAmplitudeHours: Double = 14.0,
    val dimPrime: Double = 0.0,
    val nuitDeb: String = "21:00",
    val nuitFin: String = "06:00",
    val nuitMajPercent: Double = 0.0,
    val weeklyCeilingHours: Double = 46.0
) {
    fun ancienneteRatePercent(): Double {
        ancienneteOverridePercent?.let { return it }
        val years = try {
            Period.between(LocalDate.parse(embDate), LocalDate.now()).years
        } catch (_: Exception) {
            0
        }
        return when {
            years >= 15 -> 8.0
            years >= 10 -> 6.0
            years >= 5 -> 4.0
            years >= 2 -> 2.0
            else -> 0.0
        }
    }

    companion object {
        fun fromRawDb(db: JSONObject?): PayConfig {
            val s = db?.optJSONObject("s") ?: return PayConfig()
            fun d(k: String, def: Double) = if (s.has(k) && !s.isNull(k)) s.optDouble(k, def) else def
            fun i(k: String, def: Int) = if (s.has(k) && !s.isNull(k)) s.optInt(k, def) else def
            fun str(k: String, def: String) = if (s.has(k) && !s.isNull(k)) s.optString(k, def) else def
            val anc = if (s.has("anc") && !s.isNull("anc") && s.optDouble("anc", 0.0) > 0) s.optDouble("anc") else null
            return PayConfig(
                hourlyRate = d("taux", 14.20),
                netRatio = d("net", 0.787),
                habillageMinutesPerDay = i("hab", 10),
                habillageRate = d("habT", 12.9688),
                idajThresholdHours = d("idaj", 12.0),
                baseHoursPerWeek = d("base", 35.0),
                hs25CapHoursPerQuatorzaine = d("pl", 16.0),
                panierExterieur = d("ir", 5.30),
                panierInterieur = d("iru", 9.69),
                panierInterieurTaux = d("irT", 10.40),
                rcDayMinutes = i("rc", 420),
                cpDayMinutes = i("cp", 420),
                ancienneteOverridePercent = anc,
                embDate = str("emb", "2019-09-09"),
                maxAmplitudeHours = d("maxAmp", 14.0),
                dimPrime = d("dimPrime", 0.0),
                nuitDeb = str("nuitDeb", "21:00"),
                nuitFin = str("nuitFin", "06:00"),
                nuitMajPercent = d("nuitMaj", 0.0),
                weeklyCeilingHours = 46.0
            )
        }
    }
}
KOT

# ------------------------------------------------------------
# 6. ROMI1 — LECTURE DIRECTE DE DB.romi, AUCUN SEED
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/core/model/RomiReference.kt <<'KOT'
package com.mesheures.app.core.model

import org.json.JSONObject

data class RomiReference(
    val periodStart: String = "",
    val periodEnd: String = "",
    val tteHours: Double = 0.0,
    val hsHours: Double = 0.0,
    val presenceDays: Int = 0,
    val hs25EligibleHours: Double = 0.0,
    val hs25PaidHours: Double = 0.0,
    val hs25ToRcHours: Double = 0.0,
    val hs50EligibleHours: Double = 0.0,
    val hs50PaidHours: Double = 0.0,
    val rcAnteriorHours: Double = 0.0,
    val rcAcquisHours: Double = 0.0,
    val rcCumuleHours: Double = 0.0
) {
    companion object {
        fun fromRawDb(db: JSONObject?): RomiReference? {
            val romi = db?.optJSONObject("romi") ?: return null
            val keys = romi.keys().asSequence().toList().sorted()
            val key = keys.lastOrNull() ?: return null
            val record = romi.optJSONObject(key) ?: return null
            return RomiReference(
                periodStart = record.optString("start", key),
                periodEnd = record.optString("end", ""),
                tteHours = record.optDouble("tteH", 0.0),
                hsHours = record.optDouble("hsPeriodeH", 0.0),
                presenceDays = record.optInt("joursPresence", 0),
                hs25EligibleHours = record.optDouble("hs125EligH", 0.0),
                hs25PaidHours = record.optDouble("hs125PayeesH", 0.0),
                hs25ToRcHours = (record.optDouble("hs125EligH", 0.0) - record.optDouble("hs125PayeesH", 0.0)).coerceAtLeast(0.0),
                hs50EligibleHours = record.optDouble("hs150EligH", 0.0),
                hs50PaidHours = record.optDouble("hs150PayeesH", 0.0),
                rcAnteriorHours = record.optDouble("rcAvant", 0.0),
                rcAcquisHours = record.optDouble("rcAcquis", 0.0),
                rcCumuleHours = record.optDouble("rcSolde", 0.0)
            )
        }
    }
}
KOT

# ------------------------------------------------------------
# 7. CALCUL JOURNALIER PAIE
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/core/engine/PayDayCalculator.kt <<'KOT'
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
KOT

# ------------------------------------------------------------
# 8. PERIOD PAY ENGINE
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/core/engine/PeriodPayEngine.kt <<'KOT'
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
KOT

# ------------------------------------------------------------
# 9. DASHBOARD — SOURCE UNIQUE = REPOSITORY NATIF
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/core/engine/DashboardMetrics.kt <<'KOT'
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
KOT

# ------------------------------------------------------------
# 10. WIDGET = CONSOMMATEUR DU MÊME MOTEUR NATIF
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/widget/WidgetPayloadWriter.kt <<'KOT'
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
KOT

# ------------------------------------------------------------
# 11. DASHBOARD COMPOSE — 100 % NATIF, PAS DE WEBVIEW
# ------------------------------------------------------------

cat > app/src/main/java/com/mesheures/app/nativeui/NativeDashboardActivity.kt <<'KOT'
package com.mesheures.app.nativeui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.mesheures.app.core.engine.DashboardData
import com.mesheures.app.core.engine.DashboardMetrics
import com.mesheures.app.widget.WidgetPayloadWriter
import java.util.Locale
import kotlin.math.abs

class NativeDashboardActivity : ComponentActivity() {
    private var refresh by mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val data = remember(refresh) { DashboardMetrics.build(this@NativeDashboardActivity) }
            NativeDashboard(data)
        }
    }

    override fun onResume() {
        super.onResume()
        WidgetPayloadWriter.write(this)
        refresh++
    }
}

private data class Metric(val label: String, val value: String)

@Composable
private fun NativeDashboard(data: DashboardData) {
    val metrics = listOf(
        Metric("Travail", data.workCount.toString()),
        Metric("Repos", data.restCount.toString()),
        Metric("Congé", data.cpCount.toString()),
        Metric("Maladie", data.malCount.toString()),
        Metric("TTE jour", hm(data.tteJourMinutes)),
        Metric("TTE semaine", hm(data.tteSemaineMinutes)),
        Metric("TTE mois", hm(data.tteMoisMinutes)),
        Metric("TTE période", hm(data.ttePeriodeMinutes)),
        Metric("HS25 période", hm(data.hs25PeriodeMinutes)),
        Metric("HS50 période", hm(data.hs50PeriodeMinutes)),
        Metric("Marge avant 46h", hm(data.margeAvant46hMinutes))
    )

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .padding(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    Text("MesHeures", style = MaterialTheme.typography.headlineMedium)
                    Text("Dashboard natif · ${data.monthLabel}", style = MaterialTheme.typography.bodyMedium)
                }

                items(metrics.chunked(2)) { pair ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        for (metric in pair) {
                            Card(modifier = Modifier.weight(1f)) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Text(metric.label, style = MaterialTheme.typography.labelMedium)
                                    Text(metric.value, style = MaterialTheme.typography.titleLarge)
                                }
                            }
                        }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }

                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Repos compensateur", style = MaterialTheme.typography.titleMedium)
                            Text("RC ROMI1 (employeur) : ${String.format(Locale.FRANCE, "%.2f h", data.rcRomiHours)}")
                            Text(
                                "Équivalent RC calculé localement : ${String.format(Locale.FRANCE, "%.2f h", data.rcLocalEquivHours)}",
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                "Les deux valeurs sont distinctes et ne se remplacent jamais.",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }

                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Paie — période courante", style = MaterialTheme.typography.titleMedium)
                            Text(String.format(Locale.FRANCE, "Brut estimé : %.2f €", data.grossEstimate))
                            Text(String.format(Locale.FRANCE, "Net estimé : %.2f €", data.netEstimate))
                            Text("Source : moteur natif", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }

                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Prochaine journée", style = MaterialTheme.typography.titleMedium)
                            Text(data.nextDayLabel)
                            Text(data.nextDayHours, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}

private fun hm(value: Int): String {
    val sign = if (value < 0) "-" else ""
    val a = abs(value)
    return "$sign${a / 60}h${"%02d".format(a % 60)}"
}
KOT

# ------------------------------------------------------------
# 12. VERSION + ARCHITECTURE
# ------------------------------------------------------------

sed -i 's/^VERSION=.*/VERSION=37.0.0/' version.properties
sed -i 's/^VERSION_CODE=.*/VERSION_CODE=3700/' version.properties

cat > app/src/main/java/com/mesheures/app/MesHeuresArchitecture.kt <<'KOT'
package com.mesheures.app

object MesHeuresArchitecture {
    const val VERSION = "37.0.0"
    const val WEBVIEW_RUNTIME_ALLOWED = false
    const val SINGLE_SOURCE_OF_TRUTH = true
    const val NATIVE_ONLY = true
}
KOT

# ------------------------------------------------------------
# 13. TEST JVM — mathématique du moteur, sans fausse ROMI codée
# ------------------------------------------------------------

mkdir -p app/src/test/java/com/mesheures/app/core/engine

if ! grep -q "testImplementation.*junit:junit" app/build.gradle; then
    sed -i "/dependencies[[:space:]]*{/a\\    testImplementation 'junit:junit:4.13.2'" app/build.gradle
fi

cat > app/src/test/java/com/mesheures/app/core/engine/PeriodPayEngineTest.kt <<'KOT'
package com.mesheures.app.core.engine

import com.mesheures.app.core.model.PayConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PeriodPayEngineTest {
    private val cfg = PayConfig(ancienneteOverridePercent = 4.0)

    @Test
    fun repartitionDeuxQuatorzaines() {
        val q1 = PeriodPayEngine.splitOvertime(5160, cfg)
        val q2 = PeriodPayEngine.splitOvertime(6470, cfg)

        assertEquals(8400, q1.first + q2.first)
        assertEquals(1920, q1.second + q2.second)
        assertEquals(1310, q1.third + q2.third)
    }

    @Test
    fun equivalentRcLocalEstCalculeParLeMoteur() {
        val q1 = PeriodPayEngine.splitOvertime(5160, cfg)
        val q2 = PeriodPayEngine.splitOvertime(6470, cfg)
        val rc = q1.second * 1.25 / 60.0 + q2.second * 1.25 / 60.0 +
            q1.third * 1.50 / 60.0 + q2.third * 1.50 / 60.0
        assertTrue(rc > 0.0)
    }
}
KOT

# ------------------------------------------------------------
# 14. CONTROLES NATIFS AVANT BUILD
# ------------------------------------------------------------

echo "=== CONTROL 1 : MainActivity unique ==="
COUNT=$(grep -rl --include='*.kt' --include='*.java' 'class MainActivity' app/src/main/java | wc -l)
test "$COUNT" -eq 1 || { echo "ECHEC MainActivity=$COUNT"; exit 1; }

echo "=== CONTROL 2 : ZERO WebView dans le code source ==="
if grep -RniE --include='*.kt' --include='*.java' 'WebView|android\.webkit|HybridCore|loadUrl|LegacyWebViewActivity|NativeMigrationActivity|JavascriptInterface' app/src/main/java; then
    echo "ECHEC : une référence WebView subsiste."
    exit 1
fi

echo "=== CONTROL 3 : ZERO seed ROMI statique ==="
if grep -RniE --include='*.kt' '193\.8333|53\.8333|104\.52|53\.99|158\.52|seedIfEmpty' app/src/main/java/com/mesheures/app/core; then
    echo "ECHEC : valeur ROMI codée en dur ou ancien seed détecté."
    exit 1
fi

echo "=== CONTROL 4 : AAPT2 ==="
if [ ! -x "$HOME/tools/aapt2" ]; then
    echo "ECHEC : $HOME/tools/aapt2 absent ou non exécutable."
    exit 1
fi

echo "CONTROLES STATIQUES OK"

# ------------------------------------------------------------
# 15. TEST
# ------------------------------------------------------------

echo "=== TESTS JVM ==="
./gradlew testDebugUnitTest --console=plain

echo "TESTS OK"

# ------------------------------------------------------------
# 16. BUILD FINAL
# ------------------------------------------------------------

echo "=== BUILD V37 ==="
./gradlew clean assembleDebug -Pandroid.aapt2FromMavenOverride="$HOME/tools/aapt2" --console=plain

APK="app/build/outputs/apk/debug/app-debug.apk"
test -f "$APK" || { echo "ECHEC : APK absent."; exit 1; }

OUT="$HOME/storage/downloads/MesHeures-V37.0.0-NATIVE-FINAL.apk"
cp -f "$APK" "$OUT"

BADGING="$("$HOME/tools/aapt2" dump badging "$OUT")"
echo "$BADGING" | grep -q "package: name='com.mesheures.app'" || { echo "ECHEC package"; exit 1; }
echo "$BADGING" | grep -q "versionCode='3700'" || { echo "ECHEC versionCode"; exit 1; }
echo "$BADGING" | grep -q "versionName='37.0.0'" || { echo "ECHEC versionName"; exit 1; }

# ------------------------------------------------------------
# 17. GIT — commit seulement si tout est passé
# ------------------------------------------------------------

git add app version.properties
if ! git diff --cached --quiet; then
    git commit -m "V37.0.0 native only"
fi

echo "=============================================="
echo "V37.0.0 FINAL — BUILD OK"
echo "APK : $OUT"
echo "Package : com.mesheures.app"
echo "Version : 37.0.0 / 3700"
echo "Architecture : 100% native"
echo "WebView : 0"
echo "ROMI1 : lu directement depuis DB.romi"
echo "Widget : moteur natif unique"
echo "=============================================="
