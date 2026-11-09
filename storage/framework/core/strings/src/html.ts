/**
 * HTML character references, decoded.
 *
 * For text that arrives HTML-escaped and is shown as plain text: product names
 * from a WordPress Store API (`Hoodie &amp; Cap`), or the preview of an email
 * whose HTML says `Trail Runner &times; 3`. Without decoding, the reader sees
 * the reference itself. Decoding is one pass, so `&amp;lt;` becomes the text
 * `&lt;` rather than `<`, and an unknown name is left as written.
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
