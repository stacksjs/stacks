/**
 * Plain-text fields from sources that HTML-escape them.
 *
 * WordPress runs product and term names through `esc_html` on the way out, so
 * the Store API sends `Hoodie &amp; Cap` and `Shirt &#8211; Blue`. Stored as
 * is, the storefront escapes the ampersand again and the shopper reads
 * `Hoodie &amp;amp; Cap`. Names are decoded once at the boundary; descriptions
 * are HTML on purpose and are left exactly as the source sent them.
 */

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
  nbsp: '\u00A0',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  laquo: '\u00AB',
  raquo: '\u00BB',
  trade: '\u2122',
  reg: '\u00AE',
  copy: '\u00A9',
  deg: '\u00B0',
  times: '\u00D7',
  frac12: '\u00BD',
  euro: '\u20AC',
  pound: '\u00A3',
  yen: '\u00A5',
  cent: '\u00A2',
}

/** Decode HTML character references (named, decimal and hex) in one pass. */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X'
        ? Number.parseInt(ref.slice(2), 16)
        : Number.parseInt(ref.slice(1), 10)
      return Number.isInteger(code) && code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : whole
    }

    return NAMED[ref.toLowerCase()] ?? whole
  })
}

/** A name for storage: entities decoded, whitespace collapsed, trimmed. */
export function cleanName(input: unknown): string {
  if (typeof input !== 'string')
    return ''

  return decodeHtmlEntities(input).replace(/\s+/g, ' ').trim()
}

/** A non-empty string, or null. */
export function optionalString(input: unknown): string | null {
  if (typeof input !== 'string')
    return null

  const trimmed = input.trim()
  return trimmed === '' ? null : trimmed
}
