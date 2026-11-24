/**
 * Markdown to HTML for content the reader's browser should not trust, such as
 * blog posts.
 *
 * A post is written in Markdown, not HTML: any HTML in it is shown as the text
 * it is, so a stray `<script>` or `onerror=` reads as characters on the page.
 * Links and images may only point where a link should (http, https, a relative
 * path or an anchor; links may also be mailto). Code in backticks or fences
 * keeps showing `<` as `<`.
 */

/** Options for {@link renderSafeMarkdown}. */
export interface SafeMarkdownOptions {
  /** Give headings `id`s from their text. Default `true`. */
  headingIds?: boolean
}

const LINK_SCHEMES = ['http', 'https', 'mailto']
const IMAGE_SCHEMES = ['http', 'https']

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([\da-f]+);?/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * `url` when a reader can follow it safely, otherwise `null`. Relative paths,
 * anchors and the allowed schemes pass. Anything with control characters,
 * whitespace or a backslash is refused rather than guessing how a browser
 * would read it.
 */
export function safeUrl(url: string, kind: 'link' | 'image' = 'link'): string | null {
  const value = url.trim()
  if (!value || /[\u0000- \u007F-\u009F\\]/.test(value))
    return null
  // A colon before any `/`, `?` or `#` is a scheme.
  const scheme = /^([^/?#]*):/.exec(value)?.[1]
  if (scheme === undefined)
    return value
  return (kind === 'image' ? IMAGE_SCHEMES : LINK_SCHEMES).includes(scheme.toLowerCase()) ? value : null
}

/** Drop `href`/`src` attributes whose URL is not {@link safeUrl}. */
function filterUrls(html: string): string {
  return html.replace(/<(a|img)\b([^>]*)>/g, (_tag, name: string, attributes: string) => {
    // Walk whole `name="value"` pairs, so text inside a title is never read
    // as an attribute of its own.
    const kept = attributes.replace(/\s([\w:-]+)="([^"]*)"/g, (attribute, key: string, encoded: string) =>
      (key === 'href' || key === 'src') && safeUrl(decodeEntities(encoded), name === 'img' ? 'image' : 'link') === null ? '' : attribute)
    return `<${name}${kept}>`
  })
}

/**
 * Render `markdown` (GitHub-flavoured: tables, task lists, strikethrough,
 * autolinks) to HTML with raw HTML escaped and unsafe URLs removed.
 */
export function renderSafeMarkdown(markdown: string, options: SafeMarkdownOptions = {}): string {
  const html = Bun.markdown.html(markdown, {
    tables: true,
    strikethrough: true,
    tasklists: true,
    autolinks: true,
    headings: options.headingIds === false ? undefined : { ids: true },
    noHtmlBlocks: true,
    noHtmlSpans: true,
  })
  return filterUrls(html)
}
