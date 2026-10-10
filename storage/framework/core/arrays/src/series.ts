/** Numeric observations grouped by calendar day, with provenance per field. */
export interface DailyObservation {
  day: string
  source: string
  values: Record<string, unknown>
  updatedAt?: string
}
export interface DailySeriesPoint {
  date: string
  values: Record<string, number>
  sources: Record<string, string>
}

/** Reject absent and nonnumeric values without turning null, false or blanks into zero. */
export function finiteNumeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** Prefer a direct source per field; a missing field can fall back to another source. */
export function mergeDailySeries(rows: readonly DailyObservation[], priority: readonly string[] = []): DailySeriesPoint[] {
  const rank = (source: string) => {
    const at = priority.indexOf(source)
    return at < 0 ? priority.length : at
  }
  const sorted = [...rows].sort((a, b) => rank(a.source) - rank(b.source)
    || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    || a.source.localeCompare(b.source))
  const days = new Map<string, DailySeriesPoint>()
  for (const row of sorted) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day)) continue
    const parsed = new Date(`${row.day}T00:00:00Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== row.day) continue
    const point = days.get(row.day) || { date: row.day, values: {}, sources: {} }
    for (const [key, raw] of Object.entries(row.values)) {
      if (Object.hasOwn(point.values, key)) continue
      const value = finiteNumeric(raw)
      if (value === null) continue
      Object.defineProperty(point.values, key, { value, enumerable: true, configurable: true, writable: true })
      Object.defineProperty(point.sources, key, { value: row.source, enumerable: true, configurable: true, writable: true })
    }
    if (Object.keys(point.values).length) days.set(row.day, point)
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface NumericSeriesPoint { date: string, value: number, source?: string }
export interface NumericSeriesSummary {
  count: number
  latest: NumericSeriesPoint | null
  average: number | null
  lowest: number | null
  highest: number | null
}
/** Statistics over valid observations, including zero; latest is by date rather than input order. */
export function summarizeSeries(points: readonly NumericSeriesPoint[]): NumericSeriesSummary {
  const valid = points.filter(point => Number.isFinite(point.value)).sort((a, b) => a.date.localeCompare(b.date))
  let sum = 0
  let lowest = Infinity
  let highest = -Infinity
  for (const point of valid) {
    sum += point.value
    lowest = Math.min(lowest, point.value)
    highest = Math.max(highest, point.value)
  }
  return { count: valid.length, latest: valid.at(-1) ?? null, average: valid.length ? sum / valid.length : null,
    lowest: valid.length ? lowest : null, highest: valid.length ? highest : null }
}
