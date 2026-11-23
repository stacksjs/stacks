/**
 * How the site's own static files reach a page: the stylesheets inlined into
 * the head, the two font files it preloads, and versioned URLs for anything
 * still linked by path.
 *
 * The stylesheets used to be three render-blocking `<link>`s (theme.css,
 * marketing.css, and home.css on the home page). Each one is a round trip the
 * browser has to finish before it may paint anything, and on a cold
 * connection they were most of the time between the HTML arriving and the
 * first pixel. `inlineStyles()` puts them in the document instead, comments
 * and indentation removed, so the page that arrives is the page that paints.
 * The files stay in public/assets/styles where they have always been edited:
 * the holding page still links theme.css, and the blog mirrors its tokens.
 *
 * public/ is found by walking up from the working directory, never by counting
 * `..` from this module: in production the app runs from a bundle in
 * storage/framework/runtime/production, where relative path arithmetic from
 * import.meta.dir points somewhere else entirely.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

const bootVersion = Date.now().toString(36)

function publicRoot(): string | undefined {
  let dir = process.cwd()

  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(dir, 'public')
    if (existsSync(join(candidate, 'assets')))
      return candidate

    const parent = dirname(dir)
    if (parent === dir)
      break
    dir = parent
  }

  return undefined
}

/**
 * The URL to link for a file under public/, with a version that changes when
 * the file's content does.
 *
 * public/ is served with `Cache-Control: public, max-age=3600`, so a file
 * linked by bare path keeps its old copy in a returning visitor's cache for
 * up to an hour after a deploy, against new markup. `?v=<content hash>` makes
 * the URL change exactly when the file does. If the file cannot be read, the
 * version falls back to the process start time, which changes on every deploy
 * and so still busts the cache, just less precisely.
 *
 * Hashed on every call rather than memoised: the stylesheets are tens of
 * kilobytes, and a memo would pin the dev server to the version it saw at boot
 * while the CSS kept changing underneath it.
 */
export function assetUrl(path: string): string {
  const root = publicRoot()

  if (root) {
    try {
      const contents = readFileSync(join(root, path))
      return `${path}?v=${Bun.hash(contents).toString(36)}`
    }
    catch {}
  }

  return `${path}?v=${bootVersion}`
}

/**
 * The brand faces, by the names theme.css gives them in its `@font-face`
 * rules. Each name carries the file's own content hash, which is what the
 * server looks for before it answers with a year of immutable caching, and
 * what lets the head partial preload a file and theme.css use that same file
 * rather than fetching it twice under two URLs.
 */
export const fonts = {
  sans: '/assets/fonts/geist/geist-latin.9b6f5ff45b27.woff2',
  mono: '/assets/fonts/geist/geist-mono-latin.5f3d6ad60f29.woff2',
}

/**
 * Remove what a stylesheet carries for its authors and a browser never reads:
 * comments, indentation, and the space around punctuation.
 *
 * Deliberately not a real minifier. It never reorders, merges, or rewrites a
 * rule, so what the browser parses is the file as written, and it only
 * removes a space where CSS cannot need one. The space before a colon stays,
 * because `a :hover` and `a:hover` are different selectors, and the spaces
 * inside `calc(100% - 48px)` are never beside the punctuation touched here.
 */
export function minifyCss(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/ ?([{};,]) ?/g, '$1')
    .replace(/: /g, ':')
    .replace(/;\}/g, '}')
    .trim()
}

/** An SVG at or under this many bytes rides along in the stylesheet. */
const INLINE_SVG_LIMIT = 2048

/**
 * Put a small SVG a stylesheet points at into the stylesheet itself.
 *
 * The deploy panel's watermark is the logo mark, used as a CSS mask. As a
 * `url()` it was one more request on every visit, for a kilobyte, cached for
 * an hour because nothing rewrites a URL inside a stylesheet. The file stays
 * the single drawing of the mark; this only changes how it travels. Anything
 * larger, or not an SVG, or not found under public/, keeps its URL.
 */
function inlineSmallSvgs(css: string, root: string): string {
  return css.replace(/url\("(\/[^"?#]+\.svg)"\)/g, (reference, path: string) => {
    try {
      const svg = readFileSync(join(root, path), 'utf8')
      if (svg.length > INLINE_SVG_LIMIT)
        return reference

      // A data URL needs only the characters a URL or a quoted CSS string
      // would trip on escaped; encoding the rest would triple its size.
      const data = svg.replace(/\s+/g, ' ').replace(/> </g, '><').trim().replace(/[%#"<>]/g, char => encodeURIComponent(char))
      return `url("data:image/svg+xml,${data}")`
    }
    catch {
      return reference
    }
  })
}

const inlined = new Map<string, { stamp: number, css: string }>()

/**
 * One `<style>` element holding the named files from public/assets/styles,
 * in the order given. Emit it raw: `{!! inlineStyles(['theme', 'marketing']) !!}`.
 *
 * Each file is read and minified once and then kept, keyed by its
 * modification time, so production does the work once per file per process
 * and `buddy dev` picks up an edit on the next request. A file that cannot be
 * read contributes nothing rather than failing the page: a page without one
 * of its stylesheets is still a page, and the missing file is far easier to
 * notice in the browser than in a 500.
 */
export function inlineStyles(names: string[]): string {
  const root = publicRoot()
  const sheets: string[] = []

  for (const name of names) {
    if (!root)
      continue

    const file = join(root, 'assets/styles', `${name}.css`)

    try {
      const stamp = statSync(file).mtimeMs
      const kept = inlined.get(file)

      if (kept?.stamp === stamp) {
        sheets.push(kept.css)
        continue
      }

      const css = inlineSmallSvgs(minifyCss(readFileSync(file, 'utf8')), root)
      inlined.set(file, { stamp, css })
      sheets.push(css)
    }
    catch {}
  }

  return `<style>${sheets.join('')}</style>`
}
