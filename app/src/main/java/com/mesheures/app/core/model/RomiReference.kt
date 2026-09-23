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
