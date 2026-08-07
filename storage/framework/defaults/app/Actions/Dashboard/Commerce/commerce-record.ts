export interface CommerceNumberOptions {
  min?: number
  max?: number
  integer?: boolean
}

export function commerceValue(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

export function commerceRecordError(source: string, field: string, expectation: string): TypeError {
  return new TypeError(`${source}.${field} must be ${expectation}.`)
}

export function commerceIdentifier(input: unknown, source: string, field = 'id'): string {
  if (typeof input === 'string' && input.trim())
    return input.trim()
  if (typeof input === 'number' && Number.isSafeInteger(input) && input > 0)
    return String(input)
  if (typeof input === 'bigint' && input > 0)
    return String(input)
  throw commerceRecordError(source, field, 'a positive integer or non-empty string')
}

export function commerceOptionalIdentifier(input: unknown, source: string, field: string): string {
  if (input === undefined || input === null || input === '')
    return ''
  return commerceIdentifier(input, source, field)
}

export function commerceRequiredString(input: unknown, source: string, field: string): string {
  if (typeof input !== 'string' || !input.trim())
    throw commerceRecordError(source, field, 'a non-empty string')
  return input.trim()
}

export function commerceOptionalString(input: unknown, source: string, field: string): string {
  if (input === undefined || input === null || input === '')
    return ''
  if (typeof input !== 'string')
    throw commerceRecordError(source, field, 'a string or null')
  return input.trim()
}

export function commerceStringList(input: unknown, source: string, field: string): string[] {
  if (input === undefined || input === null || input === '')
    return []

  let values: unknown[]
  if (Array.isArray(input)) {
    values = input
  }
  else if (typeof input === 'string') {
    const raw = input.trim()
    if (!raw)
      return []
    if (raw.startsWith('[') || raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed))
          throw new TypeError('Expected an array.')
        values = parsed
      }
      catch {
        throw commerceRecordError(source, field, 'a JSON array or delimited string list')
      }
    }
    else {
      values = raw.split(/[\n,|;]+/)
    }
  }
  else {
    throw commerceRecordError(source, field, 'a JSON array or delimited string list')
  }

  const result = values.map((value) => {
    if (typeof value !== 'string' || !value.trim())
      throw commerceRecordError(source, field, 'a list of non-empty strings')
    return value.trim()
  })
  return [...new Set(result)]
}

export function commerceNumber(
  input: unknown,
  source: string,
  field: string,
  options: CommerceNumberOptions = {},
): number {
  const result = typeof input === 'number'
    ? input
    : typeof input === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(input.trim())
      ? Number(input)
      : Number.NaN

  if (!Number.isFinite(result))
    throw commerceRecordError(source, field, 'a finite number')
  if (options.integer && !Number.isInteger(result))
    throw commerceRecordError(source, field, 'an integer')
  if (options.min !== undefined && result < options.min)
    throw commerceRecordError(source, field, `at least ${options.min}`)
  if (options.max !== undefined && result > options.max)
    throw commerceRecordError(source, field, `at most ${options.max}`)
  return result
}

export function commerceOptionalNumber(
  input: unknown,
  source: string,
  field: string,
  options: CommerceNumberOptions = {},
): number | null {
  if (input === undefined || input === null || input === '')
    return null
  return commerceNumber(input, source, field, options)
}

export function commerceBoolean(input: unknown, source: string, field: string): boolean {
  if (input === true || input === 1 || input === '1' || input === 'true')
    return true
  if (input === false || input === 0 || input === '0' || input === 'false')
    return false
  throw commerceRecordError(source, field, 'a boolean')
}

export function commerceEnum<const T extends string>(
  input: unknown,
  source: string,
  field: string,
  values: readonly T[],
): T {
  const result = commerceRequiredString(input, source, field)
  if (!values.includes(result as T))
    throw commerceRecordError(source, field, values.join(' or '))
  return result as T
}

export function commerceCurrency(input: unknown, source: string, field = 'currency'): string {
  const result = commerceRequiredString(input, source, field).toUpperCase()
  if (!/^[A-Z]{3}$/.test(result))
    throw commerceRecordError(source, field, 'a three-letter currency code')
  return result
}

export function commerceEmail(input: unknown, source: string, field = 'email'): string {
  const result = commerceRequiredString(input, source, field)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw commerceRecordError(source, field, 'a valid email address')
  return result
}

export function commerceOptionalEmail(input: unknown, source: string, field = 'email'): string {
  if (input === undefined || input === null || input === '')
    return ''
  return commerceEmail(input, source, field)
}

export function commerceUrl(input: unknown, source: string, field: string): string {
  const result = commerceRequiredString(input, source, field)
  try {
    const url = new URL(result)
    if (url.protocol !== 'https:' && url.protocol !== 'http:')
      throw new TypeError('Unsupported URL protocol.')
    return url.toString()
  }
  catch {
    throw commerceRecordError(source, field, 'a valid HTTP or HTTPS URL')
  }
}

export function commerceTimestamp(input: unknown, source: string, field = 'created_at'): string {
  // Postgres and MySQL drivers return Date instances for timestamp columns;
  // SQLite stores TEXT and returns strings. Accept both.
  if (input instanceof Date) {
    if (!Number.isFinite(input.getTime()))
      throw commerceRecordError(source, field, 'a valid timestamp')
    return input.toISOString()
  }
  const raw = typeof input === 'number'
    ? String(input)
    : commerceRequiredString(input, source, field)
  const timestamp = /^\d{10}$/.test(raw)
    ? Number(raw) * 1000
    : /^\d{13}$/.test(raw)
      ? Number(raw)
      : /^\d{4}-\d{2}-\d{2} \d/.test(raw)
        ? `${raw.replace(' ', 'T')}Z`
        : raw
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime()))
    throw commerceRecordError(source, field, 'a valid timestamp')
  return date.toISOString()
}

export function commerceOptionalTimestamp(input: unknown, source: string, field: string): string {
  if (input === undefined || input === null || input === '')
    return ''
  return commerceTimestamp(input, source, field)
}

export function commerceDate(input: unknown, source: string, field: string): string {
  // Postgres and MySQL drivers return Date instances for date columns.
  if (input instanceof Date) {
    if (!Number.isFinite(input.getTime()))
      throw commerceRecordError(source, field, 'a valid YYYY-MM-DD date')
    return input.toISOString().slice(0, 10)
  }
  const raw = commerceRequiredString(input, source, field)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    throw commerceRecordError(source, field, 'a valid YYYY-MM-DD date')
  const date = new Date(`${raw}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw)
    throw commerceRecordError(source, field, 'a valid YYYY-MM-DD date')
  return raw
}

export function commerceOptionalDate(input: unknown, source: string, field: string): string {
  if (input === undefined || input === null || input === '')
    return ''
  return commerceDate(input, source, field)
}
