// stacksjs/stacks#1902 (B2) — pure-TS CSS inliner for email HTML.
//
// Gmail (especially the Android app) and older Outlook clients strip
// or ignore `<style>` blocks, so CSS has to ride on each element via
// `style="..."` to survive in the wild. Stacks ships its email
// components inline-styled by construction (B1), but userland CSS in
// a `<style>` block needs this pass.
//
// We deliberately avoid pulling in a JS-side library like juice — the
// 80% case (class / id / tag selectors → inline declarations) is a
// few hundred lines of careful regex and DOM-string surgery, and
// keeping the dep count down is a Stacks-wide priority. For complex
// selectors (descendant combinators, pseudo-classes, media queries),
// we leave the rule in the `<style>` block — they wouldn't inline
// usefully anyway, and email clients that support `<style>` will
// still pick them up.
//
// Opt-out hooks (covered by tests):
//   - `inlineCss(html, { inline: false })` — pass-through, the
//     `<style>` block stays put.
//   - `<style data-inline="false">...</style>` — that specific block
//     is treated as opaque (not parsed, not stripped).

/**
 * Options accepted by {@link inlineCss}.
 */
export interface InlineCssOptions {
  /**
   * When `false`, returns the HTML unchanged. Production-default ON,
   * dev-default OFF — see `email/src/template.ts` for the env gate.
   */
  inline?: boolean
  /**
   * Append `!important` to every inlined declaration. Email clients
   * often have their own user agents that override author styles,
   * so this is the safe default.
   */
  important?: boolean
}

/**
 * Inline `<style>` blocks into per-element `style=""` attributes.
 *
 * Simple selectors (class `.x`, id `#x`, tag `p`, and chains like
 * `p.foo` or `.a.b`) are inlined and removed from the source block.
 * Rules that can't be safely inlined (`@media`, pseudo-classes,
 * descendant / sibling combinators) stay in a slimmed-down `<style>`
 * block so clients that DO honour styles can still apply them.
 *
 * Returns the HTML unchanged when `inline: false`. `<style
 * data-inline="false">` blocks are passed through verbatim regardless
 * of `inline`.
 */
export function inlineCss(html: string, options: InlineCssOptions = {}): string {
  const { inline = true, important = true } = options
  if (!inline) return html

  let working = html

  // First pass: replace every `<style data-inline="false">...</style>`
  // block with a placeholder so we don't accidentally consume it. We
  // restore the placeholder at the very end.
  const passthroughBlocks: string[] = []
  working = working.replace(
    /<style\b[^>]*\bdata-inline=["']false["'][^>]*>[\s\S]*?<\/style>/gi,
    (match) => {
      passthroughBlocks.push(match)
      return `\0STX_PASSTHROUGH_${passthroughBlocks.length - 1}\0`
    },
  )

  // Pull out every remaining `<style>` block and parse it. The
  // residual (un-inlinable) declarations get re-emitted as one
  // combined `<style>` block at the end.
  const styleBlocks: string[] = []
  working = working.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, body: string) => {
    styleBlocks.push(body)
    return ''
  })
  if (styleBlocks.length === 0) {
    return restorePassthroughs(working, passthroughBlocks)
  }

  // Parse each style block into rules. Inlinable rules get
  // accumulated by selector; un-inlinable ones get stashed into
  // `leftover` so we can re-emit them as a final `<style>` block.
  type Decl = { prop: string, value: string }
  const inlinableRules: Array<{ selector: string, decls: Decl[] }> = []
  const leftover: string[] = []
  for (const body of styleBlocks) {
    for (const rule of splitRules(body)) {
      const { selector, declarations, body: ruleBody } = rule
      if (!selector) continue
      if (declarations !== null && isInlinable(selector)) {
        inlinableRules.push({ selector, decls: declarations })
      }
      else {
        leftover.push(`${selector} { ${ruleBody} }`)
      }
    }
  }

  // Apply each rule to every element matching the selector. We do
  // this with regex-on-string rather than a full HTML parser because
  // emails are tightly scoped trees and the overhead of e.g. happy-
  // dom or cheerio would dwarf the savings. Limitation: the matcher
  // is element-local (matches tag + class + id), which is exactly
  // what `isInlinable` allowed through, so we never need to walk
  // ancestors.
  for (const { selector, decls } of inlinableRules) {
    working = applyRule(working, selector, decls, important)
  }

  // Re-emit any un-inlinable rules in a single `<style>` block so
  // clients that support `<style>` can still pick them up.
  if (leftover.length > 0) {
    const styleTag = `<style>\n${leftover.join('\n')}\n</style>`
    // Inject before `</head>` if present; otherwise prepend.
    working = /<\/head>/i.test(working)
      ? working.replace(/<\/head>/i, `${styleTag}\n</head>`)
      : `${styleTag}\n${working}`
  }

  return restorePassthroughs(working, passthroughBlocks)
}

/**
 * Replace placeholders with their original `<style data-inline="false">`
 * blocks. Kept as a separate step so the early-return path can use it
 * without duplicating the logic.
 */
function restorePassthroughs(html: string, blocks: string[]): string {
  if (blocks.length === 0) return html
  return html.replace(/\0STX_PASSTHROUGH_(\d+)\0/g, (_match, idx: string) => {
    return blocks[Number.parseInt(idx, 10)] ?? ''
  })
}

/**
 * Split a CSS block into selectors, original bodies and flat declarations.
 * Strip `/* comments * /` and retain nested rules as opaque stylesheet bodies;
 * they cannot be represented by inline property declarations.
 */
function splitRules(body: string): Array<{ selector: string, body: string, declarations: Array<{ prop: string, value: string }> | null }> {
  // Strip CSS comments to simplify selector parsing.
  const cleaned = body.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Array<{ selector: string, body: string, declarations: Array<{ prop: string, value: string }> | null }> = []

  let i = 0
  while (i < cleaned.length) {
    // Find the next `{`. Everything before it is the selector.
    const open = cleaned.indexOf('{', i)
    if (open === -1) break
    const selector = cleaned.slice(i, open).trim()
    // Match braces to find the corresponding `}`.
    let depth = 1
    let j = open + 1
    while (j < cleaned.length && depth > 0) {
      const ch = cleaned[j]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      j++
    }
    const inner = cleaned.slice(open + 1, j - 1)
    // Nested blocks are CSS rules, not property declarations. Preserve their
    // body for the stylesheet instead of emitting them into an inline style.
    if (selector.startsWith('@') || inner.includes('{')) {
      rules.push({
        selector: selector || '@unknown',
        body: inner.trim(),
        declarations: null,
      })
    }
    else {
      rules.push({ selector, body: inner.trim(), declarations: parseDeclarations(inner) })
    }
    i = j
  }

  return rules
}

/** Parse a flat declaration block (`color: red; font-size: 14px`). */
function parseDeclarations(body: string): Array<{ prop: string, value: string }> {
  return body
    .split(';')
    .map(decl => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const colon = decl.indexOf(':')
      if (colon === -1) return null
      return {
        prop: decl.slice(0, colon).trim(),
        value: decl.slice(colon + 1).trim(),
      }
    })
    .filter((d): d is { prop: string, value: string } => d !== null)
}

/**
 * True when the selector is one we know how to apply in isolation —
 * no descendant combinators, no pseudo-classes, no attribute selectors.
 * The supported form is one element: optional tag, then any number of
 * `.class` / `#id` segments.
 */
function isInlinable(selector: string): boolean {
  if (!selector) return false
  // Reject comma-separated lists by recursing — each branch must
  // independently inline.
  if (selector.includes(',')) {
    return selector.split(',').every(s => isInlinable(s.trim()))
  }
  if (selector.startsWith('@')) return false
  // Anything that uses a combinator or pseudo can't safely be inlined
  // by element-local matching.
  if (/[\s>+~:[]/.test(selector)) return false
  // What's left must be `tag?(.class|#id)*`.
  return /^[a-z][a-z0-9-]*?$|^([a-z][a-z0-9-]*)?([.#][a-z][\w-]*)+$/i.test(selector)
}

/**
 * Apply one rule's declarations to every element that the selector
 * matches in `html`. Comma-separated selectors recurse so each branch
 * is applied independently.
 */
function applyRule(html: string, selector: string, decls: Array<{ prop: string, value: string }>, important: boolean): string {
  if (selector.includes(',')) {
    let acc = html
    for (const branch of selector.split(',')) {
      acc = applyRule(acc, branch.trim(), decls, important)
    }
    return acc
  }

  const { tag, classes, ids } = parseSimpleSelector(selector)
  const tagPattern = tag ?? '[a-z][a-z0-9-]*'
  // Match every opening tag (greedy on attrs but bounded by `>`).
  const tagRe = new RegExp(`<(${tagPattern})\\b([^>]*?)(/?)>`, 'gi')

  const newDeclString = decls
    .map(d => `${d.prop}:${d.value}${important && !/!important\b/i.test(d.value) ? ' !important' : ''};`)
    .join('')

  return html.replace(tagRe, (match, _tagName: string, attrs: string) => {
    if (!elementMatches(attrs, classes, ids)) return match
    return mergeStyleAttr(match, attrs, newDeclString)
  })
}

/** Extract `{ tag, classes, ids }` from a simple selector. */
function parseSimpleSelector(selector: string): { tag: string | null, classes: string[], ids: string[] } {
  let tag: string | null = null
  const classes: string[] = []
  const ids: string[] = []
  // Peel off leading tag (if any) — anything before the first `.`/`#`.
  let i = 0
  while (i < selector.length && /[a-z0-9-]/i.test(selector[i]!)) {
    tag = (tag ?? '') + selector[i]!
    i++
  }
  if (tag === '') tag = null
  // Then alternating `.cls` / `#id` segments.
  while (i < selector.length) {
    const ch = selector[i]
    if (ch !== '.' && ch !== '#') break
    let j = i + 1
    while (j < selector.length && /[\w-]/.test(selector[j]!)) j++
    const name = selector.slice(i + 1, j)
    if (ch === '.') classes.push(name)
    else ids.push(name)
    i = j
  }
  return { tag, classes, ids }
}

/**
 * Element-local match check: does the attribute string of an opening
 * tag carry every required class + id?
 */
function elementMatches(attrs: string, classes: string[], ids: string[]): boolean {
  if (classes.length > 0) {
    const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i)
    if (!classMatch) return false
    const present = classMatch[1]!.split(/\s+/).filter(Boolean)
    if (!classes.every(c => present.includes(c))) return false
  }
  if (ids.length > 0) {
    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i)
    if (!idMatch) return false
    if (!ids.every(id => idMatch[1]! === id)) return false
  }
  return true
}

/**
 * Merge the new declaration string into the element's existing
 * `style=""` attribute (or add one if absent). Returns the rewritten
 * opening tag.
 *
 * Existing inline declarations win over the inlined `<style>` rule —
 * email senders explicitly set those, the bundled rules are
 * defaults. We achieve that by prepending the new declarations: when
 * a browser sees two declarations for the same property, the LATER
 * one wins, so existing inline styles override.
 */
function mergeStyleAttr(originalTag: string, attrs: string, newDeclString: string): string {
  const styleMatch = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i)
  if (styleMatch) {
    const existing = styleMatch[1]!.trim()
    const merged = `${newDeclString}${existing}${existing.endsWith(';') || existing === '' ? '' : ';'}`
    const replaced = attrs.replace(styleMatch[0], `style="${merged}"`)
    return originalTag.replace(attrs, replaced)
  }
  // No style attribute yet — append one. Keep the trailing `;` so
  // future merges via cascade don't need to re-stitch the boundary.
  const extra = ` style="${newDeclString}"`
  return originalTag.replace(/(\s*\/?)>$/, `${extra}$1>`)
}

/**
 * Honour the global production-default. Apps that want explicit
 * control should pass `inline` through {@link inlineCss} directly.
 */
export function shouldInlineByDefault(): boolean {
  const env = (globalThis.process?.env?.APP_ENV ?? globalThis.process?.env?.NODE_ENV ?? '').toLowerCase()
  return env === 'production'
}
