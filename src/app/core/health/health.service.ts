import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { MetricDescriptor, MetricId } from '@core/metrics/metric.model';
import { activeMetrics } from '@core/metrics/metric.registry';
import { HealthSource } from './health-source';
import { HealthConnectSource } from './health-connect.source';
import { DemoSource } from './demo.source';

export type HealthStatus = 'checking' | 'ready' | 'needs-permission' | 'unavailable' | 'demo';

/**
 * Entry point for health data: picks a source for the current platform and keeps the
 * access state. In a browser Health Connect does not exist (it is on-device Android
 * storage), so the source there is DemoSource, while real data reaches the web build
 * from Firestore after the phone has synced it.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  readonly source: HealthSource = Capacitor.isNativePlatform()
    ? new HealthConnectSource()
    : new DemoSource();

  readonly status = signal<HealthStatus>('checking');
  readonly granted = signal<ReadonlySet<MetricId>>(new Set());

  /** true when data does not come from Health Connect — the UI shows a banner. */
  get isDemo(): boolean {
    return this.source.kind === 'demo';
  }

  async initialize(): Promise<void> {
    if (this.isDemo) {
      this.granted.set(new Set(activeMetrics().map((m) => m.id)));
      this.status.set('demo');
      return;
    }

    if (!(await this.source.isAvailable())) {
      this.status.set('unavailable');
      return;
    }

    const granted = await this.source.grantedMetrics(activeMetrics());
    this.granted.set(granted);
    this.status.set(granted.size > 0 ? 'ready' : 'needs-permission');
  }

  async requestAccess(): Promise<boolean> {
    const granted = await this.source.requestAccess(activeMetrics());
    this.granted.set(granted);
    const ok = granted.size > 0;
    this.status.set(ok ? 'ready' : 'needs-permission');
    return ok;
  }

  /** Metrics we can actually read: enabled in the registry and granted by the user. */
  readableMetrics(): readonly MetricDescriptor[] {
    const granted = this.granted();
    return activeMetrics().filter((m) => granted.has(m.id));
  }

  async openSystemSettings(): Promise<void> {
    if (this.source instanceof HealthConnectSource) {
      await this.source.openSettings();
    }
  }
}
