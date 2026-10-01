package com.egor.sportstats

import android.content.Intent
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.contracts.ExerciseRouteRequestContract
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ElevationGainedRecord
import androidx.health.connect.client.records.ExerciseRoute
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.PowerRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.StepsCadenceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Duration
import java.time.LocalDate
import java.time.Period
import java.time.format.DateTimeFormatter
import kotlin.reflect.KClass

/**
 * Bridge to Health Connect.
 *
 * To add a metric: one entry in [recordTypes] — the key must match `healthType` in
 * metric.registry.ts — plus the matching permission in AndroidManifest.xml. Everything
 * else (permissions, daily aggregation, sync) is already generic.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    /** Record type description: the permission plus how to aggregate it per day. */
    private class RecordType(
        val permission: String,
        val metric: AggregateMetric<*>,
        /** Converts the aggregate to a number in base units: steps, kcal, meters, seconds, kg, bpm. */
        val toValue: (Any) -> Double,
    )

    private val client: HealthConnectClient? by lazy {
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectClient.getOrCreate(context)
        } else {
            null
        }
    }

    private val scope = CoroutineScope(Dispatchers.Main)

    private val recordTypes: Map<String, RecordType> by lazy {
        mapOf(
            "steps" to RecordType(
                HealthPermission.getReadPermission(StepsRecord::class),
                StepsRecord.COUNT_TOTAL,
            ) { (it as Long).toDouble() },

            "active_calories" to RecordType(
                HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
                ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
            ) { (it as androidx.health.connect.client.units.Energy).inKilocalories },

            "distance" to RecordType(
                HealthPermission.getReadPermission(DistanceRecord::class),
                DistanceRecord.DISTANCE_TOTAL,
            ) { (it as androidx.health.connect.client.units.Length).inMeters },

            "exercise_time" to RecordType(
                HealthPermission.getReadPermission(ExerciseSessionRecord::class),
                ExerciseSessionRecord.EXERCISE_DURATION_TOTAL,
            ) { (it as Duration).seconds.toDouble() },

            "resting_heart_rate" to RecordType(
                HealthPermission.getReadPermission(RestingHeartRateRecord::class),
                RestingHeartRateRecord.BPM_AVG,
            ) { (it as Long).toDouble() },

            "sleep" to RecordType(
                HealthPermission.getReadPermission(SleepSessionRecord::class),
                SleepSessionRecord.SLEEP_DURATION_TOTAL,
            ) { (it as Duration).seconds.toDouble() },

            "weight" to RecordType(
                HealthPermission.getReadPermission(WeightRecord::class),
                WeightRecord.WEIGHT_AVG,
            ) { (it as androidx.health.connect.client.units.Mass).inKilograms },
        )
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            // Health Connect needs Android 8+; below that neither the app nor java.time exist.
            result.put("available", false)
            result.put("status", "not_supported")
            call.resolve(result)
            return
        }

        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "ok"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "not_installed"
        }
        result.put("available", status == "ok")
        result.put("status", status)
        call.resolve(result)
    }

    // Plugin already declares checkPermissions/requestPermissions for Android runtime
    // permissions; Health Connect ones are not runtime permissions, so both are replaced.
    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val requested = requestedTypes(call)
        val healthClient = client ?: return call.reject("Health Connect is not available")

        scope.launch {
            try {
                val granted = healthClient.permissionController.getGrantedPermissions()
                call.resolve(grantedResult(requested, granted))
            } catch (e: Exception) {
                call.reject(e.message ?: "Failed to read permissions", e)
            }
        }
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val requested = requestedTypes(call)
        val healthClient = client ?: return call.reject("Health Connect is not available")

        val metricPermissions = requested.mapNotNull { recordTypes[it]?.permission }.toSet()
        if (metricPermissions.isEmpty()) return call.reject("Unknown data types: $requested")

        // Workout details, history and routes ride along with every request, so a user who
        // granted the metrics earlier gets a dialog with just the missing permissions.
        val permissions = metricPermissions + extraPermissions(healthClient)

        // Health Connect grants permissions only through its own system screen.
        val intent = PermissionController.createRequestPermissionResultContract()
            .createIntent(context, permissions)
        startActivityForResult(call, intent, "permissionsResult")
    }

    @ActivityCallback
    private fun permissionsResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val healthClient = client ?: return call.reject("Health Connect is not available")

        // The activity result does not say what was granted — re-read the actual state.
        scope.launch {
            try {
                val granted = healthClient.permissionController.getGrantedPermissions()
                call.resolve(grantedResult(requestedTypes(call), granted))
            } catch (e: Exception) {
                call.reject(e.message ?: "Failed to read permissions", e)
            }
        }
    }

    /**
     * history: whether data older than 30 days before the first grant is readable —
     * "granted", "denied", or "unsupported" when this Health Connect version lacks the feature.
     * complete: everything requestPermissions would ask for (the given metric types plus the
     * extras) is granted; false means a new request would show something.
     */
    @PluginMethod
    fun accessStatus(call: PluginCall) {
        val requested = requestedTypes(call)
        val healthClient = client ?: return call.reject("Health Connect is not available")

        scope.launch {
            try {
                val granted = healthClient.permissionController.getGrantedPermissions()
                val history = when {
                    !historySupported(healthClient) -> "unsupported"
                    HISTORY_PERMISSION in granted -> "granted"
                    else -> "denied"
                }
                val wanted = requested.mapNotNull { recordTypes[it]?.permission }.toSet() +
                    extraPermissions(healthClient)

                val result = JSObject()
                result.put("history", history)
                result.put("complete", granted.containsAll(wanted))
                call.resolve(result)
            } catch (e: Exception) {
                call.reject(e.message ?: "Failed to read permissions", e)
            }
        }
    }

    @PluginMethod
    fun readDaily(call: PluginCall) {
        val typeKey = call.getString("type") ?: return call.reject("Missing type")
        val type = recordTypes[typeKey] ?: return call.reject("Unknown type: $typeKey")
        val healthClient = client ?: return call.reject("Health Connect is not available")

        val from = parseDate(call.getString("from")) ?: return call.reject("Invalid from")
        val to = parseDate(call.getString("to")) ?: return call.reject("Invalid to")

        // AggregationResult.get is typed by the metric's value; a star projection would not
        // compile here, and we convert the values by hand anyway.
        @Suppress("UNCHECKED_CAST")
        val metric = type.metric as AggregateMetric<Any>

        scope.launch {
            try {
                val buckets = healthClient.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(metric),
                        timeRangeFilter = TimeRangeFilter.between(
                            from.atStartOfDay(),
                            // The upper bound is exclusive, so take the start of the next day.
                            to.plusDays(1).atStartOfDay(),
                        ),
                        timeRangeSlicer = Period.ofDays(1),
                    ),
                )

                val points = JSArray()
                for (bucket in buckets) {
                    val raw = bucket.result[metric] ?: continue
                    val point = JSObject()
                    point.put("date", bucket.startTime.toLocalDate().format(DAY_FORMAT))
                    point.put("value", type.toValue(raw))
                    points.put(point)
                }

                val response = JSObject()
                response.put("points", points)
                call.resolve(response)
            } catch (e: Exception) {
                call.reject(e.message ?: "Failed to read data", e)
            }
        }
    }

    @PluginMethod
    fun readWorkouts(call: PluginCall) {
        val healthClient = client ?: return call.reject("Health Connect is not available")
        val from = parseDate(call.getString("from")) ?: return call.reject("Invalid from")
        val to = parseDate(call.getString("to")) ?: return call.reject("Invalid to")

        scope.launch {
            try {
                val range = TimeRangeFilter.between(
                    from.atStartOfDay(),
                    to.plusDays(1).atStartOfDay(),
                )

                // Read once: each session aggregates only what is actually granted.
                val granted = healthClient.permissionController.getGrantedPermissions()

                val workouts = JSArray()
                // readRecords returns at most one page, so walk the pageToken chain:
                // a year of workouts easily exceeds a single page.
                var pageToken: String? = null
                do {
                    val page = healthClient.readRecords(
                        ReadRecordsRequest(
                            recordType = ExerciseSessionRecord::class,
                            timeRangeFilter = range,
                            pageToken = pageToken,
                        ),
                    )
                    for (session in page.records) {
                        workouts.put(describeSession(healthClient, session, granted))
                    }
                    pageToken = page.pageToken
                } while (pageToken != null)

                val response = JSObject()
                response.put("workouts", workouts)
                call.resolve(response)
            } catch (e: Exception) {
                call.reject(e.message ?: "Failed to read workouts", e)
            }
        }
    }

    /**
     * GPS route of one session: { status: "data", points: [[lat, lon], ...] }, or
     * { status: "consent" } when the user has to allow this route, or { status: "none" }.
     * Routes come only from reading a single record; readRecords leaves them out.
     */
    @PluginMethod
    fun readRoute(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("Missing id")
        val healthClient = client ?: return call.reject("Health Connect is not available")

        scope.launch {
            try {
                val session = healthClient.readRecord(ExerciseSessionRecord::class, id).record
                val result = JSObject()
                when (val route = session.exerciseRouteResult) {
                    is ExerciseRouteResult.Data -> {
                        result.put("status", "data")
                        result.put("points", routePoints(route.exerciseRoute))
                    }
                    is ExerciseRouteResult.ConsentRequired -> result.put("status", "consent")
                    else -> result.put("status", "none")
                }
                call.resolve(result)
            } catch (e: Exception) {
                call.reject(e.message ?: "Failed to read route", e)
            }
        }
    }

    /** Asks the user, through the Health Connect screen, to share the route of one session. */
    @PluginMethod
    fun requestRoute(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("Missing id")
        if (client == null) return call.reject("Health Connect is not available")

        val intent = ExerciseRouteRequestContract().createIntent(context, id)
        startActivityForResult(call, intent, "routeResult")
    }

    @ActivityCallback
    private fun routeResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val route = ExerciseRouteRequestContract().parseResult(result.resultCode, result.data)
        val response = JSObject()
        if (route == null) {
            // Declined, or the session turned out to have no route.
            response.put("status", "none")
        } else {
            response.put("status", "data")
            response.put("points", routePoints(route))
        }
        call.resolve(response)
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        try {
            val intent = Intent(HEALTH_CONNECT_SETTINGS_ACTION).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open Health Connect settings", e)
        }
    }

    /**
     * Workout metrics are aggregated separately over the session interval: the
     * ExerciseSessionRecord itself carries no calories, distance or heart rate.
     */
    private suspend fun describeSession(
        healthClient: HealthConnectClient,
        session: ExerciseSessionRecord,
        granted: Set<String>,
    ): JSObject {
        val range = TimeRangeFilter.between(session.startTime, session.endTime)

        // One ungranted metric makes the whole aggregate request fail, so ask only for what
        // is granted; the rest stays null.
        val metrics = SESSION_METRICS
            .filterKeys { HealthPermission.getReadPermission(it) in granted }
            .values.flatten().toSet()
        val aggregate = if (metrics.isEmpty()) {
            null
        } else {
            runCatching {
                healthClient.aggregate(AggregateRequest(metrics = metrics, timeRangeFilter = range))
            }.getOrNull()
        }

        val workout = JSObject()
        workout.put("id", session.metadata.id)
        workout.put("type", exerciseKey(session.exerciseType))
        // Only a title the user set; the frontend translates the type name into the UI language.
        workout.putNullable("title", session.title?.takeIf { it.isNotBlank() })
        workout.put("startedAt", session.startTime.toString())
        workout.put("endedAt", session.endTime.toString())
        workout.put("durationSec", Duration.between(session.startTime, session.endTime).seconds)
        workout.putNullable(
            "calories",
            aggregate?.get(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)?.inKilocalories,
        )
        workout.putNullable(
            "totalCalories",
            aggregate?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.inKilocalories,
        )
        workout.putNullable("distanceM", aggregate?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters)
        workout.putNullable("steps", aggregate?.get(StepsRecord.COUNT_TOTAL))
        workout.putNullable("avgHeartRate", aggregate?.get(HeartRateRecord.BPM_AVG))
        workout.putNullable("minHeartRate", aggregate?.get(HeartRateRecord.BPM_MIN))
        workout.putNullable("maxHeartRate", aggregate?.get(HeartRateRecord.BPM_MAX))
        workout.putNullable("avgSpeedMps", aggregate?.get(SpeedRecord.SPEED_AVG)?.inMetersPerSecond)
        workout.putNullable("maxSpeedMps", aggregate?.get(SpeedRecord.SPEED_MAX)?.inMetersPerSecond)
        workout.putNullable(
            "elevationGainM",
            aggregate?.get(ElevationGainedRecord.ELEVATION_GAINED_TOTAL)?.inMeters,
        )
        workout.putNullable("avgCadence", aggregate?.get(StepsCadenceRecord.RATE_AVG))
        workout.putNullable("avgPowerW", aggregate?.get(PowerRecord.POWER_AVG)?.inWatts)
        workout.putNullable("maxPowerW", aggregate?.get(PowerRecord.POWER_MAX)?.inWatts)
        workout.putNullable("notes", session.notes?.takeIf { it.isNotBlank() })
        workout.put("laps", describeLaps(session))
        workout.putNullable(
            "heartRate",
            if (HEART_RATE_PERMISSION in granted) heartRateSeries(healthClient, session) else null,
        )
        workout.put("source", session.metadata.dataOrigin.packageName)
        // The route itself is read on demand (readRoute): a year of GPS tracks would make
        // this response huge. Here we only say whether there is one.
        workout.put("hasRoute", session.exerciseRouteResult !is ExerciseRouteResult.NoData)
        return workout
    }

    private fun describeLaps(session: ExerciseSessionRecord): JSArray {
        val laps = JSArray()
        for (lap in session.laps) {
            val item = JSObject()
            item.put("durationSec", Duration.between(lap.startTime, lap.endTime).seconds)
            item.putNullable("lengthM", lap.length?.inMeters)
            laps.put(item)
        }
        return laps
    }

    /**
     * Heart rate over the session, averaged into at most HR_MAX_POINTS buckets — raw samples
     * come every second or so, far more than a chart needs or a Firestore document should hold.
     * Buckets without samples are null, so the chart shows a gap rather than a fake line.
     */
    private suspend fun heartRateSeries(
        healthClient: HealthConnectClient,
        session: ExerciseSessionRecord,
    ): JSObject? {
        val durationSec = Duration.between(session.startTime, session.endTime).seconds
        if (durationSec <= 0) return null
        val stepSec = maxOf(HR_MIN_STEP_SEC, (durationSec + HR_MAX_POINTS - 1) / HR_MAX_POINTS)
        val bucketCount = ((durationSec + stepSec - 1) / stepSec).toInt()
        val sums = LongArray(bucketCount)
        val counts = IntArray(bucketCount)

        var pageToken: String? = null
        do {
            val page = runCatching {
                healthClient.readRecords(
                    ReadRecordsRequest(
                        recordType = HeartRateRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                        pageToken = pageToken,
                    ),
                )
            }.getOrNull() ?: return null
            for (record in page.records) {
                for (sample in record.samples) {
                    val offset = Duration.between(session.startTime, sample.time).seconds
                    val bucket = (offset / stepSec).toInt()
                    if (bucket in 0 until bucketCount) {
                        sums[bucket] += sample.beatsPerMinute
                        counts[bucket]++
                    }
                }
            }
            pageToken = page.pageToken
        } while (pageToken != null)

        if (counts.all { it == 0 }) return null

        val bpm = JSArray()
        for (i in 0 until bucketCount) {
            if (counts[i] == 0) bpm.put(JSONObject.NULL) else bpm.put(sums[i] / counts[i])
        }
        val series = JSObject()
        series.put("stepSec", stepSec)
        series.put("bpm", bpm)
        return series
    }

    /**
     * Permissions beyond the metrics: workout details, history and routes. Each is asked for
     * only where this Health Connect / Android version knows it.
     */
    private fun extraPermissions(healthClient: HealthConnectClient): Set<String> = buildSet {
        SESSION_METRICS.keys.forEach { add(HealthPermission.getReadPermission(it)) }
        add(HEART_RATE_PERMISSION)
        if (historySupported(healthClient)) add(HISTORY_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) add(ROUTES_PERMISSION)
    }

    private fun routePoints(route: ExerciseRoute): JSArray {
        val points = JSArray()
        for (location in route.route) {
            val point = JSArray()
            point.put(location.latitude)
            point.put(location.longitude)
            points.put(point)
        }
        return points
    }

    /**
     * JSONObject.put(key, null) removes the key, so the JS side receives undefined instead
     * of null and the `!== null` checks in the frontend stop working. Write an explicit
     * JSONObject.NULL instead.
     */
    private fun JSObject.putNullable(key: String, value: Any?) {
        if (value == null) {
            put(key, JSONObject.NULL as Any)
        } else {
            put(key, value)
        }
    }

    private fun requestedTypes(call: PluginCall): List<String> =
        call.getArray("types")?.toList<String>() ?: recordTypes.keys.toList()

    private fun grantedResult(requested: List<String>, granted: Set<String>): JSObject {
        val allowed = JSArray()
        for (key in requested) {
            val permission = recordTypes[key]?.permission ?: continue
            if (permission in granted) allowed.put(key)
        }
        val result = JSObject()
        result.put("granted", allowed)
        return result
    }

    private fun historySupported(healthClient: HealthConnectClient): Boolean =
        healthClient.features.getFeatureStatus(
            HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY,
        ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    private fun parseDate(value: String?): LocalDate? =
        value?.let { runCatching { LocalDate.parse(it, DAY_FORMAT) }.getOrNull() }

    private fun exerciseKey(type: Int): String = EXERCISE_KEYS[type] ?: "other"

    private companion object {
        val DAY_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")

        const val HISTORY_PERMISSION = HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY

        val HEART_RATE_PERMISSION = HealthPermission.getReadPermission(HeartRateRecord::class)

        /** What is aggregated over a session's interval, keyed by the record type it needs. */
        val SESSION_METRICS: Map<KClass<out Record>, Set<AggregateMetric<*>>> = mapOf(
            ActiveCaloriesBurnedRecord::class to setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
            TotalCaloriesBurnedRecord::class to setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
            DistanceRecord::class to setOf(DistanceRecord.DISTANCE_TOTAL),
            StepsRecord::class to setOf(StepsRecord.COUNT_TOTAL),
            HeartRateRecord::class to setOf(
                HeartRateRecord.BPM_AVG,
                HeartRateRecord.BPM_MIN,
                HeartRateRecord.BPM_MAX,
            ),
            SpeedRecord::class to setOf(SpeedRecord.SPEED_AVG, SpeedRecord.SPEED_MAX),
            ElevationGainedRecord::class to setOf(ElevationGainedRecord.ELEVATION_GAINED_TOTAL),
            StepsCadenceRecord::class to setOf(StepsCadenceRecord.RATE_AVG),
            PowerRecord::class to setOf(PowerRecord.POWER_AVG, PowerRecord.POWER_MAX),
        )

        /** Heart-rate chart resolution: at most this many points per workout... */
        const val HR_MAX_POINTS = 240L

        /** ...and never finer than this, since samples rarely come more often. */
        const val HR_MIN_STEP_SEC = 5L

        /**
         * Lets routes written by other apps be read without a per-session prompt. A platform
         * permission of Android 15+; connect-client 1.1.0 has no constant or feature flag for
         * it, hence the literal and the SDK check. Without it every route other than our own
         * comes back as ConsentRequired and goes through requestRoute.
         */
        const val ROUTES_PERMISSION = "android.permission.health.READ_EXERCISE_ROUTES"

        const val HEALTH_CONNECT_SETTINGS_ACTION =
            "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS"

        /**
         * Numeric Health Connect types mapped to stable string keys for the frontend.
         * Each key needs a `workout.<key>` entry in src/app/core/i18n/{ru,en}.ts.
         */
        val EXERCISE_KEYS = mapOf(
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING to "running",
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL to "running_treadmill",
            ExerciseSessionRecord.EXERCISE_TYPE_WALKING to "walking",
            ExerciseSessionRecord.EXERCISE_TYPE_HIKING to "hiking",
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING to "cycling",
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY to "cycling_stationary",
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL to "swimming",
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER to "swimming_open_water",
            ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING to "strength_training",
            ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING to "weightlifting",
            ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING to "hiit",
            ExerciseSessionRecord.EXERCISE_TYPE_YOGA to "yoga",
            ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL to "elliptical",
            ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE to "rowing",
            ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING to "stair_climbing",
            ExerciseSessionRecord.EXERCISE_TYPE_SOCCER to "football",
            ExerciseSessionRecord.EXERCISE_TYPE_BASKETBALL to "basketball",
            ExerciseSessionRecord.EXERCISE_TYPE_TENNIS to "tennis",
            ExerciseSessionRecord.EXERCISE_TYPE_BOXING to "boxing",
            ExerciseSessionRecord.EXERCISE_TYPE_SKIING to "skiing",
            ExerciseSessionRecord.EXERCISE_TYPE_SNOWBOARDING to "snowboarding",
            ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS to "calisthenics",
            ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING to "stretching",
            ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT to "other",
        )
    }
}
