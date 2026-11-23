/**
 * The script that picks the theme before the first paint.
 *
 * It is the only JavaScript a marketing page needs before it can draw, so it
 * is written once here, as a real function the type checker and the linter
 * read, and emitted into the head as text by `themeBootScript`.
 *
 * It used to be a `<script>` block typed into the head partial. stx compiles
 * a script it finds in a partial as a scoped client script, and a scoped
 * client script needs the stx runtime: 250 KB of signals and hydration,
 * render-blocking in the head, on pages that hydrate nothing. Three small
 * scripts (this one, the one that marked the active theme button, and the
 * holding page's unlock) were the whole reason every marketing page loaded
 * it. Emitting this one as text keeps it out of that pipeline, and the other
 * two are folded in here or rendered only when they are needed.
 *
 * The storage key is shared with the blog (see blogChrome() in
 * core/actions/src/blog.ts), so a choice made here follows the reader to
 * /blog and back.
 *
 * Precedence: a ?theme= override, then a saved choice, then the operating
 * system preference. Only a visitor who has never chosen gets the OS answer,
 * which is what `prefers-color-scheme` is for.
 */

declare global {
  interface Window {
    stxTheme?: (next: string) => void
  }
}

/**
 * Runs in the browser, never on the server: `themeBootScript` ships this
 * function's source. It must therefore stand alone, with no reference to
 * anything outside its own body.
 */
function bootTheme(): void {
  const modes = ['light', 'dark']
  const root = document.documentElement

  // Storage and matchMedia both throw in some embedded and locked-down
  // browsers. A theme is never worth an exception before first paint.
  const attempt = (read: () => string | null): string => {
    try {
      return read() || ''
    }
    catch {
      return ''
    }
  }

  const requested = attempt(() => new URLSearchParams(location.search).get('theme'))
  const saved = attempt(() => localStorage.getItem('stacks-theme') || localStorage.getItem('stacks-blog-theme'))
  const system = attempt(() => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  const theme = [requested, saved, system].find(mode => modes.includes(mode)) || 'light'

  // The toggle's buttons say which theme is on. They do not exist yet when
  // this runs in the head, so they are marked once the document has parsed.
  const mark = (current: string | null): void => {
    for (const button of document.querySelectorAll('.theme-toggle button'))
      button.setAttribute('aria-pressed', String(button.getAttribute('data-t') === current))
  }

  root.setAttribute('data-theme', theme)

  window.stxTheme = (next: string): void => {
    if (!modes.includes(next))
      return

    try {
      localStorage.setItem('stacks-theme', next)
    }
    catch {}

    root.setAttribute('data-theme', next)
    mark(next)
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => mark(root.getAttribute('data-theme')), { once: true })
  else
    mark(theme)
}

/**
 * The whole `<script>` element, ready for `{!! themeBootScript !!}`.
 *
 * Bun has already compiled this module by the time `toString()` runs, so the
 * text it returns is JavaScript with the annotations gone.
 */
export const themeBootScript = `<script>(${bootTheme.toString()})()</script>`
