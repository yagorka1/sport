package com.egor.sportstats

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Local (non-npm) plugins are registered manually, and must be before super.onCreate.
        registerPlugin(HealthConnectPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
