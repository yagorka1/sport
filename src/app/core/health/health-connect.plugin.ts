import { registerPlugin } from '@capacitor/core';

/**
 * TypeScript contract of our native plugin.
 * Implementation: android/app/src/main/java/.../HealthConnectPlugin.kt
 * On the web platform none of these methods is ever called — see HealthService.
 */

export interface AvailabilityResult {
  /** true when Health Connect is installed and usable. */
  available: boolean;
  /** 'ok' | 'update_required' | 'not_installed' | 'not_supported' */
  status: string;
}

export interface PermissionsResult {
  /** healthType keys that are actually granted. */
  granted: string[];
}

/**
 * Access to data older than 30 days before the first grant (READ_HEALTH_DATA_HISTORY).
 * 'unsupported' — the installed Health Connect is too old for this permission.
 */
export type HistoryAccess = 'granted' | 'denied' | 'unsupported';

export interface DailyPointDto {
  /** YYYY-MM-DD in the device's local time zone. */
  date: string;
  /** Value in Health Connect units (steps, kcal, meters, seconds). */
  value: number;
}

export interface WorkoutDto {
  id: string;
  type: string;
  /** Only a title the user set on the session; the UI translates the type otherwise. */
  title: string | null;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  calories: number | null;
  distanceM: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  source: string | null;
  /** The session has a GPS route; the route itself is fetched with readRoute. */
  hasRoute: boolean;
  totalCalories: number | null;
  steps: number | null;
  minHeartRate: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  elevationGainM: number | null;
  avgCadence: number | null;
  avgPowerW: number | null;
  maxPowerW: number | null;
  notes: string | null;
  laps: { durationSec: number; lengthM: number | null }[];
  heartRate: { stepSec: number; bpm: (number | null)[] } | null;
}

export interface AccessStatus {
  history: HistoryAccess;
  /** Everything a permission request would ask for is granted. */
  complete: boolean;
}

export type RouteDto =
  | { status: 'data'; points: [number, number][] }
  | { status: 'consent' }
  | { status: 'none' };

export interface HealthConnectPlugin {
  isAvailable(): Promise<AvailabilityResult>;

  checkPermissions(options: { types: string[] }): Promise<PermissionsResult>;

  /**
   * Opens the Health Connect system dialog. Returns what was actually granted.
   * Workout details, history and route access are requested along with the metrics.
   */
  requestPermissions(options: { types: string[] }): Promise<PermissionsResult>;

  accessStatus(options: { types: string[] }): Promise<AccessStatus>;

  /** Daily aggregation of one record type over a range (both bounds inclusive). */
  readDaily(options: {
    type: string;
    from: string;
    to: string;
    aggregation: string;
  }): Promise<{ points: DailyPointDto[] }>;

  readWorkouts(options: { from: string; to: string }): Promise<{ workouts: WorkoutDto[] }>;

  readRoute(options: { id: string }): Promise<RouteDto>;

  /** Health Connect screen asking to share one session's route; 'none' when declined. */
  requestRoute(options: { id: string }): Promise<RouteDto>;

  /** Health Connect screen in system settings, so the user can adjust access. */
  openSettings(): Promise<void>;
}

export const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect');
