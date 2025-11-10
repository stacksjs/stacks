/**
 * Format bytes to human-readable string (pretty-bytes replacement)
 */

export interface BytesOptions {
  /**
   * Number of decimal places
   * @default 1
   */
  precision?: number

  /**
   * Use binary units (KiB, MiB, GiB) instead of decimal (KB, MB, GB)
   * @default false
   */
  binary?: boolean

  /**
   * Include space between number and unit
   * @default true
   */
  space?: boolean

  /**
   * Locale for number formatting
   * @default 'en-US'
   */
  locale?: string

  /**
   * Minimum fraction digits
   * @default 0
   */
  minimumFractionDigits?: number

  /**
   * Maximum fraction digits
   * @default undefined (uses precision)
   */
  maximumFractionDigits?: number
}

const DECIMAL_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
const BINARY_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

/**
 * Format bytes to human-readable string
 *
 * @example
 * ```ts
 * formatBytes(1024) // '1 KB'
 * formatBytes(1024, { binary: true }) // '1 KiB'
 * formatBytes(1234567) // '1.2 MB'
 * formatBytes(1234567, { precision: 2 }) // '1.23 MB'
 * ```
 */
export function formatBytes(bytes: number, options: BytesOptions = {}): string {
  const {
    precision = 1,
    binary = false,
    space = true,
    locale = 'en-US',
    minimumFractionDigits = 0,
    maximumFractionDigits = precision,
  } = options

  if (!Number.isFinite(bytes)) {
    throw new TypeError(`Expected a finite number, got ${typeof bytes}: ${bytes}`)
  }

  const isNegative = bytes < 0
  const prefix = isNegative ? '-' : ''

  if (isNegative) {
    bytes = -bytes
  }

  if (bytes < 1) {
    const numberString = bytes.toLocaleString(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
    })
    return `${prefix}${numberString}${space ? ' ' : ''}B`
  }

  const base = binary ? 1024 : 1000
  const units = binary ? BINARY_UNITS : DECIMAL_UNITS
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1)

  const value = bytes / base ** exponent
  const numberString = value.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })

  const unit = units[exponent]
  const separator = space ? ' ' : ''

  return `${prefix}${numberString}${separator}${unit}`
}

/**
 * Parse human-readable byte string to number
 *
 * @example
 * ```ts
 * parseBytes('1 KB') // 1000
 * parseBytes('1 KiB') // 1024
 * parseBytes('1.5 MB') // 1500000
 * ```
 */
export function parseBytes(input: string): number {
  const match = input.match(/^(-?[\d.]+)\s*([A-Za-z]+)?$/)

  if (!match) {
    throw new Error(`Invalid byte string: ${input}`)
  }

  const [, numberStr, unit = 'B'] = match
  const number = Number.parseFloat(numberStr)

  if (!Number.isFinite(number)) {
    throw new Error(`Invalid number in byte string: ${numberStr}`)
  }

  const normalizedUnit = unit.toUpperCase()
  const isBinary = normalizedUnit.endsWith('IB')
  const base = isBinary ? 1024 : 1000

  let exponent = 0
  const units = isBinary ? BINARY_UNITS : DECIMAL_UNITS

  for (let i = 0; i < units.length; i++) {
    if (units[i].toUpperCase() === normalizedUnit) {
      exponent = i
      break
    }
  }

  return number * base ** exponent
}

/**
 * Compare two byte values
 */
export function compareBytes(a: number | string, b: number | string): number {
  const bytesA = typeof a === 'string' ? parseBytes(a) : a
  const bytesB = typeof b === 'string' ? parseBytes(b) : b
  return bytesA - bytesB
}

// Aliases
export const prettyBytes = formatBytes
export const readableSize = formatBytes
export { formatBytes as default }
