// Re-export composables from @stacksjs/composables
export {
  useDark,
  useDateFormat,
  useFetch,
  useNow,
  useOnline,
  usePreferredDark,
  useStorage,
  useToggle,
} from '@stacksjs/composables'

export type {
  HeadConfig as HeadObject,
  HeadConfig as HeadObjectPlain,
} from '@stacksjs/stx'

export {
  useHead as createHead,
  useHead as Head,
  renderHead as renderHeadToString,
} from '@stacksjs/stx'

export interface ReadableSizeOptions {
  precision?: number
  binary?: boolean
  space?: boolean
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

const DECIMAL_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
const BINARY_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

export function readableSize(bytes: number, options: ReadableSizeOptions = {}): string {
  const {
    precision = 1,
    binary = false,
    space = true,
    locale = 'en-US',
    minimumFractionDigits = 0,
    maximumFractionDigits = precision,
  } = options

  if (!Number.isFinite(bytes))
    throw new TypeError(`Expected a finite number, got ${typeof bytes}: ${bytes}`)

  const isNegative = bytes < 0
  const prefix = isNegative ? '-' : ''
  if (isNegative)
    bytes = -bytes

  if (bytes < 1) {
    const numberString = bytes.toLocaleString(locale, { minimumFractionDigits, maximumFractionDigits })
    return `${prefix}${numberString}${space ? ' ' : ''}B`
  }

  const base = binary ? 1024 : 1000
  const units = binary ? BINARY_UNITS : DECIMAL_UNITS
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1)
  const value = bytes / base ** exponent
  const numberString = value.toLocaleString(locale, { minimumFractionDigits, maximumFractionDigits })

  return `${prefix}${numberString}${space ? ' ' : ''}${units[exponent]}`
}
