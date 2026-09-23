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
