package com.egor.sportstats

import android.content.Intent
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
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
        if (client == null) return call.reject("Health Connect is not available")

        val permissions = requested.mapNotNull { recordTypes[it]?.permission }.toSet()
        if (permissions.isEmpty()) return call.reject("Unknown data types: $requested")

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
                        workouts.put(describeSession(healthClient, session))
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
    ): JSObject {
        val range = TimeRangeFilter.between(session.startTime, session.endTime)
        val metrics = setOf(
            ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
            DistanceRecord.DISTANCE_TOTAL,
            HeartRateRecord.BPM_AVG,
            HeartRateRecord.BPM_MAX,
        )

        // Some of these may lack permission — in that case we just leave nulls.
        val aggregate = runCatching {
            healthClient.aggregate(AggregateRequest(metrics = metrics, timeRangeFilter = range))
        }.getOrNull()

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
        workout.putNullable("distanceM", aggregate?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters)
        workout.putNullable("avgHeartRate", aggregate?.get(HeartRateRecord.BPM_AVG))
        workout.putNullable("maxHeartRate", aggregate?.get(HeartRateRecord.BPM_MAX))
        workout.put("source", session.metadata.dataOrigin.packageName)
        return workout
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

    private fun parseDate(value: String?): LocalDate? =
        value?.let { runCatching { LocalDate.parse(it, DAY_FORMAT) }.getOrNull() }

    private fun exerciseKey(type: Int): String = EXERCISE_KEYS[type] ?: "other"

    private companion object {
        val DAY_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")

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
