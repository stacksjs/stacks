/**
 * How the site's own static files reach a page, and the templates that must
 * go through it.
 *
 * Three things are pinned here, each of which regresses without a visible
 * symptom:
 *
 *   - A stylesheet linked by bare path keeps its old copy in a returning
 *     visitor's cache after a deploy, so new markup renders against old CSS,
 *     which is how the rebuilt home page once showed a call-out as unstyled
 *     text in production.
 *   - A `<script>` typed into a marketing partial is compiled as an stx client
 *     script, and one of those is enough to make every marketing page load
 *     the 250 KB stx runtime, render-blocking, to hydrate nothing.
 *   - The two font files are named in three places (the preload, theme.css,
 *     the blog's theme). A name that drifts is a font fetched twice, or not
 *     at all, and the page falls back to the system face without complaint.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { assetUrl, fonts, inlineStyles, minifyCss } from '../../resources/data/assets'
import { themeBootScript } from '../../resources/data/theme'

const root = join(import.meta.dir, '../..')

describe('assetUrl', () => {
  test('versions a stylesheet by its content hash', () => {
    const path = '/assets/styles/home.css'
    const hash = Bun.hash(readFileSync(join(root, 'public', path))).toString(36)

    expect(assetUrl(path)).toBe(`${path}?v=${hash}`)
  })

  test('still versions a path it cannot read, so a cache is busted anyway', () => {
    expect(assetUrl('/assets/styles/does-not-exist.css')).toMatch(/^\/assets\/styles\/does-not-exist\.css\?v=[0-9a-z]+$/)
  })
})

describe('the marketing templates', () => {
  const templates = [
    'resources/partials/marketing-head.stx',
    'resources/views/index.stx',
    'resources/views/coming-soon.stx',
  ]

  for (const file of templates) {
    test(`${file} links no stylesheet by a bare, unversioned path`, () => {
      const source = readFileSync(join(root, file), 'utf8')
      expect(source).not.toMatch(/<link rel="stylesheet" href="\/assets\//)
    })
  }
})

describe('the stylesheets a page inlines', () => {
  test('arrive as one style element, in the order asked for', () => {
    const html = inlineStyles(['theme', 'marketing', 'home'])

    expect(html.startsWith('<style>')).toBe(true)
    expect(html.endsWith('</style>')).toBe(true)
    expect(html.match(/<style>/g)).toHaveLength(1)

    // One rule only each file has, so the order is the files' order.
    const theme = html.indexOf('@font-face')
    const marketing = html.indexOf('.site-nav{')
    const home = html.indexOf('.home-hero{')
    expect(theme).toBeGreaterThan(-1)
    expect(marketing).toBeGreaterThan(theme)
    expect(home).toBeGreaterThan(marketing)
  })

  test('carry no comments and cannot close the element early', () => {
    const html = inlineStyles(['theme', 'marketing', 'home'])
    const css = html.slice('<style>'.length, -'</style>'.length)

    expect(css).not.toContain('/*')
    expect(css.toLowerCase()).not.toContain('</style')
  })

  test('carry the small SVG they point at, and leave the large ones as URLs', () => {
    const home = inlineStyles(['home'])
    const marketing = inlineStyles(['marketing'])

    // The logo mark is a kilobyte: it travels in the sheet, not as a request.
    expect(home).not.toContain('url("/images/logos/logo-mini.svg")')
    expect(home).toContain('url("data:image/svg+xml,%3Csvg ')
    // The holding card's topography is twenty: it stays a file.
    expect(marketing).toContain('url("/assets/images/topography.svg")')
  })

  test('a sheet that does not exist is left out rather than failing the page', () => {
    expect(inlineStyles(['does-not-exist'])).toBe('<style></style>')
  })
})

describe('minifyCss', () => {
  test('removes what only an author reads', () => {
    expect(minifyCss('/* note */\n.a {\n  color: red;\n  margin: 0 auto;\n}\n')).toBe('.a{color:red;margin:0 auto}')
  })

  test('keeps the spaces CSS gives meaning to', () => {
    // A descendant pseudo-class, a calc() expression, and a compound value
    // all read differently with their spaces removed.
    expect(minifyCss('.a :hover { width: calc(100% - 48px); }')).toBe('.a :hover{width:calc(100% - 48px)}')
    expect(minifyCss('.a { transition: color 0.2s ease, transform 0.2s ease; }')).toBe('.a{transition:color 0.2s ease,transform 0.2s ease}')
    expect(minifyCss('@media (max-width: 900px) and (min-width: 600px) { .a { top: 0 } }')).toBe('@media (max-width:900px) and (min-width:600px){.a{top:0}}')
  })
})

describe('the brand fonts', () => {
  const themeCss = readFileSync(join(root, 'public/assets/styles/theme.css'), 'utf8')

  for (const [role, url] of Object.entries(fonts)) {
    test(`${role} exists, and its name is its content hash`, () => {
      const file = join(root, 'public', url)
      expect(existsSync(file)).toBe(true)

      // The server answers a hashed name with a year of immutable caching,
      // so the name has to change whenever the bytes do.
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12)
      expect(url).toContain(`.${hash}.woff2`)
    })

    test(`${role} is the file theme.css loads`, () => {
      expect(themeCss).toContain(`url("${url}")`)
    })
  }

  test('no font file is left in the directory unused', () => {
    const shipped = readdirSync(join(root, 'public/assets/fonts/geist')).map(name => `/assets/fonts/geist/${name}`)
    expect(shipped.sort()).toEqual(Object.values(fonts).sort())
  })

  test('nothing the site serves asks another origin for a font', () => {
    const sources = [
      'resources/partials/marketing-head.stx',
      'resources/views/coming-soon.stx',
      'public/assets/styles/theme.css',
      'public/assets/styles/marketing.css',
      'public/assets/styles/home.css',
      'public/assets/styles/blog.css',
    ]

    for (const file of sources)
      expect(readFileSync(join(root, file), 'utf8')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })
})

describe('client scripts on the marketing pages', () => {
  // Every file a marketing page is assembled from. A `<script>` in any of
  // them, other than the server block and structured data, is compiled as an
  // stx client script and brings the runtime with it.
  const files = [
    ...readdirSync(join(root, 'resources/partials')).filter(name => name.startsWith('marketing-') || name.startsWith('blog-')).map(name => `resources/partials/${name}`),
    'resources/views/index.stx',
    'resources/views/blog.stx',
    'resources/views/blog/[slug].stx',
    'resources/views/features/index.stx',
    'resources/views/features/[slug].stx',
    'resources/views/use-cases/index.stx',
    'resources/views/use-cases/[slug].stx',
    'resources/views/compare/index.stx',
    'resources/views/compare/[slug].stx',
  ]

  for (const file of files) {
    test(`${file} declares none`, () => {
      const source = readFileSync(join(root, file), 'utf8').replace(/\{\{--[\s\S]*?--\}\}/g, '')
      const scripts = source.match(/<script\b[^>]*>/g) ?? []

      // The home page's holding-card unlock is the one exception, and it is
      // inside the branch that only renders while the site is closed.
      const client = scripts.filter(tag => !/\bserver\b/.test(tag) && !tag.includes('application/ld+json') && !tag.includes('site-mode.js'))
      expect(client).toEqual([])
    })
  }

  test('the home page only loads the holding-card script while it is closed', () => {
    const source = readFileSync(join(root, 'resources/views/index.stx'), 'utf8')
    const guard = source.lastIndexOf('@if (siteMode !== \'live\')')
    const script = source.indexOf('site-mode.js')

    expect(guard).toBeGreaterThan(-1)
    expect(script).toBeGreaterThan(guard)
    expect(source.indexOf('@endif', guard)).toBeGreaterThan(script)
  })
})

describe('the theme bootstrap', () => {
  const body = themeBootScript.slice('<script>'.length, -'</script>'.length)

  /** Run the emitted script against a document that records what it is told. */
  function run(options: { search?: string, saved?: string, dark?: boolean }) {
    const attributes: Record<string, string> = {}
    const stored: Record<string, string> = options.saved ? { 'stacks-theme': options.saved } : {}
    const window: { stxTheme?: (next: string) => void } = {}
    const document = {
      readyState: 'complete',
      documentElement: {
        setAttribute: (name: string, value: string) => { attributes[name] = value },
        getAttribute: (name: string) => attributes[name] ?? null,
      },
      querySelectorAll: () => [],
      addEventListener: () => {},
    }
    const localStorage = {
      getItem: (key: string) => stored[key] ?? null,
      setItem: (key: string, value: string) => { stored[key] = value },
    }

    // eslint-disable-next-line no-new-func
    new Function('window', 'document', 'location', 'localStorage', 'matchMedia', body)(
      window,
      document,
      { search: options.search ?? '' },
      localStorage,
      () => ({ matches: options.dark === true }),
    )

    return { attributes, stored, window }
  }

  test('is one plain inline script', () => {
    expect(themeBootScript.startsWith('<script>')).toBe(true)
    expect(themeBootScript.endsWith('</script>')).toBe(true)
    expect(body).not.toContain('</script')
    // What ships is JavaScript: an annotation left in it is a syntax error
    // in the browser, and a page with no theme.
    expect(() => new Function(body)).not.toThrow()
  })

  test('a visitor who has never chosen gets the system preference', () => {
    expect(run({ dark: true }).attributes['data-theme']).toBe('dark')
    expect(run({ dark: false }).attributes['data-theme']).toBe('light')
  })

  test('a saved choice outranks the system, and ?theme= outranks both', () => {
    expect(run({ saved: 'light', dark: true }).attributes['data-theme']).toBe('light')
    expect(run({ search: '?theme=dark', saved: 'light' }).attributes['data-theme']).toBe('dark')
  })

  test('a value that is not a theme is ignored', () => {
    expect(run({ search: '?theme=colored', saved: 'colored', dark: true }).attributes['data-theme']).toBe('dark')
  })

  test('the toggle applies a theme and remembers it', () => {
    const page = run({ dark: false })
    page.window.stxTheme?.('dark')

    expect(page.attributes['data-theme']).toBe('dark')
    expect(page.stored['stacks-theme']).toBe('dark')

    page.window.stxTheme?.('sepia')
    expect(page.attributes['data-theme']).toBe('dark')
  })
})
