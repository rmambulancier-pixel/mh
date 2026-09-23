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
