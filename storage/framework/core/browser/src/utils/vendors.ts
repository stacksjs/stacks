// Re-export composables from @stacksjs/composables
export {
  useDark,
  useDateFormat,
  useFetch,
  // Reachable from a client script at last (stacksjs/stacks#1940, stx#1843).
  // It shipped with per-field validation, `inputProps()` carrying
  // aria-invalid / aria-describedby, isSubmitting, touched/dirty and
  // setErrors for 422 mapping — and appeared in neither auto-import surface,
  // so there was no way to find it without already knowing the package path.
  // Two production apps hand-rolled N signals plus manual error flags and
  // manual focus per form rather than use it.
  useForm,
  useNow,
  useOnline,
  usePreferredDark,
  useScrollLock,
  useStorage,
  useTimeoutFn,
  useToggle,
} from '@stacksjs/composables'

export type {
  HeadConfig as HeadObject,
  HeadConfig as HeadObjectPlain,
} from '@stacksjs/stx'

/**
 * Imported into scope first, then re-exported, rather than forwarded with
 * `export { x as y } from '...'`.
 *
 * The two forms are equivalent to a type checker and are not equivalent to a
 * bundler. Forwarding leaves no local binding, and when an application bundles
 * this barrel into a page, Bun has been observed emitting the export alias
 * while dropping the import it points at:
 *
 *   renderHeadToString: () => renderHead,   // renderHead is not defined
 *
 * That is a ReferenceError thrown while the module initialises, so everything
 * after it in the same bundled script never runs. In one app that script also
 * contained `defineStore('auth')`, so the auth store was never defined and
 * every page reported "Store auth not found" — a symptom three layers from the
 * cause, on a page that still painted its server HTML and therefore looked
 * fine. This package's build.ts already documents the same Bun behaviour as
 * the reason it transpiles file-by-file instead of bundling; the forwarding
 * form reintroduces it downstream, in whatever bundles the published barrel.
 *
 * An imported binding cannot be dropped this way: it is referenced in module
 * scope, so the bundler has to keep it.
 */
import { renderHead, useHead } from '@stacksjs/stx'

export {
  renderHead as renderHeadToString,
  useHead as createHead,
  useHead as Head,
}

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
