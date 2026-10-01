import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { LatLngBounds, LayerGroup, Map as LeafletMap } from 'leaflet';
import { LatLng } from '@core/metrics/metric.model';
import { TranslatePipe } from '@core/i18n/translate.pipe';

type Leaflet = typeof import('leaflet');

/**
 * A workout's GPS track on an OpenStreetMap base map.
 *
 * Leaflet is imported on first use, so it lands in this lazy chunk instead of the initial
 * bundle. Encapsulation is off because Leaflet builds its DOM itself: emulated styles would
 * never match those elements, and its stylesheet has to apply to them.
 */
@Component({
  selector: 'app-route-map',
  imports: [TranslatePipe],
  templateUrl: './route-map.component.html',
  styleUrl: './route-map.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class RouteMapComponent {
  readonly points = input.required<readonly LatLng[]>();
  readonly color = input('#4f8ff7');

  protected readonly failed = signal(false);

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');

  private map: LeafletMap | null = null;
  private track: LayerGroup | null = null;
  private bounds: LatLngBounds | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  constructor() {
    afterRenderEffect(() => {
      // Any failure shows a message instead of a silent empty box.
      this.draw(this.container().nativeElement, this.points(), this.color()).catch((e: unknown) => {
        console.error('Route map failed', e);
        this.failed.set(true);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.resizeObserver?.disconnect();
      this.map?.remove();
    });
  }

  private async draw(element: HTMLElement, points: readonly LatLng[], color: string): Promise<void> {
    const L = await loadLeaflet();

    // A single bad coordinate turns the bounds into NaN and the whole map into an empty box.
    const valid = points.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (this.destroyed || valid.length < 2) return;

    const map = (this.map ??= this.createMap(L, element));
    this.track?.remove();

    const latLngs = valid.map(([lat, lng]) => L.latLng(lat, lng));
    const line = L.polyline(latLngs, { color, weight: 4, opacity: 0.95 });
    const marker = (at: (typeof latLngs)[number], fill: string) =>
      L.circleMarker(at, { radius: 6, color: '#fff', weight: 2, fillColor: fill, fillOpacity: 1 });

    this.track = L.layerGroup([
      line,
      marker(latLngs[0], '#39b98a'),
      marker(latLngs[latLngs.length - 1], '#e0555f'),
    ]).addTo(map);

    this.bounds = line.getBounds();
    this.fit();
  }

  private createMap(L: Leaflet, element: HTMLElement): LeafletMap {
    const map = L.map(element, { zoomControl: true });

    // OSM tiles, darkened in CSS to suit the UI (free dark tile sets such as CARTO's now require
    // an API key). OSM requires visible attribution.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Leaflet measures its container once. If the layout settles later (a WebView that is
    // still sizing, a rotated phone), the map keeps the stale size and draws nothing useful —
    // so re-measure and re-fit on every size change.
    this.resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
      this.fit();
    });
    this.resizeObserver.observe(element);

    return map;
  }

  private fit(): void {
    const element = this.container().nativeElement;
    if (!this.map || !this.bounds || element.clientWidth === 0 || element.clientHeight === 0) {
      return;
    }
    this.map.fitBounds(this.bounds, { padding: [24, 24] });
  }
}

let leaflet: Promise<Leaflet> | null = null;

function loadLeaflet(): Promise<Leaflet> {
  // A failed chunk load must not stick: the next attempt retries the import.
  return (leaflet ??= import('leaflet').then(unwrapCommonJs, (e: unknown) => {
    leaflet = null;
    throw e;
  }));
}

/**
 * Leaflet is a CommonJS module. In development builds its exports show up on the import's
 * namespace, but optimized builds hand them over only as `default` — `L.map` was undefined
 * in the APK and the map stayed an empty box. Take whichever object actually has the API.
 */
function unwrapCommonJs(module: Leaflet & { default?: Leaflet }): Leaflet {
  return typeof module.map === 'function' ? module : module.default!;
}
