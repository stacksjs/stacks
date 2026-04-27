import { slugify } from './slug'

interface SlugOptions {
  replacement?: string
  remove?: RegExp
  lower?: boolean
  strict?: boolean
  locale?: string
  trim?: boolean
}

// port from nanoid
// https://github.com/ai/nanoid
export const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

/**
 * Replace backslash to slash
 *
 * @category String
 * @example
 * ```
 * slash('C:\\Users\\Chris') => 'C:/Users/Chris'
 * ```
 */
export function slash(str: string): string {
  return str.replace(/\\/g, '/')
}

/**
 * Ensure prefix of a string
 *
 * @category String
 * @example
 * ```
 * ensurePrefix('https://', 'google.com') => 'https://google.com'
 * ensurePrefix('https://', 'http://google.com') => 'https://google.com'
 */
export function ensurePrefix(prefix: string, str: string): string {
  if (!str.startsWith(prefix))
    return prefix + str
  return str
}

/**
 * Ensure suffix of a string
 *
 * @category String
 * @example
 * ```
 * ensureSuffix('.js', 'index') => 'index.js'
 * ensureSuffix('.js', 'index.js') => 'index.js'
 * ```
 */
export function ensureSuffix(suffix: string, str: string): string {
  return str.endsWith(suffix) ? str : str + suffix
}

/**
 * Dead simple template engine, just like Python's `.format()`
 *
 * @category String
 * @example
 * ```
 * const result = template('Hello {0}! My name is {1}.',
 *   'Buddy',
 *   'Chris'
 * ) // Hello Buddy! My name is Chris.
 * ```
 */
export function template(str: string, ...args: any[]): string {
  return str.replace(/\{(\d+)\}/g, (match, key) => {
    const index = Number(key)

    return Number.isNaN(index) || args[index] === undefined ? match : args[index]
  })
}

export function truncate(str: string, length: number, end = '...'): string {
  if (str.length <= length)
    return str

  return str.slice(0, length - end.length) + end
}

/**
 * Generate a random string.
 *
 * Uses `crypto.getRandomValues()` so the result is suitable for tokens,
 * password reset codes, API keys, and any other security-sensitive use —
 * `Math.random()` is predictable and would let an attacker reproduce
 * "random" tokens given enough sample output.
 *
 * @category String
 */
export function random(size = 16, dict: string = urlAlphabet): string {
  const len = dict.length
  // crypto.getRandomValues is available in Bun, Node ≥19, and all browsers.
  // Falling back to Math.random would silently downgrade security; better
  // to throw if the platform lacks it so the bug surfaces immediately.
  const g = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
  if (!g.crypto?.getRandomValues)
    throw new Error('[strings.random] crypto.getRandomValues is not available; cannot generate secure random string.')

  const bytes = new Uint8Array(size)
  g.crypto.getRandomValues(bytes)

  let id = ''
  for (let i = 0; i < size; i++) id += dict[bytes[i] % len]
  return id
}

/**
 * Slugify a string
 * @category string
 * @example
 * ```
 * slug('Hello World') => 'hello-world'
 * ```
 */
export function slug(str: string, options?: SlugOptions): string {
  if (options)
    return slugify(str, options)

  return slugify(str, {
    lower: true,
    strict: true,
  })
}

export * from './detect-indent'
export * from './detect-newline'
