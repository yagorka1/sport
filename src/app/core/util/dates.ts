import { locale, t } from '@core/i18n/i18n';
import { DateRange, Period, PERIOD_DAYS } from '@core/metrics/metric.model';

/** Local calendar date as YYYY-MM-DD — unlike toISOString(), this does not shift into UTC. */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function today(): string {
  return toDayKey(new Date());
}

/** A range ending today. */
export function lastDays(days: number): DateRange {
  const end = new Date();
  return { from: toDayKey(addDays(end, -(days - 1))), to: toDayKey(end) };
}

/** Splits a range into consecutive chunks of at most `maxDays` days, oldest first. */
export function splitRange(range: DateRange, maxDays: number): DateRange[] {
  const chunks: DateRange[] = [];
  const end = fromDayKey(range.to);
  for (let start = fromDayKey(range.from); start <= end; start = addDays(start, maxDays)) {
    const chunkEnd = addDays(start, maxDays - 1);
    chunks.push({ from: toDayKey(start), to: toDayKey(chunkEnd < end ? chunkEnd : end) });
  }
  return chunks;
}

export function rangeForPeriod(period: Period): DateRange {
  return lastDays(PERIOD_DAYS[period]);
}

/** Every day of the range, inclusive — so days without data still show up on a chart. */
export function eachDay(range: DateRange): string[] {
  const days: string[] = [];
  const end = fromDayKey(range.to);
  for (let cursor = fromDayKey(range.from); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(toDayKey(cursor));
  }
  return days;
}

/** Intl formatters are costly to build, so keep one per locale and format. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale()}|${name}`;
  let cached = formatters.get(cacheKey);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale(), options);
    formatters.set(cacheKey, cached);
  }
  return cached;
}

export function formatDayLabel(dayKey: string): string {
  return formatter('day', { day: 'numeric', month: 'short' }).format(fromDayKey(dayKey));
}

export function formatWeekday(dayKey: string): string {
  return formatter('weekday', { weekday: 'short' }).format(fromDayKey(dayKey));
}

/** Short date and time, e.g. for a workout start. */
export function formatDateTime(iso: string): string {
  return formatter('dateTime', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? t('duration.hoursMinutes', { h, m }) : t('duration.minutes', { m });
}
