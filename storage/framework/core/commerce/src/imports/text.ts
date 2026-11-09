/**
 * Plain-text fields from sources that HTML-escape them.
 *
 * WordPress runs product and term names through `esc_html` on the way out, so
 * the Store API sends `Hoodie &amp; Cap` and `Shirt &#8211; Blue`. Stored as
 * is, the storefront escapes the ampersand again and the shopper reads
 * `Hoodie &amp;amp; Cap`. Names are decoded once at the boundary; descriptions
 * are HTML on purpose and are left exactly as the source sent them.
 */

import { decodeHtmlEntities } from '@stacksjs/strings'

export { decodeHtmlEntities }

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
