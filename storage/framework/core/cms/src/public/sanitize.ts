/**
 * Render-time HTML sanitizer for rich-text blocks.
 *
 * The threat model is a compromised or careless STAFF account, not arbitrary
 * public input - visitors never write block HTML. Applied at render rather
 * than at save so tightening these rules retroactively cleans every stored
 * document on the next request.
 *
 * Two properties this has to hold, both learned the hard way from a
 * single-pass tag-strip:
 *
 *  1. A blocked element is removed WITH ITS CONTENT. Stripping only the tags
 *     turned `<script>alert(1)</script>` into the visible text `alert(1)` and
 *     `<style>body{display:none}</style>` into visible CSS.
 *  2. Removal repeats to a fixed point. One pass over
 *     `<scr<script>ipt>alert(1)</scr</script>ipt>` deletes the inner tag and
 *     *reconstructs* `<script>alert(1)</script>` - a live script from input
 *     the sanitizer had just "cleaned". Looping until the string stops
 *     changing closes that, and the iteration cap keeps a pathological input
 *     from spinning.
 */

/** Elements removed together with everything between their tags. */
const VOID_OF_CONTENT = /<(script|style|iframe|object|embed|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
/** The same elements when unclosed, plus tags that carry no safe content. */
const BLOCKED_TAGS = /<\/?(?:script|style|iframe|object|embed|noscript|template|form|link|meta|base|svg|math)\b[^>]*>?/gi
const EVENT_ATTRS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const DANGEROUS_URLS = /\s+(href|src|xlink:href|formaction|action)\s*=\s*(["']?)\s*(?:javascript|vbscript|data:text\/html)[^"'\s>]*\2/gi

const MAX_PASSES = 8

export function sanitizeRichText(html: string): string {
  let current = html

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = current

    current = current
      .replace(VOID_OF_CONTENT, '')
      .replace(BLOCKED_TAGS, '')
      .replace(EVENT_ATTRS, '')
      .replace(DANGEROUS_URLS, ' $1="#"')

    if (current === before)
      return current
  }

  // Still changing after MAX_PASSES means the input is adversarially nested.
  // Drop every tag rather than ship markup we could not stabilise.
  return current.replace(/<[^>]*>/g, '')
}
