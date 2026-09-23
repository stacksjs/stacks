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
 * Head helpers, read off the stx runtime instead of imported from it.
 *
 * `@stacksjs/stx` is EXTERNAL to an application's page bundle: the runtime is
 * delivered as `window.stx` and none of its module code is inlined. A static
 * `import { renderHead } from '@stacksjs/stx'` in this barrel is therefore
 * elided at bundle time, and the export alias left behind points at nothing:
 *
 *   renderHeadToString: () => renderHead,   // renderHead is not defined
 *
 * That is a ReferenceError thrown while the module initialises, so everything
 * after it in the same bundled script never runs. In one application that
 * script also contained `defineStore('auth')`, so the store was never defined
 * and every page logged "Store auth not found" — two symptoms, one broken
 * alias, and neither of them naming it. The page still painted its server HTML
 * throughout, which is what kept it unnoticed.
 *
 * Changing the re-export form does not help: forwarded or imported-then-
 * exported, a binding that comes from an external module cannot survive into
 * the bundle. Resolving through the runtime at call time is what actually
 * works, and it has the side benefit of not caring when the runtime loads.
 */
interface StxRuntime {
  useHead?: (...args: any[]) => any
  renderHead?: (...args: any[]) => string
}

function stxRuntime(name: keyof StxRuntime): (...args: any[]) => any {
  const runtime = (globalThis as { stx?: StxRuntime }).stx
  const fn = runtime?.[name]

  if (typeof fn !== 'function') {
    throw new TypeError(
      `[@stacksjs/browser] stx.${name} is unavailable. These helpers read the stx runtime from `
      + `window.stx, which the page installs before component scripts run; calling one outside a `
      + `browser, or before the runtime script has loaded, gets you here.`,
    )
  }

  return fn
}

/** `useHead` from the stx runtime. */
export function createHead(...args: any[]): any {
  return stxRuntime('useHead')(...args)
}

/** `useHead` from the stx runtime, under the name older call sites use. */
export function Head(...args: any[]): any {
  return stxRuntime('useHead')(...args)
}

/** `renderHead` from the stx runtime. */
export function renderHeadToString(...args: any[]): string {
  return stxRuntime('renderHead')(...args)
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
