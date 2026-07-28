import type { CLI } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'

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
;(globalThis as any).requestContext = {
  cookie(name: string): string | null {
    // stx builds a per-request snapshot and refreshes this mirror
    // immediately before each server script runs, so it is the accurate
    // source even when a concurrent request has already moved on. The
    // hook-set global below is the fallback for stx versions that predate
    // it. Preferring the snapshot matters most for the thing cookies are
    // usually carrying: whoever is signed in.
    const snapshot = (globalThis as { __stxServeContext?: { cookies?: Record<string, string> } }).__stxServeContext
    if (snapshot?.cookies && name in snapshot.cookies)
      return snapshot.cookies[name] ?? null

    const cookies = (globalThis as { __stxServeCookies?: Record<string, string> }).__stxServeCookies
    return cookies?.[name] ?? null
  },
  // The full request URL, as the dev server has always returned — production
  // used to return only the query string, so a page that did
  // `new URL(requestContext.url())` worked in development and threw on the
  // box. `search()` is the query string for callers that only want that.
  url(): string {
    const snapshot = (globalThis as { __stxServeContext?: { url?: string, search?: string } }).__stxServeContext
    return snapshot?.url || snapshot?.search || (globalThis as { __stxServeSearch?: string }).__stxServeSearch || ''
  },
  search(): string {
    const snapshot = (globalThis as { __stxServeContext?: { search?: string } }).__stxServeContext
    return snapshot?.search ?? (globalThis as { __stxServeSearch?: string }).__stxServeSearch ?? ''
  },
  // The dev server has always exposed this; production had not, so a page
  // that branched on the locale worked under `buddy dev` and threw
  // "requestContext.locale is not a function" on the box.
  locale(): string {
    const snapshot = (globalThis as { __stxServeContext?: { locale?: string | null } }).__stxServeContext
    return snapshot?.locale ?? 'en'
  },
}

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {}
  const header = req.headers.get('cookie') || ''
  if (!header)
    return out
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (!k)
      continue
    try { out[k] = decodeURIComponent(v) }
    catch { out[k] = v }
  }
  return out
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

export function serve(buddy: CLI): void {
  buddy
    .command('serve', 'Start the production HTTP server (STX views + /api proxy + coming-soon/maintenance gate)')
    .option('-p, --port <port>', 'Port to listen on (defaults to PORT env or 3000)')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action(async (options?: { port?: string | number, verbose?: boolean }) => {
      if (options?.port)
        process.env.PORT = String(options.port)
      process.env.APP_ENV = process.env.APP_ENV || 'production'

      const port = Number(process.env.PORT) || 3000

      const { config, overridesReady } = await import('@stacksjs/config')
      await overridesReady

      const { injectGlobalAutoImports } = await import('@stacksjs/server')
      await injectGlobalAutoImports()

      // Resolve the stx `serve` implementation: local STX worktree first
      // (dev machines), then the project's pantry-vendored copy, then the
      // installed npm package.
      let stxServe: any
      const serveCandidates = [
        join(homedir(), 'Code/Tools/stx/packages/bun-plugin/dist/serve.js'),
        join(process.cwd(), 'pantry/bun-plugin-stx/dist/serve.js'),
      ]
      for (const entry of serveCandidates) {
        try {
          if (existsSync(entry)) {
            ;({ serve: stxServe } = await import(entry))
            break
          }
        }
        catch { /* try next */ }
      }
      if (!stxServe) {
        ;({ serve: stxServe } = await import('bun-plugin-stx/serve'))
      }

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
      const userPartialsPath = resolveUserPartialsPath(process.cwd(), await loadStxPartialsDir())

      // Same-origin API target. Scaffolded client code fetches relative
      // `/api/...` URLs (dashboard stores, CartDrawer, the coming-soon
      // subscribe form), which the dev server reverse-proxies to the API
      // process — production must do the same or every login and form
      // POST 404s on stx-serve (stacksjs/stacks#1950).
      const apiBase = process.env.API_URL
        || `http://127.0.0.1:${Number(process.env.PORT_API) || config.ports?.api || 3008}`

      log.info(`Starting production server on port ${port}...`)

      await stxServe({
        patterns: [userViewsPath, defaultViewsPath],
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
        componentsDir: join(defaultsResources, 'components'),
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
        // Maintenance / coming-soon gate runs first so it intercepts every
        // request. The gate allowlists `/coming-soon`, the secret bypass URL,
        // and static assets, so the holding page renders and visitors with a
        // valid bypass cookie pass through.
        onRequest: async (req: Request) => {
          const { maintenanceGate, isApiBoundRequest, proxyToBackend } = await import('@stacksjs/server')
          const gated = await maintenanceGate(req)
          if (gated)
            return gated

          // Mirror the dev server's API forwarding: `/api/**` and any
          // non-GET/HEAD verb belong to bun-router, never stx-serve.
          // /docs is deliberately NOT proxied — in production it is a
          // server-static site routed by the rpx gateway, not a dev server.
          const url = new URL(req.url)
          if (isApiBoundRequest(req, url.pathname)) {
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
          const method = req.method.toUpperCase()
          if (method !== 'GET' && method !== 'HEAD')
            return

          try {
            const { seedCsrfCookieIfMissing } = await import(resolveCsrfMiddlewarePath())
            return seedCsrfCookieIfMissing(req, response)
          }
          catch (error) {
            // Never fail a page render over a cookie — the CSRF middleware
            // still rejects unsafe requests, so this is fail-closed.
            log.debug(`CSRF cookie seeding skipped: ${(error as Error).message}`)
          }
        },
      })

      log.success(`Production server listening on http://0.0.0.0:${port}`)
    })
}

/**
 * `buddy serve:api` — boot the production API server (bun-router routes).
 *
 * The twin of `buddy serve`: where that serves the STX frontend, this runs the
 * loopback API the frontend proxies `/api` + non-GET requests to. The entry
 * (`@stacksjs/actions/serve/api`) is resolved through the module graph, so it
 * works whether the framework is vendored at `storage/framework/core` OR only
 * installed under `node_modules/@stacksjs/actions`. This keeps deployments from
 * having to hardcode a `storage/framework/core/...` path in their `start`
 * command — `./buddy serve:api` resolves the framework wherever it lives.
 */
export function serveApi(buddy: CLI): void {
  buddy
    .command('serve:api', 'Start the production API server (bun-router routes the frontend proxies /api to)')
    .option('-p, --port <port>', 'Port to listen on (defaults to PORT env or 3008)')
    .action(async (options?: { port?: string | number }) => {
      if (options?.port)
        process.env.PORT = String(options.port)
      process.env.APP_ENV = process.env.APP_ENV || 'production'

      // The api entry is a self-booting server script; importing it starts it.
      await import(resolveApiEntry())
    })
}

/**
 * Locate the self-booting API entry.
 *
 * `import('@stacksjs/actions/serve/api')` assumed the package was installed
 * under that name. A vendored checkout has the file on disk but no such
 * package, so `buddy serve:api` died on "Cannot find module" - on the very
 * checkouts where the source is sitting right there. Production was unaffected
 * because its start command names the vendored path directly, which meant the
 * break only ever showed up locally.
 *
 * Same shape as the defaults/middleware resolvers: on-disk wins, package is
 * the fallback for a node_modules install.
 */
function resolveApiEntry(): string {
  const vendored = join(process.cwd(), 'storage/framework/core/actions/src/serve/api.ts')
  if (existsSync(vendored))
    return vendored

  return '@stacksjs/actions/serve/api'
}

/**
 * Resolve the framework's default resources root (fallback views/layouts/
 * components + preloader). A vendored checkout has them at
 * `storage/framework/defaults/resources` (the source of truth), which wins so
 * a full checkout behaves exactly as before. An app that consumes the framework
 * from node_modules has no vendored copy, so fall back to the published
 * `@stacksjs/defaults` package. Returns the vendored path if neither resolves,
 * letting stx surface a clear missing-directory error.
 */
function resolveDefaultsResources(): string {
  const vendored = 'storage/framework/defaults/resources'
  if (existsSync(vendored))
    return vendored
  try {
    const pkgJson = Bun.resolveSync('@stacksjs/defaults/package.json', process.cwd())
    return join(dirname(pkgJson), 'resources')
  }
  catch {
    return vendored
  }
}

async function resolveVendoredStxModule(): Promise<any | undefined> {
  const candidates = [
    join(homedir(), 'Code/Tools/stx/packages/stx/dist/index.js'),
    join(process.cwd(), 'pantry/@stacksjs/stx/dist/index.js'),
  ]
  for (const entry of candidates) {
    try {
      if (existsSync(entry))
        return await import(entry)
    }
    catch { /* try next */ }
  }
  // Production fallback: the installed npm package (resolved from node_modules).
  // On a deployed server there is no dev worktree or `pantry/` dir — deps are
  // installed via `bun install`, so this is the path that actually resolves.
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

async function resolveSiteI18n(site: any): Promise<any> {
  const resolverPaths = [
    join(homedir(), 'Code/Tools/stx/packages/stx/src/site-builder/i18n.ts'),
    join(homedir(), 'Code/Tools/stx/packages/stx/dist/index.js'),
    join(process.cwd(), 'pantry/@stacksjs/stx/dist/index.js'),
  ]
  for (const resolverPath of resolverPaths) {
    try {
      if (!existsSync(resolverPath))
        continue
      const resolved = await import(resolverPath)
      if (typeof resolved.resolveI18n !== 'function')
        continue
      const i18n = resolved.resolveI18n(site, process.cwd())
      if (i18n)
        return i18n
    }
    catch { /* try next */ }
  }
  // Production fallback: resolve `resolveI18n` from the installed npm package so
  // `{t:…}` tokens render on a deployed server (no dev worktree / pantry dir).
  try {
    const resolved = await import('@stacksjs/stx')
    if (typeof (resolved as any).resolveI18n === 'function') {
      const i18n = (resolved as any).resolveI18n(site, process.cwd())
      if (i18n)
        return i18n
    }
  }
  catch { /* not installed */ }
  return fallbackI18nFromSite(site)
}

async function loadStxSiteConfig(): Promise<{ site?: any, i18n?: any }> {
  const sitePath = join(process.cwd(), 'site.config.ts')
  if (!existsSync(sitePath))
    return {}

  try {
    const mod = await import(sitePath)
    const site = mod.default
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

/**
 * `buddy preview` — serve a finished static build locally.
 *
 * The twin of `buddy serve`, for the other kind of output: where that renders
 * stx pages and proxies an API, this hands over pre-built files exactly as a
 * static host would. It exists so checking a build before shipping it does not
 * require a `preview.ts` in every project's root, hand-rolled per app and
 * quietly drifting from how the host actually behaves.
 *
 * Extensionless paths resolve to `.html`, matching the "pretty URLs" behaviour
 * of Netlify, Vercel and Cloudflare Pages, so a link that works here works
 * there.
 */
export function preview(buddy: CLI): void {
  buddy
    .command('preview [dir]', 'Serve a static build locally, the way a static host would')
    .option('-p, --port <port>', 'Port to listen on', { default: '3001' })
    .example('buddy preview')
    .example('buddy preview dist --port 4000')
    .action(async (dir: string | undefined, options: { port?: string }) => {
      const root = dir || 'dist'
      const port = Number(options?.port) || 3001

      if (!existsSync(root)) {
        log.error(`No \`${root}\` directory to preview. Run \`buddy build\` first, or pass the directory to serve.`)
        process.exit(ExitCode.FatalError)
      }

      Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url)
          let pathname = url.pathname

          // A directory root means its index; an extensionless path means the
          // matching .html, which is what pretty-URL hosting serves.
          if (pathname === '/' || pathname === '')
            pathname = '/index.html'
          else if (!pathname.includes('.'))
            pathname = `${pathname.replace(/\/$/, '')}.html`

          const file = Bun.file(join(root, pathname))
          if (await file.exists())
            return new Response(file)

          // Serve the build's own 404 page when it has one, so the preview
          // shows what a visitor would actually see.
          const notFound = Bun.file(join(root, '404.html'))
          if (await notFound.exists())
            return new Response(notFound, { status: 404 })

          return new Response('Not Found', { status: 404 })
        },
      })

      log.success(`Previewing ./${root} at http://localhost:${port}`)
    })
}
