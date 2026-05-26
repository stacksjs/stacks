/**
 * Web-font preload + `@font-face` rendering helpers
 * (stacksjs/stacks#283 — prevent layout shifts).
 *
 * Layout shifts (the LS in CLS) happen when a page renders with the
 * fallback font, then re-flows once the web font loads. The two
 * mitigations this module ships against that:
 *
 *   1. **Preload** — emit `<link rel="preload" as="font" crossorigin>`
 *      for each font listed in the UI config, so the browser starts the
 *      font download in parallel with HTML parsing rather than waiting
 *      to discover the URL via CSS.
 *
 *   2. **`font-display: swap`** — the default `@font-face` block uses
 *      `font-display: swap`, which shows the fallback font immediately
 *      and swaps in the web font once available. Layout still shifts
 *      slightly at swap time, but the page is readable from t=0 instead
 *      of being blocked by the font fetch.
 *
 * Apps drop a list of fonts into `config/ui.ts` and call these helpers
 * from their layout's `<head>` — see {@link renderFontHead}. Both
 * outputs are safe to inline into HTML (no user-controlled values
 * interpolate; the FontEntry shape is config-only).
 */

/** One configured web font. */
export interface FontEntry {
  /**
   * Font family name. Used as the `font-family` value in the emitted
   * `@font-face` block and referenced from your CSS.
   */
  family: string
  /**
   * Absolute or app-relative URL to the font file. Local files under
   * `public/` are preferred for the preload path since they share the
   * connection with the document; CDN-hosted fonts work but lose the
   * preload benefit when crossing origins without `crossorigin`.
   */
  src: string
  /**
   * Font file format passed to the `format(...)` clause. Defaults to
   * `'woff2'` because every shipping browser supports it; only set
   * this when the asset is actually a different format.
   *
   * @default 'woff2'
   */
  format?: 'woff2' | 'woff' | 'truetype' | 'opentype'
  /**
   * `font-weight` to apply on the `@font-face` block. Accepts CSS
   * keywords (`'normal'` / `'bold'`) or numeric weights (100-900).
   *
   * @default 'normal'
   */
  weight?: number | string
  /**
   * `font-style` on the `@font-face` block.
   *
   * @default 'normal'
   */
  style?: 'normal' | 'italic' | 'oblique'
  /**
   * `font-display` strategy. `'swap'` is the right default for the CLS
   * goal — see https://web.dev/font-display. `'optional'` is stricter
   * (skip the swap entirely on slow networks) and useful for highly
   * brand-sensitive surfaces; `'block'` re-introduces FOIT and should
   * be avoided unless you have a very specific reason.
   *
   * @default 'swap'
   */
  display?: 'auto' | 'swap' | 'block' | 'fallback' | 'optional'
  /**
   * Whether to emit a `<link rel="preload" as="font">` tag. Defaults
   * to `true` for the first 2 fonts (the typical "above-the-fold"
   * count before TCP slot exhaustion hurts more than it helps) — set
   * `false` on long lists' tail entries.
   */
  preload?: boolean
  /**
   * Optional `unicode-range`. Useful for subsetted fonts (e.g. Latin
   * vs CJK). Omitted from the `@font-face` block when undefined.
   *
   * @example
   * 'U+0000-00FF, U+0131, U+0152-0153'
   */
  unicodeRange?: string
}

/** Map `format` shorthand to the MIME-style label CSS expects. */
const FORMAT_LABEL: Record<NonNullable<FontEntry['format']>, string> = {
  woff2: 'woff2',
  woff: 'woff',
  truetype: 'truetype',
  opentype: 'opentype',
}

/** Map `format` shorthand to the `<link>` MIME type. */
const FORMAT_MIME: Record<NonNullable<FontEntry['format']>, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  truetype: 'font/ttf',
  opentype: 'font/otf',
}

/**
 * Render `<link rel="preload" as="font" crossorigin>` tags for every
 * font with `preload !== false`. Cross-origin attribute is always
 * emitted because most CDN-hosted fonts require it and same-origin
 * fonts ignore it harmlessly.
 *
 * Output is a single string with one tag per line, ready to drop into
 * a stx layout's `<head>` via `{{ renderFontPreloads(fonts) }}`.
 */
export function renderFontPreloads(fonts: FontEntry[] = []): string {
  return fonts
    .filter(font => font.preload !== false)
    .map((font) => {
      const fmt = font.format ?? 'woff2'
      const type = FORMAT_MIME[fmt]
      return `<link rel="preload" href="${escapeAttr(font.src)}" as="font" type="${type}" crossorigin>`
    })
    .join('\n')
}

/**
 * Render an `@font-face { ... }` block for every entry. `font-display:
 * swap` is the default; override per-entry with `display`.
 *
 * Wrap the result in `<style>` tags when inlining into a layout's
 * `<head>`, or write to a separate CSS file and `<link>` it.
 */
export function renderFontFaceCss(fonts: FontEntry[] = []): string {
  return fonts
    .map((font) => {
      const fmt = font.format ?? 'woff2'
      const fmtLabel = FORMAT_LABEL[fmt]
      const weight = font.weight ?? 'normal'
      const style = font.style ?? 'normal'
      const display = font.display ?? 'swap'
      const ur = font.unicodeRange
      return `@font-face {
  font-family: '${escapeFamily(font.family)}';
  src: url('${escapeUrl(font.src)}') format('${fmtLabel}');
  font-weight: ${weight};
  font-style: ${style};
  font-display: ${display};${ur ? `\n  unicode-range: ${ur};` : ''}
}`
    })
    .join('\n\n')
}

/**
 * Convenience helper: render BOTH the preload tags and the wrapped
 * `<style>...@font-face...</style>` block in one go, separated by a
 * newline. Drop this into the very top of your layout's `<head>` for
 * the maximal CLS win.
 *
 * @example
 * ```stx
 * <head>
 *   {{ renderFontHead(config.ui.fonts) }}
 *   <title>...</title>
 * </head>
 * ```
 */
export function renderFontHead(fonts: FontEntry[] = []): string {
  if (fonts.length === 0) return ''
  const preloads = renderFontPreloads(fonts)
  const faces = renderFontFaceCss(fonts)
  return `${preloads}\n<style>\n${faces}\n</style>`
}

/**
 * Escape an HTML attribute value — `&` `<` `>` `"` `'`. The font config
 * is app-controlled, not user-controlled, so injection isn't a realistic
 * threat here; the escape is defense-in-depth for callers that pull
 * font URLs from a CMS or similar untrusted source.
 */
function escapeAttr(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' } as Record<string, string>)[c]!
  })
}

/**
 * Strip CSS-meaningful chars from a font URL inside `url('...')`.
 *
 * Removes anything that could break out of the `url('...')` wrapper:
 * quotes, parentheses, semicolons, braces (which would terminate the
 * `src:` declaration or `@font-face` block), comment delimiters
 * (`/*`), and whitespace control chars. `/`, `:`, `?`, `=`, `&`, `.`
 * are retained since they're legitimate URL chars.
 */
function escapeUrl(s: string): string {
  return String(s).replace(/['"`()<>{};\\\r\n\t*]/g, '')
}

/**
 * Strip CSS-meaningful chars from a font-family identifier. Stricter
 * than {@link escapeUrl} because family names are short identifiers,
 * not URLs — only alphanumerics, spaces, dashes, dots, and underscores
 * survive.
 */
function escapeFamily(s: string): string {
  return String(s).replace(/[^A-Z0-9 \-_.]/gi, '')
}
