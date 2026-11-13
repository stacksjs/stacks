/**
 * A list's filters, on the page: what each one's value looks like, how it is
 * worded, and how the days a person picks become what the server compares.
 *
 * The server says which filters a model's list has and what kind each is
 * (`Models/model-filters.ts`: derived from the model's fields, never
 * declared one by one). Nothing here knows a model; it knows the kinds.
 */

/** How a filter is asked for. Matches the server's `ModelFilterKind`. */
export type ModelListFilterKind = 'choice' | 'boolean' | 'relation' | 'date' | 'datetime' | 'number' | 'text'

export interface ModelListFilter {
  /** The column it narrows. */
  name: string
  label: string
  kind: ModelListFilterKind
  options?: Array<{ value: string, label: string }>
  /** The options are what the table holds now, not all the field may ever hold. */
  open?: boolean
  relation?: { slug: string, label: string }
}

/**
 * A filter's value. Text is "exactly this"; the rest say how: any of
 * several, between two days, between two numbers.
 */
export type ModelListFilterValue = string | { in: string[] } | { from?: string, to?: string } | { min?: number, max?: number }

export type ModelListFilterValues = Record<string, ModelListFilterValue>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** One value from an address, or null when it is not a shape a filter has. */
export function modelFilterValue(value: unknown): ModelListFilterValue | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value) === '' ? null : String(value)
  if (!isRecord(value))
    return null
  const keys = Object.keys(value)
  if (keys.length === 1 && keys[0] === 'in') {
    const list = Array.isArray(value.in) ? value.in.filter(item => typeof item === 'string' || typeof item === 'number').map(String).filter(item => item !== '') : []
    return list.length > 0 ? { in: [...new Set(list)] } : null
  }
  if (keys.length > 0 && keys.every(key => key === 'from' || key === 'to')) {
    const range: { from?: string, to?: string } = {}
    if (typeof value.from === 'string' && value.from !== '')
      range.from = value.from
    if (typeof value.to === 'string' && value.to !== '')
      range.to = value.to
    return range.from !== undefined || range.to !== undefined ? range : null
  }
  if (keys.length > 0 && keys.every(key => key === 'min' || key === 'max')) {
    const range: { min?: number, max?: number } = {}
    for (const edge of ['min', 'max'] as const) {
      const amount = value[edge]
      const number = typeof amount === 'number' ? amount : typeof amount === 'string' && amount.trim() !== '' ? Number(amount) : Number.NaN
      if (Number.isFinite(number))
        range[edge] = number
    }
    return range.min !== undefined || range.max !== undefined ? range : null
  }
  return null
}

/** Whether a filter narrows anything. An empty box, list or range does not. */
export function modelFilterIsSet(value: ModelListFilterValue | undefined | null): boolean {
  return value !== undefined && value !== null && modelFilterValue(value) !== null
}

/** The filters that narrow something, as the list sends them and its address carries them. */
export function modelFiltersSet(values: ModelListFilterValues): ModelListFilterValues {
  const out: ModelListFilterValues = {}
  for (const [column, value] of Object.entries(values)) {
    const read = modelFilterValue(value)
    if (read !== null)
      out[column] = read
  }
  return out
}

/** The values a choice filter has picked. */
export function modelFilterChosen(value: ModelListFilterValue | undefined): string[] {
  if (typeof value === 'string')
    return value === '' ? [] : [value]
  return value && 'in' in value ? value.in : []
}

/** Pick or unpick one option of a choice filter. Unpicking the last one clears the filter. */
export function modelFilterToggle(value: ModelListFilterValue | undefined, option: string): ModelListFilterValue {
  const chosen = modelFilterChosen(value)
  const next = chosen.includes(option) ? chosen.filter(item => item !== option) : [...chosen, option]
  return next.length === 0 ? '' : { in: next }
}

function pad(number: number): string {
  return String(number).padStart(2, '0')
}

/** A date as the day it is where the viewer is: `2026-01-31`. */
export function modelFilterDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The start of a day where the viewer is, or null when it is not a day. */
function startOfDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match)
    return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) || modelFilterDay(date) !== day ? null : date
}

/**
 * The value a range of days narrows by.
 *
 * A date column stores days, so the days go as they are, both included. A
 * moment is stored as an instant, and "the 5th" is a different stretch of
 * instants in Manila than in London: the page sends where the viewer's first
 * day starts and where the day after their last one does.
 */
export function modelFilterRange(kind: 'date' | 'datetime', from: string, to: string): ModelListFilterValue {
  const first = startOfDay(from)
  const last = startOfDay(to)
  if (!first && !last)
    return ''
  if (kind === 'date')
    return { ...(first ? { from } : {}), ...(last ? { to } : {}) }
  const range: { from?: string, to?: string } = {}
  if (first)
    range.from = first.toISOString()
  if (last)
    range.to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString()
  return range
}

/** The days a range filter is showing in its two date boxes. */
export function modelFilterDays(kind: 'date' | 'datetime', value: ModelListFilterValue | undefined): { from: string, to: string } {
  if (!value || typeof value === 'string' || !('from' in value || 'to' in value))
    return { from: '', to: '' }
  const range = value as { from?: string, to?: string }
  if (kind === 'date')
    return { from: range.from ?? '', to: range.to ?? '' }
  const from = range.from ? new Date(range.from) : null
  const to = range.to ? new Date(range.to) : null
  return {
    from: from && !Number.isNaN(from.getTime()) ? modelFilterDay(from) : '',
    // The instant sent is the start of the day after the last one.
    to: to && !Number.isNaN(to.getTime()) ? modelFilterDay(new Date(to.getTime() - 1)) : '',
  }
}

/** The ranges offered in one press. */
export const MODEL_FILTER_PRESETS = [
  { name: 'today', label: 'Today' },
  { name: 'week', label: 'Last 7 days' },
  { name: 'month', label: 'This month' },
] as const

export type ModelFilterPreset = typeof MODEL_FILTER_PRESETS[number]['name']

/** The first and last day of a preset, as of `now`. */
export function modelFilterPresetDays(preset: ModelFilterPreset, now: Date = new Date()): { from: string, to: string } {
  const today = modelFilterDay(now)
  if (preset === 'today')
    return { from: today, to: today }
  if (preset === 'week')
    return { from: modelFilterDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: today }
  return { from: modelFilterDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
}

/** A day as a sentence has it: "Jan 31, 2026". */
function wordedDay(day: string): string {
  const date = startOfDay(day)
  return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : day
}

/**
 * What an active filter says in its chip: "Active, Pending", "from Jan 1,
 * 2026", "at least 10". `names` words a record a relation filter points at;
 * without one it is named by its id, which is still true.
 */
export function modelFilterSummary(filter: ModelListFilter | undefined, value: ModelListFilterValue, names: Record<string, string> = {}): string {
  const worded = (stored: string): string => {
    if (filter?.kind === 'relation')
      return names[stored] ?? `#${stored}`
    if (filter?.kind === 'boolean')
      return ['true', '1', 'yes'].includes(stored.toLowerCase()) ? 'Yes' : 'No'
    return filter?.options?.find(option => option.value === stored)?.label ?? names[stored] ?? stored
  }
  if (typeof value === 'string')
    return worded(value)
  if ('in' in value)
    return value.in.map(worded).join(', ')
  if ('from' in value || 'to' in value) {
    const days = modelFilterDays(filter?.kind === 'date' ? 'date' : 'datetime', value)
    if (days.from && days.to)
      return days.from === days.to ? wordedDay(days.from) : `${wordedDay(days.from)} to ${wordedDay(days.to)}`
    return days.from ? `from ${wordedDay(days.from)}` : `until ${wordedDay(days.to)}`
  }
  const range = value as { min?: number, max?: number }
  if (range.min !== undefined && range.max !== undefined)
    return `${range.min.toLocaleString()} to ${range.max.toLocaleString()}`
  return range.min !== undefined ? `at least ${range.min.toLocaleString()}` : `at most ${(range.max ?? 0).toLocaleString()}`
}

/** A list's address with what narrows it: `?q=ava&filters={...}`. Nothing else is kept. */
export function modelListAddress(path: string, search: string, values: ModelListFilterValues): string {
  const params = new URLSearchParams()
  if (search.trim())
    params.set('q', search.trim())
  const set = modelFiltersSet(values)
  if (Object.keys(set).length > 0)
    params.set('filters', JSON.stringify(set))
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
