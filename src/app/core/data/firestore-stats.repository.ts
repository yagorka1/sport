import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DailyPoint,
  DateRange,
  LatLng,
  MetricId,
  RouteStatus,
  Workout,
} from '@core/metrics/metric.model';
import { AuthService } from '@core/auth/auth.service';
import { decodePolyline, encodePolyline, simplifyRoute } from '@core/routes/polyline';
import { db } from './firebase';
import { DayMetrics, StatsRepository } from './stats.repository';

/**
 * Firestore layout:
 *   users/{uid}                        { lastSyncAt, goals: { steps: 10000, ... } }
 *   users/{uid}/days/{YYYY-MM-DD}      { date, metrics: { steps: 8123, distance: 6200, ... } }
 *   users/{uid}/workouts/{id}          Workout
 *   users/{uid}/routes/{workoutId}     { polyline, points } — GPS track, encoded polyline
 *
 * Metrics are fields inside a day document rather than separate documents: a new metric
 * needs no migration, and a range of any length is read with a single query.
 */
@Injectable({ providedIn: 'root' })
export class FirestoreStatsRepository implements StatsRepository {
  private readonly auth = inject(AuthService);

  /** Firestore caps a batch at 500 operations. */
  private static readonly BATCH_LIMIT = 450;

  async loadSeries(range: DateRange): Promise<Map<MetricId, DailyPoint[]>> {
    const snapshot = await getDocs(
      query(
        collection(db(), this.daysPath()),
        where('date', '>=', range.from),
        where('date', '<=', range.to),
        orderBy('date'),
      ),
    );

    const series = new Map<MetricId, DailyPoint[]>();
    for (const document of snapshot.docs) {
      const data = document.data() as { date: string; metrics?: DayMetrics };
      for (const [metricId, value] of Object.entries(data.metrics ?? {})) {
        if (typeof value !== 'number') continue;
        const points = series.get(metricId) ?? [];
        points.push({ date: data.date, value });
        series.set(metricId, points);
      }
    }
    return series;
  }

  async saveDays(days: Map<string, DayMetrics>): Promise<void> {
    const entries = [...days.entries()];
    for (let i = 0; i < entries.length; i += FirestoreStatsRepository.BATCH_LIMIT) {
      const batch = writeBatch(db());
      for (const [date, metrics] of entries.slice(i, i + FirestoreStatsRepository.BATCH_LIMIT)) {
        // merge: syncing one metric must not wipe the others already written for that day.
        batch.set(doc(db(), this.daysPath(), date), { date, metrics }, { merge: true });
      }
      await batch.commit();
    }
  }

  async loadWorkouts(range: DateRange): Promise<Workout[]> {
    const snapshot = await getDocs(
      query(
        collection(db(), this.workoutsPath()),
        // Lexicographic order of ISO strings matches chronological order.
        where('startedAt', '>=', `${range.from}T00:00:00`),
        where('startedAt', '<=', `${range.to}T23:59:59.999Z`),
        orderBy('startedAt', 'desc'),
      ),
    );
    return snapshot.docs.map((d) => d.data() as Workout);
  }

  async saveWorkouts(workouts: readonly Workout[]): Promise<void> {
    for (let i = 0; i < workouts.length; i += FirestoreStatsRepository.BATCH_LIMIT) {
      const batch = writeBatch(db());
      for (const workout of workouts.slice(i, i + FirestoreStatsRepository.BATCH_LIMIT)) {
        batch.set(doc(db(), this.workoutsPath(), workout.id), workout, { merge: true });
      }
      await batch.commit();
    }
  }

  async loadWorkout(id: string): Promise<Workout | null> {
    const snapshot = await getDoc(doc(db(), this.workoutsPath(), id));
    return snapshot.exists() ? (snapshot.data() as Workout) : null;
  }

  async setWorkoutRoute(id: string, route: RouteStatus): Promise<void> {
    await setDoc(doc(db(), this.workoutsPath(), id), { route }, { merge: true });
  }

  /** null when the route was never stored. */
  async loadRoute(workoutId: string): Promise<LatLng[] | null> {
    const snapshot = await getDoc(doc(db(), this.routesPath(), workoutId));
    if (!snapshot.exists()) return null;
    return decodePolyline((snapshot.data() as StoredRoute).polyline);
  }

  /**
   * Routes live apart from workouts: a GPS track is tens of kilobytes even encoded, and the
   * workout list should not pull it. Stored simplified and as an encoded polyline.
   */
  async saveRoute(workoutId: string, points: readonly LatLng[]): Promise<void> {
    const simplified = simplifyRoute(points);
    const route: StoredRoute = { polyline: encodePolyline(simplified), points: simplified.length };
    await setDoc(doc(db(), this.routesPath(), workoutId), route);
  }

  async lastSyncAt(): Promise<string | null> {
    const data = await this.userDoc();
    return data?.lastSyncAt ?? null;
  }

  /** Version of the sync logic that wrote the data; 1 for data written before it was tracked. */
  async syncSchema(): Promise<number> {
    const data = await this.userDoc();
    return data?.syncSchema ?? 1;
  }

  /** Daily goals in display units, keyed by metric id; null when the user never set any. */
  async loadGoals(): Promise<Record<MetricId, number> | null> {
    const data = await this.userDoc();
    return data?.goals ?? null;
  }

  async saveGoals(goals: Readonly<Record<MetricId, number>>): Promise<void> {
    // mergeFields replaces the whole map, so a goal reset to its default really disappears.
    await setDoc(doc(db(), 'users', this.uid()), { goals }, { mergeFields: ['goals'] });
  }

  private async userDoc(): Promise<UserDoc | undefined> {
    const snapshot = await getDoc(doc(db(), 'users', this.uid()));
    return snapshot.data() as UserDoc | undefined;
  }

  async markSynced(at: string, syncSchema: number): Promise<void> {
    await setDoc(doc(db(), 'users', this.uid()), { lastSyncAt: at, syncSchema }, { merge: true });
  }

  private uid(): string {
    const user = this.auth.user();
    if (!user) {
      throw new Error('No signed-in user');
    }
    return user.uid;
  }

  private daysPath(): string {
    return `users/${this.uid()}/days`;
  }

  private workoutsPath(): string {
    return `users/${this.uid()}/workouts`;
  }

  private routesPath(): string {
    return `users/${this.uid()}/routes`;
  }
}

interface UserDoc {
  lastSyncAt?: string;
  syncSchema?: number;
  goals?: Record<MetricId, number>;
}

interface StoredRoute {
  polyline: string;
  points: number;
}
