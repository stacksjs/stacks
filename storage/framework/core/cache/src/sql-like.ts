/**
 * LIKE patterns for the SQL cache drivers.
 *
 * SingleStore and MySQL use backslash escaping for LIKE.
 * SQLite uses case-sensitive GLOB for cache key identity.
 */

/** `value` as a LIKE pattern that matches it literally: `\`, `%` and `_` escaped. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

/** `*` globs as LIKE patterns, with LIKE's own wildcards taken literally. */
export function likePattern(glob: string): string {
  return escapeLike(glob).replace(/\*/g, '%')
}

/** SQLite case-sensitive glob, with only `*` acting as a wildcard. */
export function sqliteGlobPattern(glob: string): string {
  return glob.replace(/[?[]/g, character => character === '?' ? '[?]' : '[[]')
}
