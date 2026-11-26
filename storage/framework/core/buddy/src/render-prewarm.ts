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
 * way to know which slugs a `[slug].stx` answers. Each page goes through the
 * new listener's request handler, populating the cache it serves to visitors.
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

/** The render cache capacity, which also bounds the number of pages to warm. */
export const RENDER_CACHE_LIMIT = 512

const sitemapPath = '/sitemap.xml'

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
export function sitemapTargets(xml: string, limit = RENDER_CACHE_LIMIT): PrewarmTarget[] {
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
  /** Identifies this worker's own requests. */
  token?: string
  /** Dispatch directly through the listener that owns the render cache. */
  fetch: (input: string, init?: RequestInit) => Promise<Response>
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
  const token = options.token ?? crypto.randomUUID()
  const originHost = new URL(options.origin).host
  const headers = (host?: string): Record<string, string> => ({
    [PREWARM_HEADER]: token,
    'accept': 'text/html, application/xml',
    'accept-encoding': 'br',
    'host': options.multiHost && host ? host : originHost,
    ...(options.multiHost && host ? { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } : {}),
  })
  let targets: PrewarmTarget[] = []
  try {
    const response = await options.fetch(`${options.origin}${sitemapPath}`, {
      headers: { ...headers(), 'accept-encoding': 'identity' },
      redirect: 'manual',
    })
    if (response.ok)
      targets = sitemapTargets(await response.text())
    else
      await response.body?.cancel()
  }
  catch {
    // A missing sitemap leaves the cache to fill on demand.
  }

  let warmed = 0
  let failed = 0
  let next = 0
  const workers = Array.from({ length: Math.min(Math.max(1, options.concurrency ?? 2), targets.length) }, async () => {
    while (next < targets.length) {
      const target = targets[next++]!
      try {
        const response = await options.fetch(`${options.origin}${target.path}`, { headers: headers(target.host), redirect: 'manual' })
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

interface RenderListener {
  fetch: (request: Request) => Response | Promise<Response>
}

interface PrewarmOnListenOptions extends Omit<PrewarmOptions, 'fetch' | 'token'> {
  waitMs?: number
  fetch?: PrewarmOptions['fetch']
}

/**
 * Find this worker's listener before warming. A deploy can bind two releases
 * to the same port with SO_REUSEPORT. Only our worker can claim the private
 * probe, and dispatch through its listener stays in that process.
 */
export function prewarmOnListen(options: PrewarmOnListenOptions) {
  const token = crypto.randomUUID()
  const isRequest = (request: Request) => request.headers.get(PREWARM_HEADER) === token
  let listener: RenderListener | undefined
  const acceptProbe = (request: Request, server?: RenderListener): Response | undefined => {
    if (!server || request.method !== 'HEAD' || !isRequest(request) || new URL(request.url).pathname !== sitemapPath)
      return undefined
    listener ??= server
    return new Response(null, { status: 204 })
  }

  const result = (async () => {
    const fetcher = options.fetch ?? fetch
    const deadline = performance.now() + (options.waitMs ?? 60_000)
    while (!listener) {
      const remaining = Math.ceil(deadline - performance.now())
      if (remaining <= 0)
        return undefined
      await fetcher(`${options.origin}${sitemapPath}`, {
        method: 'HEAD',
        headers: { [PREWARM_HEADER]: token, connection: 'close' },
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.min(remaining, 750)),
      }).catch(() => {})
      if (!listener)
        await Bun.sleep(100)
    }

    const server = listener
    return prewarmFromSitemap({
      ...options,
      token,
      fetch: async (input, init) => server.fetch(new Request(input, init)),
    })
  })()
  return { acceptProbe, isRequest, result }
}
