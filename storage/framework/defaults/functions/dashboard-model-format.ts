/**
 * How a model field's stored value reads, where the model says how
 * (`dashboard.fields.<name>.format`): 1200 as "$12.00", 1536 as "1.5 KB".
 *
 * One function for the list, the record's page and the panels, so a value
 * reads the same wherever it is shown. Formatting happens here and not on
 * the server because it follows the viewer: their locale for a number and a
 * date, their time zone for a moment.
 */
import { formatCurrency } from '@stacksjs/commerce/money'
import { parseDashboardDate } from './dashboard-dates'

export type ModelFieldFormat = 'badge' | 'bytes' | 'code' | 'date' | 'datetime' | 'duration' | 'image' | 'link' | 'money' | 'number' | 'percent' | 'text'

/** A format, with what it needs to be read: see `model-fields` on the server. */
export interface ModelFieldDisplay {
  format: ModelFieldFormat
  /** For `money`: the ISO code every amount is in. */
  currency?: string
  /** For `money`: the column holding each row's own ISO code. */
  currencyColumn?: string
  /** For `duration`: what the stored number counts. Milliseconds unless said. */
  unit?: 'ms' | 's'
}

/** What a status-like word says: settled, ended, under way, or neither. */
export type ModelBadgeTone = 'positive' | 'negative' | 'pending' | 'neutral'

export interface ModelFormattedValue {
  /** How it is drawn: words, a pill, a link out, a thumbnail, a code font. */
  kind: 'text' | 'badge' | 'link' | 'image' | 'code'
  text: string
  /** Where a link leads, or what an image draws. */
  href?: string
  /** For a pill: what its word says, for its colour. */
  tone?: ModelBadgeTone
}

/** Columns whose value is one word out of a few: drawn as a pill. */
export const MODEL_BADGE_COLUMNS: ReadonlySet<string> = new Set(['status', 'state', 'type', 'role', 'source', 'plan', 'category', 'kind', 'channel', 'driver', 'priority', 'visibility', 'guard_name', 'provider', 'locale', 'currency'])

const POSITIVE: ReadonlySet<string> = new Set(['active', 'approved', 'completed', 'delivered', 'done', 'enabled', 'healthy', 'live', 'paid', 'published', 'resolved', 'subscribed', 'succeeded', 'success', 'verified'])
const NEGATIVE: ReadonlySet<string> = new Set(['banned', 'blocked', 'bounced', 'canceled', 'cancelled', 'declined', 'disabled', 'error', 'expired', 'failed', 'inactive', 'rejected', 'revoked', 'suspended', 'unsubscribed'])
const PENDING: ReadonlySet<string> = new Set(['draft', 'in_progress', 'invited', 'pending', 'processing', 'queued', 'review', 'scheduled', 'trialing', 'unverified'])

/**
 * What a status-like word says. Only the words that say it: a role or a
 * plan is a word out of a few too, and "admin" is neither good news nor bad.
 */
export function modelBadgeTone(word: unknown): ModelBadgeTone {
  const said = String(word ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (POSITIVE.has(said))
    return 'positive'
  if (NEGATIVE.has(said))
    return 'negative'
  return PENDING.has(said) ? 'pending' : 'neutral'
}

/**
 * How a cell reads when the model says (`format`), or when its column is one
 * the dashboard knows as a status-like word. Null when neither, or when
 * nothing is stored: the caller words those itself.
 */
export function modelCellDisplay(column: { name: string, format?: ModelFieldDisplay }, value: unknown, row: Record<string, unknown> = {}): ModelFormattedValue | null {
  if (column.format)
    return modelFormattedValue(value, column.format, row)
  if (MODEL_BADGE_COLUMNS.has(column.name) && typeof value === 'string' && value !== '' && value.length <= 32)
    return { kind: 'badge', text: titleCase(value), tone: modelBadgeTone(value) }
  return null
}

const NUMERIC: ReadonlySet<ModelFieldFormat> = new Set(['bytes', 'duration', 'money', 'number', 'percent'])

/** Whether a column is read as an amount, and so lines up on the right. */
export function modelColumnIsNumeric(column: { type?: string, format?: ModelFieldDisplay }): boolean {
  return column.format ? NUMERIC.has(column.format.format) : column.type === 'number'
}

/** Whether a column is a day or a moment. */
export function modelColumnIsDate(column: { name: string, type?: string, format?: ModelFieldDisplay }): boolean {
  if (column.format)
    return column.format.format === 'date' || column.format.format === 'datetime'
  return column.type === 'date' || /_(?:at|on)$/.test(column.name)
}

function trimmed(value: number, digits: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits })
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/** A size in the largest unit that keeps it above one: 1536 is "1.5 KB". */
export function modelByteSize(bytes: number): string {
  let value = Math.abs(bytes)
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  // Rounding 1023.96 KB would print "1,024 KB": that is 1 MB.
  if (unit > 0 && unit < BYTE_UNITS.length - 1 && Number(value.toFixed(1)) >= 1024) {
    value /= 1024
    unit += 1
  }
  return `${bytes < 0 ? '-' : ''}${trimmed(value, unit === 0 ? 0 : 1)} ${BYTE_UNITS[unit]}`
}

/**
 * A length of time in the two largest units that say it: 83000 ms is
 * "1 min 23 s", 420 ms is "420 ms", 1250 ms is "1.3 s".
 */
export function modelDuration(value: number, unit: 'ms' | 's' = 'ms'): string {
  const milliseconds = Math.abs(unit === 's' ? value * 1000 : value)
  const sign = value < 0 ? '-' : ''
  if (milliseconds < 999.5)
    return `${sign}${trimmed(milliseconds, milliseconds < 10 ? 2 : 0)} ms`
  if (milliseconds < 59_950)
    return `${sign}${trimmed(milliseconds / 1000, 1)} s`
  // Whole seconds from here, rounded once, so a part never reads "60 s".
  const seconds = Math.round(milliseconds / 1000)
  const parts: Array<[number, string]> = [
    [Math.floor(seconds / 86_400), 'd'],
    [Math.floor(seconds % 86_400 / 3600), 'h'],
    [Math.floor(seconds % 3600 / 60), 'min'],
    [seconds % 60, 's'],
  ]
  const first = parts.findIndex(([amount]) => amount > 0)
  return sign + parts.slice(first, first + 2).filter(([amount]) => amount > 0).map(([amount, name]) => `${amount} ${name}`).join(' ')
}

function titleCase(words: string): string {
  return words.replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

/** A web or mail address a link may lead to. Nothing else: never `javascript:`. */
function linkTarget(text: string): string {
  if (/^https?:\/\/\S+$/i.test(text) || /^mailto:\S+@\S+$/i.test(text))
    return text
  return /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(text) ? `mailto:${text}` : ''
}

/** A web address or a path on this site an image may be drawn from. */
function imageSource(text: string): string {
  return /^https?:\/\/\S+$/i.test(text) || /^\/(?!\/)\S*$/.test(text) ? text : ''
}

/**
 * A stored value as the model says it reads. Null when nothing is stored:
 * what an empty field says is the page's to decide.
 *
 * A value the format cannot read (text where an amount was expected) is
 * shown as stored, never dropped and never dressed up as a number.
 */
export function modelFormattedValue(value: unknown, display: ModelFieldDisplay, row: Record<string, unknown> = {}): ModelFormattedValue | null {
  if (value === null || value === undefined || value === '')
    return null
  const stored = typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : String(value)
  const plain: ModelFormattedValue = { kind: 'text', text: stored }
  const amount = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN

  switch (display.format) {
    case 'money': {
      if (!Number.isFinite(amount))
        return plain
      const own = display.currencyColumn ? row[display.currencyColumn] : undefined
      return { kind: 'text', text: formatCurrency(amount, typeof own === 'string' && own ? own : display.currency) }
    }
    case 'number':
      return Number.isFinite(amount) ? { kind: 'text', text: amount.toLocaleString() } : plain
    case 'percent':
      return Number.isFinite(amount) ? { kind: 'text', text: `${trimmed(amount, 2)}%` } : plain
    case 'bytes':
      return Number.isFinite(amount) ? { kind: 'text', text: modelByteSize(amount) } : plain
    case 'duration':
      return Number.isFinite(amount) ? { kind: 'text', text: modelDuration(amount, display.unit) } : plain
    case 'date':
    case 'datetime': {
      // A number is a unix time, in seconds unless it is too large to be.
      const at = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : parseDashboardDate(value)
      if (Number.isNaN(at.getTime()))
        return plain
      const options: Intl.DateTimeFormatOptions = display.format === 'date' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }
      return { kind: 'text', text: new Intl.DateTimeFormat(undefined, options).format(at) }
    }
    case 'badge':
      return { kind: 'badge', text: titleCase(stored), tone: modelBadgeTone(stored) }
    case 'link': {
      const href = linkTarget(stored.trim())
      // Without the scheme: it is the same on every row and says nothing.
      return href ? { kind: 'link', text: stored.trim().replace(/^(?:https?:\/\/|mailto:)/i, '').replace(/\/$/, ''), href } : plain
    }
    case 'image': {
      const href = imageSource(stored.trim())
      return href ? { kind: 'image', text: stored.trim(), href } : plain
    }
    case 'code':
      return { kind: 'code', text: stored }
    default:
      return plain
  }
}
