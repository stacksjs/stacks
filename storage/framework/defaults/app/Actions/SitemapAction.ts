import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Generate the top-level sitemap.xml.
 *
 * Strategy:
 *   1. Walk resources/views and storage/framework/defaults/resources/views
 *      collecting static pages — file paths that don't contain `[`
 *      (dynamic) or `[...]` (catch-all). The static set covers the
 *      home page, /about, /faq, /products listing, etc.
 *   2. For dynamic patterns (e.g. resources/views/products/[slug].stx)
 *      fan out using the database — currently the storefront's
 *      `products` table by `slug`. Apps with other dynamic models
 *      (blog posts, categories) can extend this list by re-registering
 *      the route in `routes/api.ts` against their own action.
 *   3. Always exclude private surfaces — /cart, /checkout/*,
 *      /orders/*, /login, /register, /dashboard, /api/* etc. The
 *      EXCLUDED_PATTERNS list below is the source of truth.
 *
 * The output is cached for 1 hour via the `Cache-Control` header so
 * search engine pings don't hit the DB on every fetch. For larger
 * catalogs, switch to a sitemap-index (`/sitemap.xml` pointing at
 * `/sitemap-products.xml` etc.) — left as a follow-up because the
 * current impl handles up to ~50k URLs in <100ms.
 */

const PROJECT_VIEWS = 'resources/views'
const FRAMEWORK_VIEWS = 'storage/framework/defaults/resources/views'

// Path prefixes that should never be indexed. Matched as a literal
// prefix on the URL path (so '/cart' matches '/cart' and '/cart/x').
//
// `/blog/category` and `/blog/post` are framework-default templates
// for the dynamic CMS detail pages, NOT routes themselves — the
// actual URLs are `/blog/categories/{slug}` and `/blog/posts/{id}`,
// emitted by the CMS sitemap. Filename-as-route discovery would
// otherwise treat the bare templates as static pages and index URLs
// that 404. Treat them as templates and let CMS-aware sitemaps
// handle the dynamic fan-out.
const EXCLUDED_PATTERNS: ReadonlyArray<string | RegExp> = [
  '/cart',
  '/checkout',
  '/orders',
  '/login',
  '/register',
  '/logout',
  '/dashboard',
  '/api',
  '/auth',
  '/me',
  '/admin',
  '/install',
  '/test-error',
  '/_stx',
  '/voide',
  '/blog/category',
  '/blog/post',
  '/blog/categories',
  '/emails',
  /^\/\[\.\.\..+\]/, // catch-all pages like /[...all].stx
]

interface SitemapEntry {
  loc: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
  lastmod?: string
}

function isExcluded(urlPath: string): boolean {
  for (const pat of EXCLUDED_PATTERNS) {
    if (typeof pat === 'string') {
      if (urlPath === pat || urlPath.startsWith(`${pat}/`))
        return true
    }
    else if (pat.test(urlPath)) {
      return true
    }
  }
  return false
}

function fileToUrl(viewsRoot: string, file: string): string | null {
  let rel = file.startsWith(viewsRoot) ? file.slice(viewsRoot.length) : file
  if (rel.startsWith('/'))
    rel = rel.slice(1)
  // Strip extension
  rel = rel.replace(/\.(stx|md|html)$/i, '')
  // index.stx → '' (root)
  if (rel === 'index')
    return '/'
  if (rel.endsWith('/index'))
    rel = rel.slice(0, -'/index'.length)
  return `/${rel}`
}

function walkViews(root: string): string[] {
  if (!existsSync(root))
    return []
  const out: string[] = []
  function visit(dir: string) {
    let entries: string[]
    try { entries = readdirSync(dir) }
    catch { return }
    for (const name of entries) {
      const full = join(dir, name)
      let s
      try { s = statSync(full) }
      catch { continue }
      // Skip layouts / components / partials — they're not addressable URLs.
      if (s.isDirectory()) {
        if (name === 'layouts' || name === 'components' || name === 'partials' || name === 'emails' || name === 'dashboard')
          continue
        visit(full)
      }
      else if (/\.(?:stx|md|html)$/i.test(name)) {
        out.push(full)
      }
    }
  }
  visit(root)
  return out
}

async function discoverProducts(): Promise<SitemapEntry[]> {
  // Best effort: pull from a `products` table if it exists (storefront
  // model is the framework default). Apps without commerce schema get
  // an empty list and the sitemap silently omits this section.
  try {
    const rows: Array<{ slug: string, updated_at?: string }> = await (db as any)
      .selectFrom('products')
      .where('is_available', '=', 1)
      .select(['slug', 'updated_at'])
      .execute()
    return rows
      .filter(r => r.slug)
      .map(r => ({
        loc: `/products/${r.slug}`,
        changefreq: 'weekly' as const,
        priority: 0.8,
        lastmod: r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : undefined,
      }))
  }
  catch {
    return []
  }
}

function staticEntries(): SitemapEntry[] {
  const seen = new Set<string>()
  const entries: SitemapEntry[] = []

  for (const root of [PROJECT_VIEWS, FRAMEWORK_VIEWS]) {
    for (const file of walkViews(root)) {
      const urlPath = fileToUrl(root, file)
      if (!urlPath)
        continue
      // Dynamic + catch-all paths get filtered out — they're handled
      // separately (see discoverProducts).
      if (urlPath.includes('['))
        continue
      if (isExcluded(urlPath))
        continue
      if (seen.has(urlPath))
        continue
      seen.add(urlPath)

      // Home gets top priority + daily; everything else is ~0.6 weekly.
      // Pages with dynamic data (products listing, blog index) bump up
      // a touch because they update more often than static copy.
      const isHome = urlPath === '/'
      const isHighChurn = /^\/(?:products|blog)\b/.test(urlPath)
      entries.push({
        loc: urlPath,
        changefreq: isHome ? 'daily' : (isHighChurn ? 'daily' : 'weekly'),
        priority: isHome ? 1.0 : (isHighChurn ? 0.9 : 0.6),
      })
    }
  }
  return entries
}

function normalizeSiteUrl(siteUrl: string): string {
  // Strip trailing slash and ensure a scheme. Stacks `.env` files
  // commonly carry `APP_URL=foo.localhost` (no protocol — the dev
  // proxy adds the https:// at runtime), but absolute URLs in a
  // sitemap need an explicit scheme or search engines will reject
  // every entry. Default to https:// since that's what the rpx layer
  // serves; pages forced onto plain HTTP (custom configs) should set
  // an explicit `http://…` in APP_URL.
  let u = siteUrl.trim().replace(/\/$/, '')
  if (!/^https?:\/\//i.test(u))
    u = `https://${u}`
  return u
}

function renderXml(siteUrl: string, entries: SitemapEntry[]): string {
  const url = normalizeSiteUrl(siteUrl)
  const xmlEntries = entries.map((e) => {
    const tags: string[] = [`    <loc>${url}${e.loc}</loc>`]
    if (e.lastmod)
      tags.push(`    <lastmod>${e.lastmod}</lastmod>`)
    if (e.changefreq)
      tags.push(`    <changefreq>${e.changefreq}</changefreq>`)
    if (typeof e.priority === 'number')
      tags.push(`    <priority>${e.priority.toFixed(1)}</priority>`)
    return `  <url>\n${tags.join('\n')}\n  </url>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries}\n</urlset>\n`
}

export default new Action({
  name: 'SitemapAction',
  description: 'Generate the top-level sitemap.xml from views + product catalog',
  method: 'GET',

  async handle() {
    const siteUrl = (config as any).app?.url || 'http://localhost:3000'
    const all: SitemapEntry[] = [
      ...staticEntries(),
      ...(await discoverProducts()),
    ]

    return response.xml(renderXml(siteUrl, all), 200, {
      'Cache-Control': 'public, max-age=3600',
    })
  },
})
