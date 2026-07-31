interface NumberFieldOptions {
  min?: number
  max?: number
  integer?: boolean
}

function fieldError(source: string, field: string, expectation: string): TypeError {
  return new TypeError(`${source}.${field} must be ${expectation}.`)
}

export function analyticsIdentifier(value: unknown, source: string, field = 'id'): string {
  if (typeof value === 'string' && value.trim())
    return value.trim()
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return String(value)
  if (typeof value === 'bigint')
    return String(value)
  throw fieldError(source, field, 'a non-empty string or integer')
}

export function analyticsString(value: unknown, source: string, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw fieldError(source, field, 'a non-empty string')
  return value.trim()
}

export function analyticsOptionalString(value: unknown, source: string, field: string): string {
  if (value === undefined || value === null || value === '')
    return ''
  if (typeof value !== 'string')
    throw fieldError(source, field, 'a string or null')
  return value.trim()
}

export function analyticsNumber(
  value: unknown,
  source: string,
  field: string,
  options: NumberFieldOptions = {},
): number {
  let normalized: number
  if (typeof value === 'number') {
    normalized = value
  }
  else if (typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    normalized = Number(value)
  }
  else {
    throw fieldError(source, field, 'a finite number')
  }

  if (!Number.isFinite(normalized))
    throw fieldError(source, field, 'a finite number')
  if (options.integer && !Number.isInteger(normalized))
    throw fieldError(source, field, 'an integer')
  if (options.min !== undefined && normalized < options.min)
    throw fieldError(source, field, `at least ${options.min}`)
  if (options.max !== undefined && normalized > options.max)
    throw fieldError(source, field, `at most ${options.max}`)
  return normalized
}

export function analyticsOptionalNumber(
  value: unknown,
  source: string,
  field: string,
  options: NumberFieldOptions = {},
): number | null {
  if (value === undefined || value === null || value === '')
    return null
  return analyticsNumber(value, source, field, options)
}

export function analyticsCurrency(value: unknown, source: string, field = 'currency'): string {
  const currency = analyticsString(value, source, field).toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency))
    throw fieldError(source, field, 'a three-letter currency code')
  return currency
}

export function analyticsTimestamp(value: unknown, source: string, field = 'created_at'): string {
  const raw = value instanceof Date
    ? value
    : typeof value === 'string' && value.trim()
      ? new Date(/^\d{4}-\d{2}-\d{2} \d/.test(value)
          ? `${value.trim().replace(' ', 'T')}Z`
          : value.trim())
      : null

  if (!raw || !Number.isFinite(raw.getTime()))
    throw fieldError(source, field, 'a valid timestamp')
  return raw.toISOString()
}
