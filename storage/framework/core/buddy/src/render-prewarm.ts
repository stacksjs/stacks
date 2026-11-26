/**
 * Render every page in the sitemap once, as soon as the server listens.
 *
 * A render cache shared between visitors (`cache.renderVary` of `url` or
 * `source`) starts empty in every process, and a deploy starts a new process.
 * Until a page has been asked for once, its first visitor waits for the whole
 * render: on stacksjs.com that was 300 to 700 ms against about 190 for a warm
 * page, after every one of the many deploys a day.
 *
 * The sitemap is the list to warm because it is the app's own statement of
 * which pages are public, and it already includes the dynamic ones
 * (`seo.sitemap.entries`): stx's own prewarm walks the view files and has no
 * way to know which slugs a `[slug].stx` answers. Each page is requested over
 * loopback, through the same pipeline a visitor's request takes, so the entry
 * it leaves is the one that visitor is served.
 *
 * For that to hold, a warmed entry and a visitor's entry must have the same
 * key. The key's host comes from {@link renderCacheHost}, which a loopback
 * request and a proxied one agree on: one constant for a single-site app, and
 * the host each sitemap URL names for a multi-site one, which this sends in
 * `X-Forwarded-Host` the way the gateway does.
 *
 * Opportunistic throughout: a page that fails to warm is rendered for its
 * first visitor as before, and nothing here can stop the server serving.
 */

/** Marks a warming request, so first-party analytics does not count it as a visit. */
export const PREWARM_HEADER = 'x-stacks-prewarm'

/** The most pages one boot will warm; a sitemap past this is warmed in part. */
export const PREWARM_LIMIT = 1000

export interface PrewarmTarget {
  /** Path and query, as the server receives them. */
  path: string
  /** The host the sitemap names for it. */
  host: string
}

/**
 * The pages a sitemap lists, as paths and hosts. Entries for another origin's
 * documents are kept as their path: a sitemap names the public address and
 * this server is what answers it behind the gateway.
 */
export function sitemapTargets(xml: string, limit = PREWARM_LIMIT): PrewarmTarget[] {
  const seen = new Set<string>()
  const targets: PrewarmTarget[] = []
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    const raw = match[1]!.replace(/&amp;/g, '&')
    let url: URL
    try {
      url = new URL(raw, 'http://localhost')
    }
    catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      continue
    const target = { path: `${url.pathname}${url.search}`, host: url.host }
    const key = `${target.host}\0${target.path}`
    if (seen.has(key))
      continue
    seen.add(key)
    targets.push(target)
    if (targets.length >= limit)
      break
  }
  return targets
}

/**
 * What a cached render's host is, given whether the app answers more than one.
 *
 * A single-site app returns one constant, so the host plays no part in the
 * key: a page warmed over loopback and the same page asked for through the
 * gateway (which names the upstream in `Host`) share an entry. A multi-site
 * app returns the trusted visitor host from `resolveHost`, so each site keeps
 * its own.
 */
export function renderCacheHost(multiHost: boolean, resolveHost: (request: Request) => string): (request: Request) => string {
  if (!multiHost)
    return () => ''
  return request => resolveHost(request)
}

/** Where to reach this server from inside its own process. */
export function loopbackOrigin(port: number, hostname?: string): string {
  const host = !hostname || hostname === '0.0.0.0' || hostname === '::' ? '127.0.0.1' : hostname
  return `http://${host.includes(':') ? `[${host}]` : host}:${port}`
}

export interface PrewarmOptions {
  /** This server, from inside: see {@link loopbackOrigin}. */
  origin: string
  /** Whether the app answers more than one host (sites or `server.domains`). */
  multiHost: boolean
  /** How many pages render at once. Low on purpose: real visitors come first. */
  concurrency?: number
  /**
   * How long to keep asking for the sitemap while the server is still coming
   * up. The warm-up starts beside the server rather than after it: the call
   * that starts the server does not return while it serves.
   */
  waitMs?: number
  /** Injected for tests. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>
}

export interface PrewarmResult {
  warmed: number
  failed: number
  total: number
  ms: number
}

/** Fetch the sitemap from this server and request each page it lists. */
export async function prewarmFromSitemap(options: PrewarmOptions): Promise<PrewarmResult> {
  const started = performance.now()
  const fetcher = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init))
  const headers = (host?: string): Record<string, string> => ({
    [PREWARM_HEADER]: '1',
    // A multi-site app keys by the visitor host, which reaches it here the
    // way it reaches it from the gateway.
    ...(options.multiHost && host ? { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } : {}),
  })

  const sleep = options.sleep ?? ((ms: number) => Bun.sleep(ms))
  const deadline = started + (options.waitMs ?? 0)
  let targets: PrewarmTarget[] = []
  for (;;) {
    try {
      const response = await fetcher(`${options.origin}/sitemap.xml`, { headers: headers() })
      if (response.ok)
        targets = sitemapTargets(await response.text())
      else
        await response.arrayBuffer().catch(() => {})
      break
    }
    catch {
      // Not listening yet: ask again until the deadline. After it, there is
      // nothing to warm and pages render for their first visitor.
      if (performance.now() >= deadline)
        break
      await sleep(200)
    }
  }

  let warmed = 0
  let failed = 0
  let next = 0
  const workers = Array.from({ length: Math.min(Math.max(1, options.concurrency ?? 2), targets.length) }, async () => {
    while (next < targets.length) {
      const target = targets[next++]!
      try {
        const response = await fetcher(`${options.origin}${target.path}`, { headers: headers(target.host) })
        await response.arrayBuffer()
        if (response.ok)
          warmed++
        else
          failed++
      }
      catch {
        failed++
      }
    }
  })
  await Promise.all(workers)

  return { warmed, failed, total: targets.length, ms: Math.round(performance.now() - started) }
}

/** Whether this request is one of ours, and not a visit. */
export function isPrewarmRequest(request: Request): boolean {
  return request.headers.get(PREWARM_HEADER) === '1'
}
