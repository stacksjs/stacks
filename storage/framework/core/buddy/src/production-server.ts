import type { RequestContextSnapshot } from '@stacksjs/config'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { installRequestContext, parseCookieHeader } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { siteConfigPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { resolveStxSource } from './stx-source'

/**
 * Request-scoped context (query string + parsed cookies) for `<script
 * server>` blocks in `.stx` pages — mirrors `dev/views.ts`'s dev-only
 * setup of the same globals. Without this, `globalThis.requestContext`
 * and `__stxServeSearch` are simply undefined in production: every
 * cookie-aware or query-param-aware page (auth+team resolution on the
 * dashboard, filter params on monitors/incidents, etc.) silently reads
 * nothing and falls back to its unauthenticated/no-filter state, even
 * for a legitimately signed-in request. `dev/views.ts` sets these up
 * for `buddy dev`, but `buddy serve` (this file, the actual Hetzner
 * entrypoint) never did — this was found by an end-to-end login +
 * dashboard smoke test, not by inspection.
 *
 * Plain globals, not `AsyncLocalStorage` — tried that first (mirroring
 * dev/views.ts's own approach) and confirmed via the same e2e test that
 * the store is empty by the time a `<script server>` block reads it:
 * bun-plugin-stx's internal request handling doesn't preserve the async
 * context across whatever it does between `onRequest` returning and the
 * page actually rendering. `__stxServeSearch` already uses a plain
 * global for the exact same reason (and already accepts the same
 * concurrent-request race this shares) — `__stxServeCookies` follows
 * that precedent instead of a mechanism that demonstrably doesn't work
 * in this server.
 */
/**
 * Where this server's snapshot comes from.
 *
 * stx builds a per-request snapshot and refreshes `__stxServeContext`
 * immediately before each server script runs, so it is the accurate source even
 * when a concurrent request has already moved on. The two hook-set globals are
 * the fallback for stx versions that predate it. Preferring the snapshot
 * matters most for the thing cookies usually carry: whoever is signed in.
 *
 * This function is the ONLY thing that differs from the dev server now — the
 * object itself is built by the shared factory, so production can no longer
 * quietly grow a different `url()` or lose `locale()` (#2232).
 */
function productionRequestSnapshot(): RequestContextSnapshot | undefined {
  const snapshot = (globalThis as { __stxServeContext?: RequestContextSnapshot }).__stxServeContext
  const legacyCookies = (globalThis as { __stxServeCookies?: Record<string, string> }).__stxServeCookies
  const legacySearch = (globalThis as { __stxServeSearch?: string }).__stxServeSearch
  // Resolved by our onRequest, not by stx: stx rebuilds __stxServeContext per
  // request and knows nothing about sites, so the site rides a sibling global
  // and merges here.
  const site = (globalThis as { __stxServeSite?: RequestContextSnapshot['site'] }).__stxServeSite

  if (!snapshot && !legacyCookies && legacySearch === undefined)
    return undefined

  return {
    ...snapshot,
    cookies: snapshot?.cookies ?? legacyCookies ?? {},
    // `url` used to fall back to the query string here, which is exactly how
    // `new URL(requestContext.url())` came to work in dev and throw on the box.
    // Kept as a last resort only because an old snapshot has nothing better.
    url: snapshot?.url || snapshot?.search || legacySearch || '',
    search: snapshot?.search ?? legacySearch ?? '',
    site: snapshot?.site ?? site ?? null,
  }
}

installRequestContext(productionRequestSnapshot)

/** Byte-identical to the dev server's copy, so both now share one. */
function parseCookies(req: Request): Record<string, string> {
  return parseCookieHeader(req.headers.get('cookie'))
}

/**
 * Resolve the project's includes directory.
 *
 * A configured `config/stx.ts#partialsDir` wins outright. The convention list
 * below is only a fallback for apps that never set one, and it cannot stand in
 * for the config: the candidates are probed for existence in order, so an app
 * that keeps its includes in `resources/components` but also has an unrelated
 * `resources/partials` directory silently resolved to the wrong one and every
 * `@include` failed with ENOENT at runtime.
 *
 * The configured value is relative to the stx root (`resources`), matching how
 * stx itself reads it, but an app-root-relative path is accepted too so either
 * spelling resolves.
 */
export function resolveUserPartialsPath(cwd = process.cwd(), configuredDir?: string): string | undefined {
  if (configuredDir) {
    const configured = [
      join(cwd, 'resources', configuredDir),
      join(cwd, configuredDir),
    ].find(candidate => existsSync(candidate))

    if (configured)
      return configured
  }

  const candidates = [
    'resources/partials',
    'resources/views/partials',
    'partials',
    'resources/components',
  ]

  // A directory that exists but holds no templates loses to one that does.
  // The scaffold ships two sample partials in `resources/partials/`, so a
  // project keeping its own in `resources/views/partials/` had the wrong
  // directory win purely by being listed first, and every `@include('x.stx')`
  // failed with ENOENT in production while the same include worked in dev.
  const existing = candidates.filter(candidate => existsSync(join(cwd, candidate)))
  if (existing.length === 0)
    return undefined

  const populated = existing.find(candidate => containsTemplates(join(cwd, candidate)))
  return join(cwd, populated ?? existing[0]!)
}

/** True when the directory holds at least one `.stx` file, at any depth. */
function containsTemplates(dir: string): boolean {
  try {
    return [...new Bun.Glob('**/*.stx').scanSync({ cwd: dir, onlyFiles: true })].length > 0
  }
  catch {
    return false
  }
}

/**
 * Read `partialsDir` off the app's stx config. Failure is non-fatal: without
 * it {@link resolveUserPartialsPath} falls back to the conventions.
 */
export async function loadStxPartialsDir(cwd = process.cwd()): Promise<string | undefined> {
  const configPath = join(cwd, 'config/stx.ts')
  if (!existsSync(configPath))
    return undefined

  try {
    const mod = await import(configPath)
    const dir = mod.default?.partialsDir
    return typeof dir === 'string' && dir.length > 0 ? dir : undefined
  }
  catch {
    return undefined
  }
}

/**
 * `buddy serve` — boot the production HTTP server.
 *
 * Renders the project's STX views (resources/views) via stx-serve and applies
 * the maintenance / coming-soon gate so `APP_COMING_SOON` (and `buddy down` /
 * `buddy coming-soon`) hold every request behind the holding page, with the
 * secret-URL + bypass-cookie escape hatch intact. Bun.serve binds 0.0.0.0 by
 * default, so the server is reachable on the host's public interface.
 *
 * Same-origin `/api/**` requests (and any non-GET/HEAD verb) are
 * reverse-proxied to the API process — mirroring the dev views server — so
 * scaffolded `fetch('/api/...')` calls behave identically in production
 * (stacksjs/stacks#1950). The API runs as a separate process
 * (core/actions/src/serve/api.ts), deployed as a second systemd service via
 * the `api` site in config/cloud.ts. Override `API_URL` when the API lives
 * on another host, or `PORT_API` when only the port differs.
 *
 * This is the entry the Hetzner deploy runs as a systemd service
 * (`bun storage/framework/core/buddy/src/cli.ts serve`).
 */
/**
 * Locate the scaffold-defaults CSRF middleware, the same way the API router
 * does: a vendored checkout has it on disk and wins, a node_modules app has no
 * `storage/framework` at all and resolves the published `@stacksjs/defaults`
 * package instead. Without the fallback the page server silently stops seeding
 * CSRF cookies on exactly the deploy shape that can't be debugged by reading
 * the repo.
 */
function resolveCsrfMiddlewarePath(): string {
  const rel = 'app/Middleware/Csrf.ts'
  const vendored = join(process.cwd(), 'storage/framework/defaults', rel)
  if (existsSync(vendored))
    return vendored

  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    return `${pkgJson.slice(0, pkgJson.lastIndexOf('/'))}/${rel}`
  }
  catch {
    return vendored
  }
}

/**
 * Resolve the same-origin `/api/**` proxy target, or `null` when it cannot be
 * known safely.
 *
 * `API_URL` and `PORT_API` are explicit operator intent and always win. The
 * framework-wide `ports.api` default is only trusted *outside* deployed
 * environments: locally one app owns the machine, so `127.0.0.1:3008` really is
 * its own API. On a deployed box that assumption does not hold — ts-cloud runs
 * many SSR sites side by side, each on its own port, and an unconfigured
 * default resolves to whichever tenant happens to own it.
 *
 * Returning `null` makes the caller answer 502. That is the safe failure: the
 * alternative is proxying authenticated requests into another app's process.
 */

export async function startProductionServer(options?: { port?: string | number, verbose?: boolean }): Promise<void> {
  if (options?.port)
    process.env.PORT = String(options.port)
  process.env.APP_ENV = process.env.APP_ENV || 'production'

  const port = Number(process.env.PORT) || 3000

  const { config, overridesReady, resolveViewPatterns } = await import('@stacksjs/config')
  await overridesReady

  const { applyViewSecurityHeaders, describeApiProxyRules, describeRedirectRules, injectGlobalAutoImports, resolveApiBase, resolveApiProxyRules, resolveEmbeddableRules, resolveRedirectRules } = await import('@stacksjs/server')
  // The one copy of this. It used to be duplicated here verbatim — the shared
  // module was extracted precisely so the dev and production servers could not
  // drift, and then this half kept its own.
  const { resolveDefaultsResources } = await import('@stacksjs/actions/dev/defaults-resources')
  const { stxPageAuthMiddleware } = await import('@stacksjs/auth')
  await injectGlobalAutoImports()

      // Resolve the stx `serve` implementation.
      //
      // The installed dependency, unless someone asked for a different copy by
      // name. This used to check a hardcoded STX worktree in `~/Code` and the
      // project's `pantry/` directory FIRST, and take either one silently.
      //
      // That made an untracked directory outrank the declared dependency in
      // the production server. It is how stacksjs/stacks#2369 happened: an app
      // on `bun-plugin-stx@0.2.231` served every page through a
      // `pantry/bun-plugin-stx@0.2.76` copy left over from July, which predates
      // the page-response read-back (added in 0.2.219). So `notFound()` and
      // `definePageMeta({ status })` recorded a 404 that nothing read, and a
      // deleted status page answered 200 with its own not-found body - to a
      // crawler, a cache, and a customer's uptime monitor.
      //
      // Nothing about that was visible: no log said which copy had loaded.
      // A stale checkout is now something you opt into, by path, and the
      // server says what it loaded either way.
      let stxServe: any
      const serveSource = resolveStxSource({ value: process.env.BUN_PLUGIN_STX_SRC })
      if (serveSource.kind === 'missing') {
        // `log.exit`, not `log.error` + `process.exit`: the error write is
        // async and `process.exit` does not wait for it, so the one line
        // explaining the refusal is dropped on the way out.
        await log.exit(
          `BUN_PLUGIN_STX_SRC points at ${serveSource.path}, which does not exist. `
          + `Unset it to use the installed bun-plugin-stx.`,
          ExitCode.FatalError,
        )
      }
      if (serveSource.kind === 'override') {
        ;({ serve: stxServe } = await import(serveSource.path))
        log.warn(`Serving views through ${serveSource.path} instead of the installed bun-plugin-stx.`)
      }
      else {
        ;({ serve: stxServe } = await import('bun-plugin-stx/serve'))
      }
      log.debug(`stx serve implementation: ${serveSource.kind === 'override' ? serveSource.path : 'bun-plugin-stx/serve'}`)

      // Pre-resolve the vendored stx module + site/i18n config so `{t:…}`
      // translation tokens and the lang picker render in production exactly
      // like they do under `buddy dev`.
      const stxModule = await resolveVendoredStxModule()
      const { site: siteConfig, i18n: i18nConfig } = await loadStxSiteConfig()

      const userViewsPath = 'resources/views'
      // Framework fallback resources (default views/layouts/components). A
      // vendored checkout has them at storage/framework/defaults; an app that
      // consumes the framework from node_modules gets them from the published
      // @stacksjs/defaults package. Vendored wins so behaviour is unchanged.
      const defaultsResources = resolveDefaultsResources()
      const defaultViewsPath = join(defaultsResources, 'views')
      const userLayoutsPath = existsSync('resources/views/layouts') ? 'resources/views/layouts' : 'resources/layouts'
      // Same override-by-name rule as layouts: the app's directory wins, the
      // framework defaults sit behind it. Both scaffold locations are checked,
      // matching how userLayoutsPath picks its own.
      const userComponentsPath = existsSync('resources/views/components')
        ? 'resources/views/components'
        : 'resources/components'
      const userPartialsPath = resolveUserPartialsPath(process.cwd(), await loadStxPartialsDir())

      // Same-origin API target. Scaffolded client code fetches relative
      // `/api/...` URLs (dashboard stores, CartDrawer, the coming-soon
      // subscribe form), which the dev server reverse-proxies to the API
      // process — production must do the same or every login and form
      // POST 404s on stx-serve (stacksjs/stacks#1950).
      //
      // The target must be resolved *explicitly* in a deployed environment.
      // `127.0.0.1:<default>` is not "my API" on a shared box — it is whichever
      // tenant bound that port first. Several SSR sites legitimately share one
      // instance (see SiteConfig.port), so falling back to the framework-wide
      // default silently forwards this app's `/api/**` traffic — session
      // cookies, login POSTs, form bodies — into a *different* tenant's
      // process. Fail closed instead: a 502 with an actionable log beats
      // misdelivering a visitor's credentials to a stranger.
      const apiBase = resolveApiBase(config.ports?.api)

      // Which of the framework's default views this app serves (#2237). Must
      // resolve identically to `dev/views.ts` — hence the shared helper rather
      // than a second copy of the rule — or an app opts a demo route out in dev
      // and still ships it.
      const viewPatterns = resolveViewPatterns(
        userViewsPath,
        defaultViewsPath,
        (config as any)?.ui?.defaultViews,
      )

      for (const name of viewPatterns.missing)
        log.warn(`ui.defaultViews lists "${name}", which does not exist under ${defaultViewsPath} - ignoring.`)

      // Same rules the dev server uses, so a route reachable under `buddy dev`
      // is reachable under `buddy serve` (stacksjs/stacks#2230). Resolved here
      // rather than per request: config loads asynchronously, and the answer
      // must not depend on how far boot had progressed.
      const apiProxyRules = resolveApiProxyRules(config.server?.proxy)
      if (apiProxyRules.paths.length > 0 || apiProxyRules.prefixes.length > 1)
        log.info(`API proxy: ${describeApiProxyRules(apiProxyRules)}`)

      const redirectRules = resolveRedirectRules(config.server?.redirects)
      if (redirectRules.size > 0)
        log.info(`Redirects: ${describeRedirectRules(redirectRules)}`)

      // Resolved at boot for the same reason (stacksjs/stacks#2325).
      const embeddableRules = resolveEmbeddableRules(config.server?.security?.embeddable)
      if (embeddableRules.paths.length > 0 || embeddableRules.prefixes.length > 0)
        log.info(`Frameable by other origins: ${[...embeddableRules.paths, ...embeddableRules.prefixes].join(' ')}`)

      log.info(`Starting production server on port ${port}...`)

      await stxServe({
        patterns: viewPatterns.patterns,
        port,
        // Never silently drift off the configured port: the reverse
        // proxy/gateway routes to exactly this port, so stx's fallback bind
        // on port+1 would serve nothing. Fail loudly instead (systemd
        // restarts / the deploy health gate catches it).
        autoIncrementPort: false,
        // SO_REUSEPORT (stx >= 0.2.81): lets the next release's instance
        // bind the same port while this one still serves — the overlap
        // ts-cloud's zero-downtime cutover needs. Enabled for every *deployed*
        // environment (production, staging, development), since each runs via
        // the same templated systemd unit + health-gate handoff where the new
        // release must bind the port before the old one is stopped. Off for
        // local `serve` runs, where two servers fighting over one port should
        // fail loudly. Ignored harmlessly by older stx versions.
        reusePort: ['production', 'staging', 'development']
          .includes((process.env.APP_ENV || '').toLowerCase()),
        // The APP's components, with the framework's behind them.
        //
        // This was `join(defaultsResources, 'components')` — the framework
        // defaults passed as THE components directory, with the app's own
        // never consulted. An app that had written its own NativeAppShell.stx
        // still rendered the framework's copy, and the symptom pointed
        // nowhere near the cause: the framework file's relative includes
        // resolved against the defaults tree, so the page came back with
        // ENOENT banners naming a directory the author had never written a
        // path to, where its header, nav, and footer should have been.
        //
        // Layouts three lines down always had this right. Components did not,
        // because stx had no component-side fallback until 0.2.230.
        componentsDir: userComponentsPath,
        fallbackComponentsDir: join(defaultsResources, 'components'),
        layoutsDir: userLayoutsPath,
        // Omit the override only when the app has no Stacks include directory,
        // allowing bun-plugin-stx to fall back to its own project config.
        ...(userPartialsPath && { partialsDir: userPartialsPath }),
        fallbackLayoutsDir: join(defaultsResources, 'layouts'),
        fallbackPartialsDir: defaultViewsPath,
        quiet: options?.verbose !== true,
        ...(stxModule && { stxModule }),
        ...(i18nConfig && { i18n: i18nConfig }),
        ...(siteConfig?.url && { site: siteConfig }),
        // Override stx-serve's built-in `auth`/`guest` gate, which only
        // checks that the cookie EXISTS — `document.cookie = 'auth-token=x'`
        // satisfied it (stacksjs/stacks#2274). These validate the token like
        // a bearer. Mirrors the dev views server so a page gated under
        // `buddy dev` is gated identically under `buddy serve`.
        middleware: stxPageAuthMiddleware(),
        // Maintenance / coming-soon gate runs first so it intercepts every
        // request. The gate allowlists `/coming-soon`, the secret bypass URL,
        // and static assets, so the holding page renders and visitors with a
        // valid bypass cookie pass through.
        onRequest: async (req: Request) => {
          const { maintenanceGate, isApiBoundRequest: isApiBound, proxyToBackend, resolveRedirect } = await import('@stacksjs/server')
          const gated = await maintenanceGate(req)
          if (gated)
            return gated

          const url = new URL(req.url)

          // Declared redirects from `config/server.ts`. After the maintenance
          // gate (a site being down outranks a URL having moved) and before
          // everything else, so a legacy path never needs a stub page to
          // bounce off. Identical placement to the dev views server.
          const redirected = resolveRedirect(url, redirectRules)
          if (redirected)
            return redirected

          // Mirror the dev server's API forwarding: `/api/**`, any mutating
          // verb, and anything `config/server.ts` adds under `proxy` belong to
          // bun-router, never stx-serve.
          // /docs is deliberately NOT proxied — in production it is a
          // server-static site routed by the rpx gateway, not a dev server.
          if (isApiBound(req, url.pathname, apiProxyRules)) {
            if (!apiBase) {
              log.error(
                `No API target configured for ${url.pathname}. This app shares its host with other `
                + `deployments, so there is no safe default port to guess - refusing to proxy. Set `
                + `PORT_API (or API_URL) for this site, and deploy an \`api\` site on its own port.`,
              )
              return new Response('Bad Gateway', { status: 502 })
            }

            try {
              return await proxyToBackend(req, apiBase)
            }
            catch (error) {
              log.error(`API proxy to ${apiBase} failed: ${(error as Error).message}`)
              return new Response('Bad Gateway', { status: 502 })
            }
          }

          // stx-native blog: /blog and /blog/<slug> render as stx pages, but
          // the feed + sitemap are served from content/blog markdown here (no
          // BunPress). HTML paths return null and fall through to stx.
          if (existsSync(join(process.cwd(), 'resources/views/blog.stx'))) {
            const { renderBlogFeed } = await import('@stacksjs/actions/blog')
            const feed = await renderBlogFeed(req)
            if (feed)
              return feed
          }

          // Stash cookies + query string so server-script blocks rendering
          // this request can pull them via globalThis.requestContext /
          // __stxServeSearch — see the doc comment above this function.
          ;(globalThis as { __stxServeSearch?: string }).__stxServeSearch = url.search
          ;(globalThis as { __stxServeCookies?: Record<string, string> }).__stxServeCookies = parseCookies(req)

          // First-party pageviews: fire-and-forget, gated on config; a
          // failed insert loses one statistic and never a render. Mirrors
          // the dev views server.
          if ((config as { analytics?: { capturePageviews?: boolean } }).analytics?.capturePageviews) {
            void import('@stacksjs/analytics').then(({ recordPageview }) => recordPageview(req)).catch(() => {})
          }

          // Multi-site: resolve the Host into a site once per request. Behind
          // rpx the original host arrives on X-Forwarded-Host. Mirrors the dev
          // views server; gated on config so single-site apps skip the import.
          if ((config as { sites?: { enabled?: boolean } }).sites?.enabled) {
            const sites = await import('@stacksjs/sites')
            const resolved = await sites.resolveSiteByHost(sites.requestHost(req.headers, sites.sitesOptions()))
            sites.setCurrentSite(resolved)
            ;(globalThis as { __stxServeSite?: RequestContextSnapshot['site'] }).__stxServeSite = sites.toSiteSnapshot(resolved)
          }
          else {
            ;(globalThis as { __stxServeSite?: RequestContextSnapshot['site'] }).__stxServeSite = null
          }

          return undefined
        },

        // Seed the CSRF double-submit cookie on safe-method page responses.
        //
        // The API router already seeds it, but pages are rendered HERE, and a
        // browser only ever loads a page first. So a visitor who opened
        // /login and submitted the form had no cookie to echo, and the
        // default-on CSRF middleware rejected the POST with 403 — sign-in was
        // impossible for anyone whose first request wasn't an API GET. The
        // token has to ride the HTML that carries the form.
        onResponse: async (req: Request, response: Response) => {
          // ABOVE the verb guard on purpose (stacksjs/stacks#2325). Everything
          // below this point is GET/HEAD-only page work, but the security
          // headers belong on every response this server makes - a 405 or an
          // error page is still a document a browser will render.
          const secured = applyViewSecurityHeaders(req, response, embeddableRules)

          const method = req.method.toUpperCase()
          if (method !== 'GET' && method !== 'HEAD')
            return secured

          // A 404 from stx-serve gives the CMS page tree its chance — coded
          // views win by construction because they never 404. Mirrors the dev
          // views server; failure degrades to the original 404, never a 500.
          //
          // `baseline` is what to return when nothing further changes: the
          // rebuilt response when the headers could not be set in place, and
          // otherwise the original, which already carries them.
          const baseline = secured ?? response
          let current = baseline
          if (current.status === 404 && (config as { sites?: { enabled?: boolean } }).sites?.enabled) {
            try {
              const { cmsNotFoundFallback } = await import('@stacksjs/cms')
              const cmsResponse = await cmsNotFoundFallback(req)
              if (cmsResponse)
                current = cmsResponse
            }
            catch (error) {
              log.debug(`CMS fallback skipped: ${(error as Error).message}`)
            }
          }

          try {
            const { seedCsrfCookieIfMissing } = await import(resolveCsrfMiddlewarePath())
            return (await seedCsrfCookieIfMissing(req, current)) ?? (current === baseline ? secured : current)
          }
          catch (error) {
            // Never fail a page render over a cookie — the CSRF middleware
            // still rejects unsafe requests, so this is fail-closed.
            log.debug(`CSRF cookie seeding skipped: ${(error as Error).message}`)
            return current === baseline ? secured : current
          }
        },
      })

  log.success(`Production server listening on http://0.0.0.0:${port}`)
}

/**
 * The stx module used to render `{t:…}` tokens and the lang picker.
 *
 * The installed dependency, unless `STACKS_STX_SRC` names another copy. Same
 * reasoning as the `serve` resolution above: a hardcoded `~/Code` worktree and
 * the project's `pantry/` used to win silently over the declared dependency,
 * which meant a directory nobody tracks decided what the production server
 * ran. See stacksjs/stacks#2369 for what that cost.
 */
async function resolveVendoredStxModule(): Promise<any | undefined> {
  const source = resolveStxSource({ value: process.env.STACKS_STX_SRC })
  if (source.kind === 'missing') {
    // See the BUN_PLUGIN_STX_SRC branch above: `log.error` then
    // `process.exit` prints nothing, because the write never lands.
    await log.exit(
      `STACKS_STX_SRC points at ${source.path}, which does not exist. Unset it to use the installed @stacksjs/stx.`,
      ExitCode.FatalError,
    )
  }
  if (source.kind === 'override') {
    log.warn(`Rendering through ${source.path} instead of the installed @stacksjs/stx.`)
    return await import(source.path)
  }

  try {
    return await import('@stacksjs/stx')
  }
  catch { /* not installed */ }
  return undefined
}

function fallbackI18nFromSite(site: any) {
  const locales: string[] = site.i18n.locales
  const defaultLocale = site.i18n.defaultLocale ?? locales[0]
  return {
    locales,
    defaultLocale,
    labels: site.i18n.labels ?? Object.fromEntries(locales.map(c => [c, c.toUpperCase()])),
    translations: {} as Record<string, Record<string, string>>,
    pickerSelector: site.i18n.pickerSelector ?? '#lang-picker',
  }
}

/**
 * `resolveI18n` from whichever stx copy this server renders through, so
 * `{t:…}` tokens and the lang picker behave the same as the pages around them.
 *
 * Shares `resolveVendoredStxModule`'s resolution rather than repeating a
 * candidate list: two lists that were supposed to agree is how one of them
 * ends up pointing somewhere the other does not.
 */
async function resolveSiteI18n(site: any): Promise<any> {
  try {
    const resolved = await resolveVendoredStxModule()
    if (typeof (resolved as any)?.resolveI18n === 'function') {
      const i18n = (resolved as any).resolveI18n(site, process.cwd())
      if (i18n)
        return i18n
    }
  }
  catch { /* fall back to the site config below */ }
  return fallbackI18nFromSite(site)
}

async function loadStxSiteConfig(): Promise<{ site?: any, i18n?: any }> {
  const sitePath = siteConfigPath()
  if (!existsSync(sitePath))
    return {}

  try {
    const mod = await import(sitePath)
    const site = mod.default ?? mod.site ?? mod.config
    if (!site)
      return {}
    if (!site.i18n)
      return { site }
    const i18n = await resolveSiteI18n(site)
    return { site, i18n }
  }
  catch { /* no site config */ }

  return {}
}
