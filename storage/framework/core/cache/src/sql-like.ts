/**
 * LIKE patterns for the SQL cache drivers.
 *
 * Both escape with a backslash: SingleStore and MySQL take it as LIKE's
 * default escape character, and the SQLite driver names it with `ESCAPE '\'`.
 */

/** `value` as a LIKE pattern that matches it literally: `\`, `%` and `_` escaped. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

/** `*` globs as LIKE patterns, with LIKE's own wildcards taken literally. */
export function likePattern(glob: string): string {
  return escapeLike(glob).replace(/\*/g, '%')
}
