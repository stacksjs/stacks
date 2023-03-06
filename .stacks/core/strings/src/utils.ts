import slugify from 'slugify'

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
const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

/**
 * Replace backslash to slash
 *
 * @category String
 * @example
 * ```
 * slash('C:\\Users\\Chris') => 'C:/Users/Chris'
 * ```
 */
export function slash(str: string) {
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
export function ensurePrefix(prefix: string, str: string) {
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
export function ensureSuffix(suffix: string, str: string) {
  if (!str.endsWith(suffix))
    return str + suffix
  return str
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
  return str.replace(/{(\d+)}/g, (match, key) => {
    const index = Number(key)
    if (Number.isNaN(index))
      return match
    return args[index]
  })
}

/**
 * Generate a random string
 * @category String
 */
export function randomStr(size = 16, dict = urlAlphabet) {
  let id = ''
  let i = size
  const len = dict.length
  while (i--)
    id += dict[(Math.random() * len) | 0]
  return id
}

/**
 * First letter uppercase, other lowercase
 * @category string
 * @example
 * ```
 * capitalize('hello world') => 'Hello world'
 * ```
 */
export function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1).toLowerCase()
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
