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

    return Number.isNaN(index) ? match : args[index]
  })
}

export function truncate(str: string, length: number, end = '...'): string {
  if (str.length <= length)
    return str

  return str.slice(0, length - end.length) + end
}

/**
 * Generate a random string
 * @category String
 */
export function random(size = 16, dict: string = urlAlphabet): string {
  let id = ''
  let i = size
  const len = dict.length
  while (i--) id += dict[(Math.random() * len) | 0]
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
