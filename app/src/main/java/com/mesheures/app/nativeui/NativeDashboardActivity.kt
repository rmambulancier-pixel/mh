package com.mesheures.app.nativeui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.mesheures.app.MainActivity
import com.mesheures.app.widget.MhWidgetProvider
import org.json.JSONObject
import kotlinx.coroutines.delay
import java.util.Locale

class NativeDashboardActivity : ComponentActivity() {
    private var payload by mutableStateOf(JSONObject())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        payload = readPayload(this)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    NativeDashboard(
                        payload = payload,
                        onRefresh = { payload = readPayload(this@NativeDashboardActivity) },
                        onOpenApp = {
                            startActivity(Intent(this@NativeDashboardActivity, MainActivity::class.java))
                        },
                        onOpenDay = {
                            startActivity(Intent(this@NativeDashboardActivity, MainActivity::class.java).apply {
                                putExtra("mh_deeplink", "jour")
                            })
                        }
                    )
                }
            }
            LaunchedEffect(Unit) {
                while (true) {
                    delay(2000)
                    payload = readPayload(this@NativeDashboardActivity)
                }
            }
        }
    }

    companion object {
        fun readPayload(context: Context): JSONObject {
            return try {
                val raw = context.getSharedPreferences(MhWidgetProvider.PREFS, Context.MODE_PRIVATE)
                    .getString(MhWidgetProvider.KEY_PAYLOAD, "{}").orEmpty()
                JSONObject(raw)
            } catch (_: Exception) { JSONObject() }
        }
    }
}

private data class Metric(val label: String, val value: String)

private fun minutes(value: Int): String {
    val h = value / 60
    val m = value % 60
    return String.format(Locale.FRANCE, "%dh%02d", h, m)
}

@androidx.compose.runtime.Composable
private fun NativeDashboard(
    payload: JSONObject,
    onRefresh: () -> Unit,
    onOpenApp: () -> Unit,
    onOpenDay: () -> Unit
) {
    val month = payload.optString("monthLabel", "—")
    val metrics = listOf(
        Metric("Travail", payload.optInt("workCount", 0).toString()),
        Metric("Repos", payload.optInt("restCount", 0).toString()),
        Metric("Congé", payload.optInt("cpCount", 0).toString()),
        Metric("Maladie", payload.optInt("malCount", 0).toString()),
        Metric("TTE jour", minutes(payload.optInt("tteJourMin", 0))),
        Metric("TTE mois", minutes(payload.optInt("tteMoisMin", 0))),
        Metric("TTE semaine", minutes(payload.optInt("tteSemaineMin", 0))),
        Metric("TTE période", minutes(payload.optInt("ttePeriodeMin", 0))),
        Metric("HS25 période", minutes(payload.optInt("hs25PeriodeMin", 0))),
        Metric("HS50 période", minutes(payload.optInt("hs50PeriodeMin", 0))),
        Metric("Marge 46 h", minutes(payload.optInt("margeAvant46hMin", 0))),
        Metric("RC", minutes(payload.optInt("rcSoldeMin", 0)))
    )
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("MesHeures", style = MaterialTheme.typography.headlineMedium)
            Text("Dashboard natif · $month", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(6.dp))
        }
        items(metrics.chunked(2)) { pair ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                pair.forEach { metric ->
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
            val gross = payload.optInt("grossCents", 0) / 100.0
            val net = payload.optInt("netCents", 0) / 100.0
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Paie", style = MaterialTheme.typography.titleMedium)
                    Text(String.format(Locale.FRANCE, "Brut estimé : %.2f €", gross))
                    Text(String.format(Locale.FRANCE, "Net estimé : %.2f €", net))
                    Text("Source : ${payload.optString("paySource", "indisponible")}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Prochaine journée", style = MaterialTheme.typography.titleMedium)
                    Text(payload.optString("nextDayLabel", "Aucune journée planifiée"))
                    Text(payload.optString("nextDayHours", ""), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onOpenDay, modifier = Modifier.weight(1f)) { Text("+ Saisir") }
                OutlinedButton(onClick = onRefresh, modifier = Modifier.weight(1f)) { Text("Actualiser") }
            }
            OutlinedButton(onClick = onOpenApp, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Text("Ouvrir MesHeures")
            }
        }
    }
}
