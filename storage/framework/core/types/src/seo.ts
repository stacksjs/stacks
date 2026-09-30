/**
 * **SEO Options** (`config/app.ts` → `seo`)
 *
 * The views server answers `/sitemap.xml` and `/robots.txt` for every app, in
 * development and production alike, generated from `resources/views` at
 * request time. Nothing here is required: an app with no `seo` block gets a
 * sitemap of its static pages and a robots.txt that points at it.
 *
 * A page stays out of the sitemap when its source says `noindex` - a
 * `<meta name="robots" content="noindex">` tag, a `robots: 'noindex'` head
 * entry, or the `const noindex = true` flag a shared head partial turns into
 * that tag - or when it is dynamic (`[param].stx`), an error page, behind the
 * `auth` page middleware, or disallowed by robots.txt.
 */
export interface SeoOptions {
  /**
   * The origin every URL in the sitemap and robots.txt is built on.
   *
   * Defaults to `app.url` (APP_URL). The request's own origin is used only
   * when neither is a usable public origin, which is the local-dev case.
   *
   * @example 'https://example.com'
   */
  origin?: string

  /**
   * Whether a hand-written `public/sitemap.xml` or `public/robots.txt` is
   * served instead of the generated one.
   *
   * - `'prefer'` (default): the file in `public/` wins, and the server warns
   *   at boot when a hand-written sitemap no longer lists every page.
   * - `'replace'`: the generated file is served even when `public/` has one.
   *
   * @default 'prefer'
   */
  handwritten?: 'prefer' | 'replace'

  /** `/sitemap.xml`, or `false` to not serve one. */
  sitemap?: false | SeoSitemapOptions

  /** `/robots.txt`, or `false` to not serve one. */
  robots?: false | SeoRobotsOptions
}

export interface SeoSitemapEntry {
  /** A path (`/pricing`) or an absolute URL on the site's origin. */
  loc: string
  /** ISO 8601 date (`2026-09-29`). */
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  /** 0.0 to 1.0. */
  priority?: number
}

export interface SeoSitemapOptions {
  /**
   * Extra URLs to list. The place for pages the views scan cannot know about:
   * the concrete instances of a dynamic route (`/products/blue-mug` for
   * `products/[slug].stx`), or a path another process serves.
   *
   * @example ['/changelog', { loc: '/products/blue-mug', priority: 0.8 }]
   */
  include?: (string | SeoSitemapEntry)[]

  /**
   * Extra URLs computed at request time, e.g. from the database. Cached for
   * ten minutes in production and recomputed on every request in development.
   *
   * @example async () => (await Product.all()).map(p => `/products/${p.slug}`)
   */
  entries?: () => (string | SeoSitemapEntry)[] | Promise<(string | SeoSitemapEntry)[]>

  /**
   * Paths to leave out. An entry ending in `/` or `*` excludes everything
   * under it; anything else is an exact path.
   *
   * @example ['/styleguide', '/internal/']
   */
  exclude?: string[]
}

export interface SeoRobotsRule {
  /** `*`, `Googlebot`, `GPTBot`, ... */
  userAgent: string
  allow?: string[]
  disallow?: string[]
  crawlDelay?: number
}

export interface SeoRobotsOptions {
  /**
   * Paths every crawler is asked to skip, added to the default `/api/`.
   * A disallowed path is also left out of the sitemap, since listing a URL
   * robots.txt blocks is a contradiction search consoles flag.
   *
   * Do not disallow a page only to hide it from search: a crawler that may
   * not fetch a page never sees its `noindex`, so it can still be indexed
   * from links. Mark the page `noindex` instead.
   *
   * @example ['/checkout/', '/thanks']
   */
  disallow?: string[]

  /** Additional per-crawler groups, written after the `*` group. */
  rules?: SeoRobotsRule[]
}
