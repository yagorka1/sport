import { locale } from '@core/i18n/i18n';
import { Workout } from '@core/metrics/metric.model';

export function formatKm(meters: number): string {
  return (meters / 1000).toLocaleString(locale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Pace in min/km — distance sports only; it is meaningless for strength training. */
export function formatPace(workout: Workout): string | null {
  if (!workout.distanceM || workout.distanceM < 300) return null;
  return formatPaceOf(workout.durationSec, workout.distanceM);
}

/** Sports where speed reads better than pace: nobody thinks of a ride in minutes per km. */
const SPEED_TYPES: ReadonlySet<string> = new Set([
  'cycling',
  'cycling_stationary',
  'skiing',
  'snowboarding',
  'rowing',
]);

export function prefersSpeed(workout: Workout): boolean {
  return SPEED_TYPES.has(workout.type);
}

export function formatSpeedKmh(metersPerSecond: number): string {
  return (metersPerSecond * 3.6).toLocaleString(locale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** min:sec per km for a stretch of the workout (a lap). */
export function formatPaceOf(durationSec: number, lengthM: number): string {
  const secPerKm = durationSec / (lengthM / 1000);
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString(locale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Well-known Health Connect writers; anything else is shown by its package name. */
const SOURCE_APPS: Readonly<Record<string, string>> = {
  'com.google.android.apps.fitness': 'Google Fit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.strava': 'Strava',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.mi.health': 'Mi Fitness',
  'com.huawei.health': 'Huawei Health',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.withings.wiscale2': 'Withings',
  'com.polar.polarflow': 'Polar Flow',
  'com.suunto.android': 'Suunto',
  'com.coros.coros': 'COROS',
  'com.oneplus.health.international': 'OHealth',
  'com.google.android.apps.healthdata': 'Health Connect',
};

export function sourceAppName(source: string | null): string | null {
  if (!source) return null;
  return SOURCE_APPS[source] ?? source;
}

/** Whether there is (or may be, after consent) a route to show. */
export function hasRoute(workout: Workout): boolean {
  return workout.route === 'available' || workout.route === 'consent';
}
