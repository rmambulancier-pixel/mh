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
