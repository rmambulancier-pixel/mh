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
