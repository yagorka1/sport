import { Component, computed, input } from '@angular/core';
import { HeartRateSeries } from '@core/metrics/metric.model';
import { formatDuration } from '@core/util/dates';

interface Axis {
  readonly label: string;
  /** Position in percent: from the bottom for Y, from the left for X. */
  readonly at: number;
}

/** Drawing space of the SVG; it is stretched to the element, so only ratios matter. */
const WIDTH = 1000;
const HEIGHT = 200;

/**
 * Heart rate over a workout. The SVG holds only the line and the fill (stretched with
 * preserveAspectRatio="none"), while labels are HTML on top, so text never gets distorted.
 */
@Component({
  selector: 'app-heart-rate-chart',
  templateUrl: './heart-rate-chart.component.html',
  styleUrl: './heart-rate-chart.component.scss',
})
export class HeartRateChartComponent {
  readonly series = input.required<HeartRateSeries>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  private readonly range = computed(() => {
    const values = this.series().bpm.filter((v): v is number => v !== null);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Round outward to tens, so gridlines land on readable numbers.
    const low = Math.floor((min - 5) / 10) * 10;
    const high = Math.ceil((max + 5) / 10) * 10;
    return { low, high: high > low ? high : low + 10 };
  });

  /** One path per run of samples: a gap in the data stays a gap on the chart. */
  protected readonly segments = computed<readonly string[]>(() => {
    const { bpm } = this.series();
    const segments: string[] = [];
    let current: string[] = [];
    bpm.forEach((value, i) => {
      if (value === null) {
        if (current.length > 0) segments.push(current.join(' '));
        current = [];
        return;
      }
      current.push(`${this.x(i).toFixed(1)},${this.y(value).toFixed(1)}`);
    });
    if (current.length > 0) segments.push(current.join(' '));
    return segments;
  });

  /** The filled area under each segment. */
  protected readonly areas = computed<readonly string[]>(() =>
    this.segments().map((points) => {
      const first = points.split(' ')[0].split(',')[0];
      const last = points.split(' ').at(-1)!.split(',')[0];
      return `M${first},${HEIGHT} L${points.replaceAll(' ', ' L')} L${last},${HEIGHT} Z`;
    }),
  );

  protected readonly yAxis = computed<readonly Axis[]>(() => {
    const { low, high } = this.range();
    const step = high - low > 60 ? 20 : 10;
    const ticks: Axis[] = [];
    for (let v = low; v <= high; v += step) {
      ticks.push({ label: `${v}`, at: ((v - low) / (high - low)) * 100 });
    }
    return ticks;
  });

  protected readonly xAxis = computed<readonly Axis[]>(() => {
    const { bpm, stepSec } = this.series();
    const total = bpm.length * stepSec;
    return [0, 0.5, 1].map((share) => ({
      label: share === 0 ? '0' : formatDuration(total * share),
      at: share * 100,
    }));
  });

  private x(index: number): number {
    const count = this.series().bpm.length;
    return count <= 1 ? 0 : (index / (count - 1)) * WIDTH;
  }

  private y(value: number): number {
    const { low, high } = this.range();
    return HEIGHT - ((value - low) / (high - low)) * HEIGHT;
  }
}
