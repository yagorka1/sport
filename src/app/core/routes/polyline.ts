import { LatLng } from '@core/metrics/metric.model';

/**
 * GPS tracks are stored as Google encoded polylines (precision 1e-5, about 1 m): roughly
 * 6–8 characters per point instead of ~40 for JSON numbers, which keeps even a long ride
 * far below Firestore's 1 MB document limit.
 */

const PRECISION = 1e5;

/** Points closer than this to the simplified line are dropped; invisible at any map zoom used. */
const SIMPLIFY_TOLERANCE_M = 2;

export function encodePolyline(points: readonly LatLng[]): string {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const [lat, lng] of points) {
    const latE5 = Math.round(lat * PRECISION);
    const lngE5 = Math.round(lng * PRECISION);
    result += encodeSigned(latE5 - prevLat) + encodeSigned(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return result;
}

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    const dLat = decodeSigned(encoded, index);
    index = dLat.next;
    const dLng = decodeSigned(encoded, index);
    index = dLng.next;
    lat += dLat.value;
    lng += dLng.value;
    points.push([lat / PRECISION, lng / PRECISION]);
  }
  return points;
}

/** Douglas–Peucker, iterative so a multi-hour track cannot overflow the stack. */
export function simplifyRoute(
  points: readonly LatLng[],
  toleranceM = SIMPLIFY_TOLERANCE_M,
): LatLng[] {
  if (points.length <= 2) return [...points];

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = distanceToSegmentM(points[i], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > toleranceM) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

function encodeSigned(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let result = '';
  while (v >= 0x20) {
    result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return result + String.fromCharCode(v + 63);
}

function decodeSigned(encoded: string, start: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte: number;
  do {
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return { value: result & 1 ? ~(result >> 1) : result >> 1, next: index };
}

/**
 * Distance from a point to a segment in meters, on a local flat projection — accurate
 * enough over the few kilometers a single segment spans.
 */
function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const metersPerDegLat = 111_320;
  const metersPerDegLng = metersPerDegLat * Math.cos((a[0] * Math.PI) / 180);

  const px = (p[1] - a[1]) * metersPerDegLng;
  const py = (p[0] - a[0]) * metersPerDegLat;
  const bx = (b[1] - a[1]) * metersPerDegLng;
  const by = (b[0] - a[0]) * metersPerDegLat;

  const lengthSq = bx * bx + by * by;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSq));
  return Math.hypot(px - t * bx, py - t * by);
}
