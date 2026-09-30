/**
 * `/sitemap.xml` and `/robots.txt` for every Stacks app, generated from its
 * views.
 *
 * Apps used to hand-write both into `public/`, and a hand-written sitemap is
 * stale the day a page is added: nothing compares it to `resources/views`, and
 * a crawler never says which pages it was not told about. Only the CMS and the
 * blog produced one, at `/blog/sitemap.xml`, which covers the blog and nothing
 * else.
 *
 * Served by the views server at request time rather than written at build
 * time, from one function both `buddy dev` and `buddy serve` call at the same
 * point in `onRequest`. That keeps development and production identical, needs
 * no build step to have run, and needs no route in the app: a root-mounted
 * `route.get('/sitemap.xml')` would not reach the API anyway, because the views
 * server does not forward root GETs (see `unforwardableRoutes` in
 * `@stacksjs/server`).
 *
 * The rules, in the order they apply:
 *
 *   - A hand-written `public/sitemap.xml` or `public/robots.txt` wins unless
 *     `app.seo.handwritten` is `'replace'`. An app that ships one did so on
 *     purpose; the boot check says when it has fallen behind the views.
 *   - A view is listed when it is a static route under `resources/views`. It
 *     is not listed when it is dynamic (`[slug].stx`), an error page (`404`,
 *     `errors/*`), a building block (`components/`, `layouts/`, `partials/`,
 *     `emails/`), behind the `auth` page middleware, excluded in config, or
 *     disallowed by robots.txt - or when it says `noindex` (see
 *     `declaresNoindex`).
 *   - The blog's posts are merged into the same file, so there is one
 *     `/sitemap.xml` rather than two that disagree. `/blog/sitemap.xml` keeps
 *     being served as before.
 *   - Instances of dynamic routes come from config: `seo.sitemap.include` or
 *     `seo.sitemap.entries()`.
 *
 * The framework's own default views (`/login`, `/register`, ...) are never
 * listed: they are served from the defaults tree, not `resources/views`, and
 * an auth form is not a page anyone searches for.
 */
import type { SeoOptions, SeoRobotsOptions, SeoRobotsRule, SeoSitemapEntry, SeoSitemapOptions } from '@stacksjs/types'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { generateRobotsTxt, generateSitemap, scanForSitemapEntries } from '@stacksjs/stx/seo'
import { usableOrigin } from './site-origin'

/**
 * Directories under a page root whose contents are never pages. The same list
 * as `NON_PAGE_DIRS` in stx-router's `page-routes.ts`, which decides what stx
 * routes - repeated here because stx-router is not a dependency of this
 * package, and a page stx refuses to route must not be advertised.
 */
export const NON_PAGE_DIRS: readonly string[] = ['components', 'layouts', 'partials', 'emails']

/** Always disallowed for every crawler: JSON endpoints are not pages. */
export const DEFAULT_ROBOTS_DISALLOW: readonly string[] = ['/api/']

/** Why a view was left out of the sitemap, for the boot report and tests. */
export type SitemapSkipReason = 'dynamic' | 'error-page' | 'non-page' | 'noindex' | 'auth' | 'excluded' | 'disallowed'

export interface ViewSitemapScan {
  entries: SeoSitemapEntry[]
  skipped: { path: string, reason: SitemapSkipReason }[]
}

/**
 * Strip comments before looking for signals, so a commented-out
 * `<meta name="robots" content="noindex">` does not hide a page.
 *
 * `//` is only a comment when it does not follow a `:` - otherwise every
 * `https://` in a template would swallow the rest of its line.
 */
function withoutComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{--[\s\S]*?--\}\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1')
}

/**
 * Whether a view's source says it must stay out of search.
 *
 * `noindex` is the one signal: a page that tells crawlers not to index it is
 * never listed, because a sitemap entry for a `noindex` page is a
 * contradiction search consoles report as an error. It is recognised in the
 * three spellings a Stacks page uses:
 *
 *   1. `<meta name="robots" content="noindex">`, written in the page.
 *   2. `robots: 'noindex'` in a head/SEO object (`useHead`, `useSeoMeta`,
 *      `definePageMeta`).
 *   3. `const noindex = true` in the page's server script - the flag a shared
 *      head partial turns into the tag, which is how a page that includes its
 *      `<head>` from a partial says it. A static scan cannot follow the
 *      include, so the flag has to be spelled with that name to be seen.
 *
 * `definePageMeta({ sitemap: false })` is also honoured, for a page that may
 * be indexed but should not be advertised; it is stx's static-build spelling.
 */
export function declaresNoindex(source: string): boolean {
  const code = withoutComments(source)

  for (const tag of code.match(/<meta\b[^>]*>/gi) ?? []) {
    if (/\bname\s*=\s*["']?(?:robots|googlebot)\b/i.test(tag) && /\bcontent\s*=\s*["'][^"']*\bnoindex\b/i.test(tag))
      return true
  }

  if (/\brobots\s*:\s*(["'`])[^"'`]*\bnoindex\b/i.test(code))
    return true
  if (/\b(?:const|let|var)\s+noindex\s*(?::\s*boolean\s*)?=\s*true\b/.test(code))
    return true
  if (/\bsitemap\s*:\s*false\b/.test(code))
    return true

  return false
}

/**
 * Whether a view is gated by the `auth` page middleware
 * (`definePageMeta({ middleware: ['auth'] })`). A crawler following its
 * sitemap entry is redirected to `/login`, so listing it only advertises the
 * login page under another name.
 */
export function requiresAuth(source: string): boolean {
  const code = withoutComments(source)
  const match = code.match(/\bmiddleware\s*:\s*(\[[^\]]*\]|["'][^"']*["'])/)
  return !!match && /["']auth["']/.test(match[1]!)
}

/** Error and holding pages: rendered on a status, never navigated to. */
export function isErrorViewPath(path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  const last = segments.at(-1) ?? ''
  return segments.includes('errors') || /^(?:\d{3}|error|coming-soon|maintenance)$/.test(last)
}

/** True for a path inside a non-page directory, or a `_`/`.`-prefixed segment. */
export function isNonPagePath(path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  return segments.slice(0, -1).some(segment => NON_PAGE_DIRS.includes(segment))
    || segments.some(segment => segment.startsWith('_') || segment.startsWith('.'))
}

/** `/a/[slug]`, `/[[lang]]`, `/[...rest]` - anything stx fills from the URL. */
export function isDynamicPath(path: string): boolean {
  return /\[[^\]]*\]/.test(path)
}

/**
 * Whether `pattern` from config matches `path`: an entry ending in `/` or `*`
 * matches everything under it (and the bare path itself), anything else is an
 * exact path.
 */
export function pathMatchesExclude(path: string, pattern: string): boolean {
  if (!pattern)
    return false
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return path.startsWith(prefix) || `${path}/` === prefix
  }
  if (pattern.endsWith('/') && pattern !== '/')
    return path.startsWith(pattern) || `${path}/` === pattern
  return path === pattern || (pattern !== '/' && path === pattern.replace(/\/+$/, ''))
}

/**
 * Length of the longest robots.txt rule in `rules` that matches `path`, or -1.
 * Robots rules are prefix matches with `*` as a wildcard and a trailing `$`
 * anchoring the end (RFC 9309 §2.2.2).
 */
function longestRobotsMatch(path: string, rules: readonly string[]): number {
  let best = -1
  for (const rule of rules) {
    if (!rule)
      continue
    const anchored = rule.endsWith('$')
    const body = anchored ? rule.slice(0, -1) : rule
    const pattern = body.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
    if (new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(path))
      best = Math.max(best, rule.length)
  }
  return best
}

/**
 * Whether robots.txt's `*` group blocks `path`: the longest matching rule
 * wins, and an `Allow` wins a tie (RFC 9309 §2.2.2).
 */
export function isDisallowedByRobots(path: string, group: { allow?: readonly string[], disallow?: readonly string[] }): boolean {
  const disallow = longestRobotsMatch(path, group.disallow ?? [])
  return disallow >= 0 && disallow > longestRobotsMatch(path, group.allow ?? [])
}

/** The sitemap options, or undefined when the app turned the sitemap off. */
function sitemapOptions(seo?: SeoOptions): SeoSitemapOptions | undefined {
  if (seo?.sitemap === false)
    return undefined
  return seo?.sitemap ?? {}
}

/** The robots options, or undefined when the app turned robots.txt off. */
function robotsOptions(seo?: SeoOptions): SeoRobotsOptions | undefined {
  if (seo?.robots === false)
    return undefined
  return seo?.robots ?? {}
}

/**
 * The `*` group robots.txt publishes: `Allow: /`, the framework's defaults and
 * the app's own `disallow`, deduplicated in that order.
 */
export function robotsDefaultGroup(seo?: SeoOptions): SeoRobotsRule {
  const disallow = [...new Set([...DEFAULT_ROBOTS_DISALLOW, ...(robotsOptions(seo)?.disallow ?? [])])]
  return { userAgent: '*', allow: ['/'], disallow }
}

/**
 * The origin every generated URL is built on: `seo.origin`, then `app.url`
 * (APP_URL), then the request's own origin - the last only for local
 * development, where APP_URL is often a bare `localhost`.
 */
export function resolveSeoOrigin(options: { seo?: SeoOptions, appUrl?: string, request?: Request }): string {
  const configured = usableOrigin(options.seo?.origin) || usableOrigin(options.appUrl)
  if (configured)
    return configured

  if (!options.request)
    return ''

  const url = new URL(options.request.url)
  const host = options.request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || url.host
  const proto = options.request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(':', '')
  return `${proto}://${host}`
}

/** robots.txt for the app, pointing at the sitemap when there is one. */
export function buildRobotsTxt(options: { seo?: SeoOptions, origin: string }): string {
  const robots = robotsOptions(options.seo)
  const rules = [robotsDefaultGroup(options.seo), ...(robots?.rules ?? [])]
  const body = generateRobotsTxt({
    rules,
    ...(sitemapOptions(options.seo) && options.origin && { sitemap: `${options.origin}/sitemap.xml` }),
  })

  return `# Generated by Stacks from resources/views and config/app.ts (seo).\n${body}\n`
}

/** Normalise a config entry into a sitemap entry with a path or absolute loc. */
function toEntry(value: string | SeoSitemapEntry): SeoSitemapEntry {
  return typeof value === 'string' ? { loc: value } : value
}

/** The path part of a sitemap `loc`, or the loc itself when it is a path. */
export function locPath(loc: string): string {
  if (!/^https?:\/\//i.test(loc))
    return loc.startsWith('/') ? loc : `/${loc}`
  try {
    return new URL(loc).pathname
  }
  catch {
    return loc
  }
}

/** Every `<loc>` in a sitemap or sitemap index. */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(match => match[1]!
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\''))
}

/**
 * The view file behind a scanned sitemap path. `scanForSitemapEntries` reports
 * `/about` for both `about.stx` and `about/index.stx`, so both are tried.
 */
function viewFileFor(viewsDir: string, path: string): string | undefined {
  const rel = path === '/' ? 'index' : path.replace(/^\//, '')
  for (const candidate of [`${rel}.stx`, `${rel}/index.stx`]) {
    const file = join(viewsDir, candidate)
    if (existsSync(file))
      return file
  }
  return undefined
}

/**
 * The app's own static pages, with the reason each other view was skipped.
 *
 * Discovery and `lastmod` come from stx's `scanForSitemapEntries`; everything
 * that decides whether a view is a public, indexable page is applied here, on
 * the path it reports and the source of the view behind it.
 */
export async function scanViewSitemapEntries(viewsDir: string, seo?: SeoOptions): Promise<ViewSitemapScan> {
  const result: ViewSitemapScan = { entries: [], skipped: [] }
  if (!existsSync(viewsDir))
    return result

  const scanned = await scanForSitemapEntries(viewsDir, {
    baseUrl: '',
    extensions: ['.stx'],
    // Filtering is done below, precisely: stx's default ignore list is a
    // substring test, which would also drop a page named `layouts-guide.stx`.
    ignore: ['node_modules'],
  })

  const exclude = sitemapOptions(seo)?.exclude ?? []
  const robotsGroup = robotsOptions(seo) ? robotsDefaultGroup(seo) : undefined
  const seen = new Set<string>()

  for (const entry of scanned) {
    const path = entry.loc
    if (seen.has(path))
      continue
    seen.add(path)

    const skip = (reason: SitemapSkipReason): void => {
      result.skipped.push({ path, reason })
    }

    if (isNonPagePath(path)) {
      skip('non-page')
      continue
    }
    if (isDynamicPath(path)) {
      skip('dynamic')
      continue
    }
    if (isErrorViewPath(path)) {
      skip('error-page')
      continue
    }
    if (exclude.some(pattern => pathMatchesExclude(path, pattern))) {
      skip('excluded')
      continue
    }
    if (robotsGroup && isDisallowedByRobots(path, robotsGroup)) {
      skip('disallowed')
      continue
    }

    const file = viewFileFor(viewsDir, path)
    const source = file ? readFileSync(file, 'utf8') : ''
    if (declaresNoindex(source)) {
      skip('noindex')
      continue
    }
    if (requiresAuth(source)) {
      skip('auth')
      continue
    }

    result.entries.push({
      loc: path,
      ...(entry.lastmod && { lastmod: entry.lastmod }),
      priority: path === '/' ? 1.0 : 0.5,
    })
  }

  return result
}

/**
 * The blog's paths: published posts from `content/blog` (the stx-native and
 * BunPress blogs), else the locs of a CMS-built `dist/blog/sitemap.xml`.
 */
async function blogEntries(root: string): Promise<SeoSitemapEntry[]> {
  const contentDir = join(root, 'content/blog')
  if (existsSync(contentDir)) {
    try {
      const { blogSitemapPaths } = await import('./blog')
      const paths = blogSitemapPaths(contentDir)
      if (paths.length > 0)
        return paths.map(loc => ({ loc, priority: loc === '/blog' ? 0.7 : 0.6 }))
    }
    catch { /* a blog that cannot load lists nothing rather than failing the sitemap */ }
  }

  const built = join(root, 'dist/blog/sitemap.xml')
  if (existsSync(built)) {
    try {
      return sitemapLocs(readFileSync(built, 'utf8')).map(loc => ({ loc: locPath(loc), priority: 0.6 }))
    }
    catch { /* unreadable: nothing to merge */ }
  }

  return []
}

export interface SitemapInputs {
  /** The project root; `resources/views` and `public/` are resolved from it. */
  root: string
  seo?: SeoOptions
  origin: string
  /** Skip `seo.sitemap.entries()`, e.g. at boot, where it may need a database. */
  skipDynamicEntries?: boolean
}

/**
 * Everything `/sitemap.xml` lists: the views, the blog, and config, with
 * config's `exclude` and robots.txt's `Disallow` applied to all of them and
 * each path listed once.
 */
export async function collectSitemapEntries(inputs: SitemapInputs): Promise<SeoSitemapEntry[]> {
  const options = sitemapOptions(inputs.seo)
  if (!options)
    return []

  const views = await scanViewSitemapEntries(join(inputs.root, 'resources/views'), inputs.seo)
  const configured = [...(options.include ?? [])]
  if (options.entries && !inputs.skipDynamicEntries) {
    try {
      configured.push(...await options.entries())
    }
    catch (error) {
      // One failing query must not take the whole sitemap down with it.
      console.warn(`[seo] seo.sitemap.entries() failed; serving the sitemap without them: ${(error as Error).message}`)
    }
  }

  // The views were filtered by the scan; the blog and config pass the same
  // two gates here, so no source can list a path the app excluded or
  // robots.txt blocks.
  const exclude = options.exclude ?? []
  const robotsGroup = robotsOptions(inputs.seo) ? robotsDefaultGroup(inputs.seo) : undefined
  const admits = (path: string): boolean => !exclude.some(pattern => pathMatchesExclude(path, pattern))
    && !(robotsGroup && isDisallowedByRobots(path, robotsGroup))
  const byPath = new Map<string, SeoSitemapEntry>()

  // Views first, then the blog, then config - the blog only adds a path the
  // views did not have, and config may restate an entry to give it a priority
  // or lastmod of its own.
  for (const entry of views.entries)
    byPath.set(entry.loc, entry)
  for (const entry of await blogEntries(inputs.root)) {
    const path = locPath(entry.loc)
    if (!byPath.has(path) && admits(path))
      byPath.set(path, entry)
  }
  for (const raw of configured) {
    const entry = toEntry(raw)
    const path = locPath(entry.loc)
    if (admits(path))
      byPath.set(path, { ...byPath.get(path), ...entry })
  }

  return [...byPath.values()].sort((a, b) => locPath(a.loc).localeCompare(locPath(b.loc)))
}

/** `/sitemap.xml` for the app. */
export async function buildSitemapXml(inputs: SitemapInputs): Promise<string> {
  const entries = await collectSitemapEntries(inputs)
  // `includeLastmod: false`: a date is only written where one is known. stx
  // would otherwise stamp today on every entry, which tells a crawler every
  // page changed on every fetch - and a lastmod that is always wrong gets
  // ignored for the pages where it is right.
  return `${generateSitemap(entries, { baseUrl: inputs.origin, includeLastmod: false })}\n`
}

/**
 * Paths the generated sitemap would list that a hand-written one does not, for
 * the boot warning. Empty when the hand-written file is complete.
 */
export function pathsMissingFromSitemap(handwrittenXml: string, generated: readonly SeoSitemapEntry[]): string[] {
  const listed = new Set(sitemapLocs(handwrittenXml).map(loc => locPath(loc).replace(/(.)\/+$/, '$1')))
  return generated.map(entry => locPath(entry.loc)).filter(path => !listed.has(path))
}

export interface SiteSeoHandlerOptions {
  root?: string
  seo?: SeoOptions
  /** `app.url` (APP_URL). */
  appUrl?: string
  /**
   * How long a generated file is reused. Production passes minutes - views
   * only change with a deploy, which restarts the process - and development
   * passes 0, so a new page is listed on the next request.
   */
  cacheTtlMs?: number
}

type SeoFile = 'sitemap.xml' | 'robots.txt'

/** Which generated file a request is for, or undefined. */
export function seoFileFor(req: Request): SeoFile | undefined {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return undefined
  const { pathname } = new URL(req.url)
  if (pathname === '/sitemap.xml')
    return 'sitemap.xml'
  if (pathname === '/robots.txt')
    return 'robots.txt'
  return undefined
}

/**
 * The views server's handler: a Response for `/sitemap.xml` and `/robots.txt`,
 * or null for every other request and whenever a hand-written file in
 * `public/` should be served instead (the static handler after `onRequest`
 * then serves it).
 */
export function createSiteSeoHandler(options: SiteSeoHandlerOptions = {}): (req: Request) => Promise<Response | null> {
  const root = options.root ?? process.cwd()
  const ttl = options.cacheTtlMs ?? 0
  const cache = new Map<string, { at: number, body: string }>()

  return async (req: Request): Promise<Response | null> => {
    const file = seoFileFor(req)
    if (!file)
      return null

    const seo = options.seo
    if (file === 'sitemap.xml' && !sitemapOptions(seo))
      return null
    if (file === 'robots.txt' && !robotsOptions(seo))
      return null
    if ((seo?.handwritten ?? 'prefer') === 'prefer' && existsSync(join(root, 'public', file)))
      return null

    const origin = resolveSeoOrigin({ seo, appUrl: options.appUrl, request: req })
    const key = `${file} ${origin}`
    const cached = cache.get(key)
    let body = cached && Date.now() - cached.at < ttl ? cached.body : undefined

    if (body === undefined) {
      body = file === 'sitemap.xml'
        ? await buildSitemapXml({ root, seo, origin })
        : buildRobotsTxt({ seo, origin })
      if (ttl > 0)
        cache.set(key, { at: Date.now(), body })
    }

    return new Response(req.method === 'HEAD' ? null : body, {
      headers: {
        'Content-Type': file === 'sitemap.xml' ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
        'Cache-Control': ttl > 0 ? 'public, max-age=3600' : 'no-cache',
      },
    })
  }
}

/**
 * Warnings for the views server to print at boot: a hand-written file that
 * shadows the generated one and has fallen behind the views.
 *
 * Only the sitemap can be checked for staleness. A hand-written robots.txt is
 * reported only when it names no sitemap at all, since its rules are the
 * app's to choose.
 */
export async function describeSeoAtBoot(options: SiteSeoHandlerOptions = {}): Promise<string[]> {
  const root = options.root ?? process.cwd()
  const seo = options.seo
  if ((seo?.handwritten ?? 'prefer') !== 'prefer')
    return []

  const notes: string[] = []
  const sitemapFile = join(root, 'public/sitemap.xml')
  if (sitemapOptions(seo) && existsSync(sitemapFile) && statSync(sitemapFile).isFile()) {
    const generated = await collectSitemapEntries({ root, seo, origin: '', skipDynamicEntries: true })
    const missing = pathsMissingFromSitemap(readFileSync(sitemapFile, 'utf8'), generated)
    if (missing.length > 0) {
      notes.push(
        `public/sitemap.xml is hand-written and does not list ${missing.length} page${missing.length === 1 ? '' : 's'} `
        + `Stacks would: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', ...' : ''}. `
        + `Delete it to serve the generated /sitemap.xml, or set app.seo.handwritten to 'replace'.`,
      )
    }
  }

  const robotsFile = join(root, 'public/robots.txt')
  if (robotsOptions(seo) && existsSync(robotsFile) && statSync(robotsFile).isFile()) {
    if (!/^\s*sitemap\s*:/im.test(readFileSync(robotsFile, 'utf8')))
      notes.push('public/robots.txt is hand-written and names no Sitemap. Delete it to serve the generated /robots.txt, which does.')
  }

  return notes
}
