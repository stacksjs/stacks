/**
 * Shared helpers for the analytics drivers.
 *
 * Every driver emits a `<script>` tag, either as raw HTML or as the
 * `[tag, attributes]` pair the Stacks/BunPress docs `head` array expects, so the
 * tag shape and the escaping live here rather than once per driver.
 */

/** A single head entry: the tag name plus its attributes. */
export type AnalyticsHeadTag = [string, Record<string, string>]

/**
 * Escape a value for safe insertion into an HTML attribute.
 */
export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Serialize a value as a JavaScript string literal for inline script bodies.
 *
 * `JSON.stringify` handles quoting and control characters; the `<` and `>`
 * replacements stop a value containing `</script>` from closing the tag early.
 */
export function jsString(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
}

/**
 * Render an `[tag, attributes]` pair as HTML.
 *
 * Head tags carry raw values; escaping happens here, so a driver never escapes
 * twice. An `innerHTML` attribute becomes the tag body instead of an attribute,
 * and an empty value renders as a bare attribute (`defer`, `async`).
 */
export function renderHeadTag([tag, attrs]: AnalyticsHeadTag): string {
  const body = attrs.innerHTML ?? ''
  const rendered = Object.entries(attrs)
    .filter(([key]) => key !== 'innerHTML')
    .map(([key, value]) => (value === '' ? ` ${key}` : ` ${key}="${escapeAttr(value)}"`))
    .join('')

  return `<${tag}${rendered}>${body}</${tag}>`
}

/**
 * Render a driver's head tags as an HTML block.
 */
export function renderHeadTags(tags: AnalyticsHeadTag[]): string {
  return tags.map(renderHeadTag).join('\n')
}
