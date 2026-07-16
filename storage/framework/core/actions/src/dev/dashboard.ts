import process from 'node:process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { bold, cyan, dim, green, red } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'
import { buildDashboardUrl, buildManifest, discoverModels, findAvailablePort, waitForServer } from './dashboard-utils'

// buddyOptions serializes `verbose: false` as `--verbose false`, so
// process.argv.includes('--verbose') would always match. Check the value too.
const verboseIdx = process.argv.indexOf('--verbose')
const verbose = verboseIdx !== -1 && process.argv[verboseIdx + 1] !== 'false'
const startTime = Bun.nanoseconds()

// Buffer all dependency console output (STX serve, Crosswind, bun-router)
// so we can display it cleanly after our banner (verbose) or discard it (normal).
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const bufferedLogs: string[] = []

console.log = (...args: unknown[]) => {
  bufferedLogs.push(args.map(String).join(' '))
}
console.warn = (...args: unknown[]) => {
  bufferedLogs.push(args.map(String).join(' '))
}

// Dashboard pages live directly under views/dashboard/. The earlier `pages/`
// subdir layout was removed in #1838 — see the per-feature dirs (analytics/,
// commerce/, content/, …) plus index.stx for the canonical structure.
const dashboardPath = storagePath('framework/defaults/views/dashboard')
const userDashboardPath = projectPath('resources/views/dashboard')
const preferredPort = Number(process.env.PORT_ADMIN) || 3002
// eslint-disable-next-line ts/no-top-level-await
const dashboardPort = await findAvailablePort(preferredPort)

// Determine if we have a custom domain (like stacks.localhost)
const appUrl = process.env.APP_URL || ''
const hasCustomDomain = appUrl !== '' && appUrl !== 'localhost' && !appUrl.includes('localhost:')
const domain = hasCustomDomain ? appUrl.replace(/^https?:\/\//, '') : null
const dashboardDomain = domain ? `dashboard.${domain}` : null
const sslBasePath = `${process.env.HOME}/.stacks/ssl`

function restoreConsole(): void {
  console.log = originalConsoleLog
  // Filter STX DOM API violation warnings — server-side only, code runs fine in browser
  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(' ')
    if (msg.includes('[STX] DOM API violation') || msg.includes('unsafe expression'))
      return
    originalConsoleWarn(...args)
  }
}

async function startStxServer(): Promise<void> {
  // Preload @stacksjs/orm before the STX server starts. The orm package's
  // top-level evaluation walks every framework default model file, exports
  // each class, and assigns it onto globalThis so dashboard `<script server>`
  // blocks can reference models as bare names (`await Order.all()`) without
  // an explicit import. Loading it here means the first page render no
  // longer pays the cold-start cost of resolving 50+ model files.
  try {
    await import('@stacksjs/orm')
  }
  catch (err) {
    if (verbose) console.warn('[dashboard] orm preload failed:', (err as Error)?.message || err)
  }

  // Preload every helper module under `storage/framework/defaults/resources/functions/`
  // and the user's `resources/functions/` and `app/` trees, then hoist each
  // named export onto globalThis. This lets `<script server>` blocks call
  // `safeAll(Order)`, `formatRelative(date)`, `listPackages()`, etc. without
  // importing — same model-as-globals ergonomics as the orm preload.
  try {
    const { hoistDashboardGlobals } = await import('./dashboard-globals')
    await hoistDashboardGlobals({ verbose })
  }
  catch (err) {
    if (verbose) console.warn('[dashboard] globals preload failed:', (err as Error)?.message || err)
  }

  let serve: typeof import('bun-plugin-stx/serve').serve
  try {
    const mod = await import('bun-plugin-stx/serve')
    serve = mod.serve
  }
  catch {
    const mod = await import(projectPath('pantry/bun-plugin-stx/dist/serve.js'))
    serve = mod.serve
  }

  // Pre-resolve stx from pantry. Bun's bare-specifier resolver finds the
  // stale `node_modules/@stacksjs/stx` first when serve.js does
  // `import('@stacksjs/stx')`, which breaks @extends/layoutsDir. Pass the
  // pantry copy via the `stxModule` option (see ServeOptions) so the
  // dashboard's layout resolution stays consistent with the other dev
  // servers.
  let stxModule: any
  // Local stx checkout first (same convention as the Craft SDK resolution
  // below) so framework development picks up engine fixes before a release;
  // STX_SRC overrides the default location.
  try {
    const localStx = process.env.STX_SRC
      || `${process.env.HOME}/Code/Tools/stx/packages/stx/src/index.ts`
    if (await Bun.file(localStx).exists())
      stxModule = await import(localStx)
  }
  catch { /* fall through */ }
  if (stxModule && verbose)
    console.log('[Dashboard] Using local stx checkout')
  if (!stxModule) {
    try {
      const vendoredStx = projectPath('pantry/@stacksjs/stx/dist/index.js')
      if (await Bun.file(vendoredStx).exists())
        stxModule = await import(vendoredStx)
    }
    catch { /* fall through */ }
  }

  // Mount the config-editor API routes. The settings UI talks to these
  // to list config files, read their resolved values, and write edits
  // back to disk. They run in the dashboard server's process so they
  // share the same fs cwd and don't need a second port to be open.
  const { listConfigFiles, readConfig, updateConfigKey } = await import(
    storagePath('framework/defaults/resources/functions/dashboard/config-io.ts')
  )
  // Map a runtime bare specifier (used by client-side `await import('@stacksjs/...')`
  // in dashboard pages) to the on-disk dist file we serve. The matching import
  // map is injected by the dashboard layout — see
  // `storage/framework/defaults/views/dashboard/layouts/default.stx`
  // (`<script type="importmap">` near the top). The dashboard's own
  // `stx.config.ts` would be the natural home for this, but `bun-plugin-stx`'s
  // `serve()` autoloads config from `process.cwd()` (the project root), not
  // the layouts dir, so the layout-level injection is what actually reaches
  // the browser.
  const depRoutes: Record<string, string> = {
    '/__deps/charts.js': storagePath('framework/core/charts/dist/index.js'),
  }
  const configRoutes: Record<string, (req: Request) => Response | Promise<Response>> = {
    ...Object.fromEntries(
      Object.entries(depRoutes).map(([url, file]) => [
        url,
        async () => {
          const f = Bun.file(file)
          if (!(await f.exists())) {
            return new Response(
              `// dependency dist missing: ${file}\n// rebuild with: cd ${file.replace(/\/dist\/[^/]+$/, '')} && bun build.ts`,
              { status: 500, headers: { 'content-type': 'text/javascript; charset=utf-8' } },
            )
          }
          return new Response(f, {
            headers: {
              'content-type': 'text/javascript; charset=utf-8',
              'cache-control': 'no-cache',
            },
          })
        },
      ]),
    ),
    '/api/config/list': async () => {
      try {
        return Response.json({ ok: true, files: listConfigFiles() })
      }
      catch (e) {
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
    '/api/config/read': async (req: Request) => {
      try {
        const url = new URL(req.url)
        const name = url.searchParams.get('name') || ''
        if (!/^[\w-]+$/.test(name))
          return Response.json({ ok: false, error: 'Invalid config name' }, { status: 400 })
        const result = await readConfig(name)
        if (!result)
          return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
        // Strip the raw source from the response — the UI only needs
        // values + field metadata. Source ships with the read for the
        // monaco viewer (see /api/config/source).
        return Response.json({ ok: true, name, fields: result.fields, values: result.values })
      }
      catch (e) {
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
    '/api/config/source': async (req: Request) => {
      try {
        const url = new URL(req.url)
        const name = url.searchParams.get('name') || ''
        if (!/^[\w-]+$/.test(name))
          return Response.json({ ok: false, error: 'Invalid config name' }, { status: 400 })
        const result = await readConfig(name)
        if (!result)
          return Response.json({ ok: false, error: 'Not found' }, { status: 404 })
        return new Response(result.source, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      }
      catch (e) {
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
    '/api/config/update': async (req: Request) => {
      if (req.method !== 'POST')
        return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 })
      try {
        const body = (await req.json()) as { file?: string, key?: string, value?: any, updates?: Array<{ path?: string, key?: string, value?: any }> }
        // Accept two shapes:
        //   1) { file, key, value }                 — single key edit
        //   2) { file, updates: [{ path|key, value }] } — batch (used by services.stx)
        const file = body.file?.replace(/\.ts$/, '')
        if (!file || !/^[\w-]+$/.test(file))
          return Response.json({ ok: false, error: 'Invalid file' }, { status: 400 })

        const updates: Array<{ key: string, value: any }> = []
        if (Array.isArray(body.updates)) {
          for (const u of body.updates) {
            const k = u.key ?? u.path
            if (typeof k === 'string') updates.push({ key: k, value: u.value })
          }
        }
        else if (body.key) {
          updates.push({ key: body.key, value: body.value })
        }
        if (updates.length === 0)
          return Response.json({ ok: false, error: 'No updates supplied' }, { status: 400 })

        const results: Array<{ key: string, ok: boolean, error?: string, newValue?: any }> = []
        for (const u of updates) {
          try {
            const r = await updateConfigKey(file, u.key, coerce(u.value))
            results.push({ key: u.key, ok: true, newValue: r.newValue })
          }
          catch (err) {
            results.push({ key: u.key, ok: false, error: (err as Error)?.message })
          }
        }
        const allOk = results.every(r => r.ok)
        // Always return HTTP 200 so the response is well-formed; the
        // caller checks `body.ok` to know whether anything failed.
        // Returning 207 here triggers a Bun internal RangeError under
        // the bun-router fallback path used by the dashboard server.
        return Response.json({ ok: allOk, file, results })
      }
      catch (e) {
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
  }

  // Coerce string-encoded form values back to the shape we want to
  // serialize. The HTML form posts everything as strings, but the writer
  // needs real booleans / numbers so the .ts file gets `true` instead
  // of `'true'`.
  function coerce(v: any): string | number | boolean {
    if (typeof v === 'boolean' || typeof v === 'number') return v
    if (v === 'true') return true
    if (v === 'false') return false
    if (v === '' || v == null) return ''
    if (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)
    return String(v)
  }

  // serve() starts a long-lived server — do NOT await it.
  // It resolves only when the server stops, which is never during dev.
  //
  // `auth: false` disables stx-bun-plugin's bundled auth middleware so
  // pages declaring `definePageMeta({ middleware: ['auth'] })` aren't
  // gated against an `auth-token` cookie that doesn't exist in the
  // local dashboard. The dashboard runs entirely on the developer's
  // machine and is not meant to be authenticated; without this flag
  // every page silently 302'd to /login.
  // Load Stacks router routes (user + framework via bootstrap.ts) so that
  // routes registered with `route.get(...)` / `route.register(...)` are
  // reachable from the dashboard server. Without this the dashboard runs
  // entirely on bun-plugin-stx's flat routes map and any /api/dashboard/*
  // endpoint declared via the framework router would 404 in dev — even
  // though it works fine in production (server/start.ts also calls
  // loadRoutes). We scope onRequest delegation tightly below.
  let stacksRoute: typeof import('@stacksjs/router').route | null = null
  try {
    const router = await import('@stacksjs/router')
    const routeRegistry = (await import(projectPath('app/Routes.ts'))).default
    await router.loadRoutes(routeRegistry)
    stacksRoute = router.route
  }
  catch (err) {
    // Don't crash the dashboard if route loading fails — dev devs still
    // need page rendering even if /api/* endpoints aren't reachable.
    //
    // But say so loudly. Without stacksRoute the `onRequest` delegation
    // below is undefined, so every /api/dashboard/* endpoint 404s while
    // the pages still render: the dashboard looks fine and shows no data,
    // with nothing on screen to explain why. This was verbose-only when a
    // broken @stacksjs/bun-router build made the import throw, and the
    // dead API surface got misread as a dashboard data bug for far too
    // long. console.error on purpose: console.log/warn are buffered and
    // discarded above in non-verbose runs.
    const detail = (err as Error)?.message || String(err)
    console.error(`\n${red(bold('  Dashboard API disabled: Stacks router init failed.'))}`)
    console.error(`  ${detail}`)
    console.error(dim('  Every /api/dashboard/* endpoint will return 404; pages render but show no data.'))
    console.error(dim('  Re-run with --verbose for the full stack trace.\n'))
    if (verbose) console.error(err)
  }

  const serverPromise = serve({
    patterns: [userDashboardPath, dashboardPath],
    port: dashboardPort,
    componentsDir: storagePath('framework/defaults/resources/components/Dashboard'),
    layoutsDir: dashboardPath,
    partialsDir: dashboardPath,
    quiet: true,
    routes: configRoutes,
    // onRequest fires BEFORE the `routes` map and BEFORE STX page
    // resolution. Returning a Response short-circuits the rest of the
    // pipeline; returning null/undefined falls through.
    //
    // Delegation policy (dev dashboard):
    //   1. `/api/config/*` and `/__deps/*` stay with `configRoutes` below
    //      — those are dev-only static fixtures. Skip the Stacks router.
    //   2. `/api/*` always delegates to the Stacks router. These are JSON
    //      endpoints — bun-router's 404 (no route) and 405 (method
    //      mismatch) are the right responses, never an HTML page.
    //   3. For everything else, GET goes to STX (page rendering wins,
    //      so `/health`, `/login`, `/content/authors`, etc. render their
    //      `.stx` view) and non-GET goes to bun-router (so POST `/login`
    //      reaches the action). Without rule (3a), root-level routes that
    //      collide with a page — e.g. `route.health()` registering a
    //      `/health` LB-probe at root — would intercept the page.
    onRequest: stacksRoute
      ? async (req: Request) => {
          const url = new URL(req.url)
          const pathname = url.pathname

          if (pathname.startsWith('/api/config/') || pathname.startsWith('/__deps/'))
            return null

          if (pathname.startsWith('/api/'))
            return stacksRoute!.handleRequest(req)

          if (req.method.toUpperCase() !== 'GET')
            return stacksRoute!.handleRequest(req)

          return null
        }
      : undefined,
    auth: false,
    ...(stxModule && { stxModule }),
  } as any)

  serverPromise.catch((err: Error) => {
    restoreConsole()
    console.error(`\n  Failed to start dashboard server: ${err?.message || err}\n`)
    process.exit(1)
  })
}

async function startReverseProxy(): Promise<boolean> {
  if (!dashboardDomain) return false

  // When running as part of `buddy dev`, the main dev server handles the
  // reverse proxy for all subdomains. Starting a second proxy here would
  // race for port 443 and break routing for other subdomains (docs, api, etc.).
  if (process.env.STACKS_PROXY_MANAGED) return false

  try {
    const { startProxies } = await import('@stacksjs/rpx')

    await startProxies({
      proxies: [
        { from: `localhost:${dashboardPort}`, to: dashboardDomain, cleanUrls: false },
      ],
      https: {
        basePath: sslBasePath,
        validityDays: 825,
      },
      regenerateUntrustedCerts: false,
      verbose,
    })

    return true
  }
  catch (error) {
    if (verbose) originalConsoleLog(`  ${dim(`Proxy: ${error}`)}`)
    return false
  }
}

// Config API server for dashboard editing
const configApiPort = dashboardPort + 1
function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...extraHeaders,
    },
  })
}

function startConfigApi(): void {
  Bun.serve({
    port: configApiPort,
    fetch: async (req: Request) => {
      if (req.method === 'OPTIONS')
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        })

      const url = new URL(req.url)

      if (url.pathname === '/api/config/update' && req.method === 'POST') {
        try {
          const { file, updates } = await req.json() as {
            file: string
            updates: Array<{ path: string, value: string }>
          }

          if (!file || file.includes('..') || !file.match(/^[\w.-]+\.ts$/))
            return jsonResponse({ error: 'Invalid file name' }, 400)

          const filePath = projectPath(`config/${file}`)
          let content = readFileSync(filePath, 'utf-8')

          for (const { path: keyPath, value } of updates) {
            const lastKey = keyPath.split('.').pop()!
            const escapedKey = lastKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const pattern = new RegExp(
              `(${escapedKey}\\s*:\\s*)(?:'[^']*'|"[^"]*"|\\d+(?:\\.\\d+)?|true|false)`,
            )
            if (pattern.test(content)) {
              const isNum = /^\d+(?:\.\d+)?$/.test(value)
              const isBool = value === 'true' || value === 'false'
              const sanitizedValue = value.replace(/'/g, '\\\'').replace(/\$/g, '$$$$')
              const replacement = isNum || isBool ? value : `'${sanitizedValue}'`
              content = content.replace(pattern, `$1${replacement}`)
            }
          }

          writeFileSync(filePath, content, 'utf-8')
          return jsonResponse({ success: true })
        }
        catch (err: any) {
          return jsonResponse({ error: err.message }, 500)
        }
      }

      return jsonResponse({ error: 'Not found' }, 404)
    },
  })
}

startConfigApi()

// Phase 1: Start STX server and discover models in parallel
// eslint-disable-next-line ts/no-top-level-await
const [, discoveredModels] = await Promise.all([
  startStxServer(),
  discoverModels(projectPath('app/Models'), storagePath('framework/defaults/app/Models')),
])

// Load dashboard section toggles from `config/dashboard.ts` if present.
// Falls back to "everything enabled" when the file is missing or fails to
// parse, so a fresh project (no dashboard config) still gets the full
// sidebar. Shape mirrors `DashboardSectionToggles` in dashboard-utils.ts.
type DataRowToggles = {
  dashboard: boolean
  activity: boolean
  users: boolean
  teams: boolean
  subscribers: boolean
  allModels: boolean
}
async function loadDashboardToggles(): Promise<{
  library: boolean
  content: boolean
  commerce: boolean
  marketing: boolean
  analytics: boolean
  management: boolean
  utilities: boolean
  ci: boolean
  data: DataRowToggles
}> {
  const fallback = {
    library: true,
    content: true,
    commerce: true,
    marketing: true,
    analytics: true,
    management: true,
    utilities: true,
    // CI tracking is opt-in (stacksjs/stacks#1844) so it stays off when
    // the project ships no dashboard.ts at all.
    ci: false,
    data: { dashboard: true, activity: true, users: true, teams: true, subscribers: true, allModels: true } satisfies DataRowToggles,
  }
  try {
    type SectionMap = Record<string, { enabled?: boolean }> & { data?: Record<string, { enabled?: boolean }> }
    const mod = await import(projectPath('config/dashboard.ts')) as { default?: { sections?: SectionMap, ci?: { enabled?: boolean } } }
    const sections = mod.default?.sections ?? {}
    const data = sections.data ?? {}
    return {
      library: sections.library?.enabled ?? true,
      content: sections.content?.enabled ?? true,
      commerce: sections.commerce?.enabled ?? true,
      marketing: sections.marketing?.enabled ?? true,
      analytics: sections.analytics?.enabled ?? true,
      management: sections.management?.enabled ?? true,
      utilities: sections.utilities?.enabled ?? true,
      // ci lives at top level (it owns runtime config — orgs, runner caps —
      // not just visibility) so its toggle reads from `mod.default.ci`,
      // not from `sections.ci`.
      ci: mod.default?.ci?.enabled ?? false,
      data: {
        dashboard: data.dashboard?.enabled ?? true,
        activity: data.activity?.enabled ?? true,
        users: data.users?.enabled ?? true,
        teams: data.teams?.enabled ?? true,
        subscribers: data.subscribers?.enabled ?? true,
        allModels: data.allModels?.enabled ?? true,
      },
    }
  }
  catch {
    return fallback
  }
}

// eslint-disable-next-line ts/no-top-level-await
const dashboardToggles = await loadDashboardToggles()

// Write manifest. The envelope format includes the section toggles so the
// web sidebar (which runs in STX server-script context and can't easily do
// async config loading) can read them synchronously alongside the model
// list. Older readers that expect a bare array are handled in the loader.
const manifestPath = storagePath('framework/defaults/views/dashboard/.discovered-models.json')
const manifestPayload = {
  models: buildManifest(discoveredModels),
  sections: dashboardToggles,
}
writeFileSync(manifestPath, JSON.stringify(manifestPayload, null, 2))

// Wait briefly for STX server (it's usually ready by now)
// eslint-disable-next-line ts/no-top-level-await
const serverReady = await waitForServer(dashboardPort)

// Restore console before our output
restoreConsole()

// Start reverse proxy in the background (not needed for Craft window, only for browser access)
let proxyStarted = false
startReverseProxy().then(ok => { proxyStarted = ok }).catch((err) => {
  if (verbose) console.warn('[Dashboard] Reverse proxy failed:', err)
})

const dashboardHttpsUrl = dashboardDomain ? `https://${dashboardDomain}` : null
const dashboardLocalUrl = `http://localhost:${dashboardPort}`

// Use local HTTP URL — Craft webview loads directly, no proxy needed
const initialUrl = `http://localhost:${dashboardPort}/`

// Print vite-style output
const elapsedMs = (Bun.nanoseconds() - startTime) / 1_000_000

/* eslint-disable no-console */
console.log()
console.log(`  ${bold(cyan('stacks dashboard'))}`)
console.log()
if (dashboardHttpsUrl) {
  console.log(`  ${green('➜')}  ${bold('Local')}:   ${cyan(dashboardHttpsUrl)}`)
  console.log(`  ${dim('➜')}  ${dim('Origin')}:  ${dim(dashboardLocalUrl)}`)
}
else {
  console.log(`  ${green('➜')}  ${bold('Local')}:   ${cyan(dashboardLocalUrl)}`)
}
console.log(`  ${green('➜')}  ${bold('Window')}:  ${dim('Stacks Dashboard')} ${dim('1400×900')}`)
console.log(`  ${green('➜')}  ${bold('Models')}:  ${dim(`${discoveredModels.length} discovered`)}`)
if (dashboardPort !== preferredPort) {
  console.log(`  ${dim('➜')}  ${dim(`Port ${preferredPort} in use, using ${dashboardPort}`)}`)
}
if (!serverReady) {
  console.log(`  ${dim('⚠')}  ${dim('Dev server may not be ready yet')}`)
}
console.log()
console.log(`  ${dim(`ready in ${elapsedMs.toFixed(0)} ms`)}`)

if (verbose) {
  console.log()
  // The `Sidebar` line was dropped along with `sidebarConfig`: the native
  // sidebar is retired and the web one owns rendering, so there is no section
  // count to report here any more. The reference outlived the variable and
  // failed typecheck.
  console.log(`  ${dim('➜')}  ${dim('URL')}:      ${dim(initialUrl)}`)
  if (dashboardDomain) {
    console.log(`  ${dim('➜')}  ${dim('SSL')}:      ${dim(sslBasePath)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:    ${dim(`localhost:${dashboardPort} → ${dashboardDomain}`)}`)
  }

  if (bufferedLogs.length > 0) {
    console.log()
    for (const line of bufferedLogs) {
      console.log(`  ${dim(line)}`)
    }
  }
}
console.log()
/* eslint-enable no-console */

// Import Craft dynamically. Its static import triggers bun-router
// config loading which prints warnings before our console.log override is
// active. We also let it be missing — the native window is a nicety, not a
// requirement; the dashboard runs fine as a plain web server in that case.
interface CraftApplication {
  show: () => Promise<void>
  close: () => void
}

type CraftCreateApp = (options: Record<string, unknown>) => CraftApplication

let createApp: CraftCreateApp | undefined
const localCraftSdk = process.env.HOME
  ? `${process.env.HOME}/Code/Tools/craft/packages/typescript/src/index.ts`
  : undefined

if (localCraftSdk && existsSync(localCraftSdk)) {
  try {
    ;({ createApp } = await import(localCraftSdk) as { createApp?: CraftCreateApp })
  }
  catch {
    // Continue with installed package candidates below.
  }
}

if (!createApp) {
  const packageNames = ['craft-native', '@craft-native/craft', '@stacksjs/ts-craft'] as const
  for (const packageName of packageNames) {
    try {
      ;({ createApp } = await import(packageName) as { createApp?: CraftCreateApp })
      if (createApp)
        break
    }
    catch {
      // The Craft SDK isn't installed (or its native bindings failed to
      // load on this platform). Continue to the next compatible package.
    }
  }
}

if (createApp) {
  // Resolve the dock icon. Userland gets first crack at customizing via
  // `resources/assets/images/app-icon.png` in the project; if absent, fall
  // back to the framework's bundled placeholder so the dock never shows the
  // generic "no icon" silhouette. PNG is fine — NSImage decodes it directly.
  const userIconPath = projectPath('resources/assets/images/app-icon.png')
  const defaultIconPath = storagePath('framework/defaults/resources/assets/images/app-icon.png')
  // eslint-disable-next-line ts/no-top-level-await
  const appIconPath = (await Bun.file(userIconPath).exists())
    ? userIconPath
    : (await Bun.file(defaultIconPath).exists()) ? defaultIconPath : undefined

  // Native sidebar mode: Craft renders a real NSOutlineView populated
  // from `sidebarConfig`. The web sidebar self-hides via the layout's
  // `?native-sidebar=1` URL signal, so users only ever see one nav.
  //
  // If `sidebarConfig` round-tripping ever breaks again (Craft fell back
  // to its Finder placeholder before because the config didn't survive
  // argv/file passing), set `nativeSidebar: false` and the web sidebar
  // stays visible — see the layout for the matching detection logic.
  // ts-craft@0.0.2's `findCraftBinary()` only looks at a few cwd-relative
  // paths (packages/zig/zig-out/bin/craft etc.) and then falls back to
  // `'craft'` from PATH. The fallback resolves to the ts-craft CLI shim,
  // not the actual native binary, so spawn never produces a window.
  //
  // Honour `CRAFT_BIN` (matching the newer craft-native contract)
  // and probe a couple of known monorepo locations relative to this
  // checkout so the local `~/Documents/Projects/craft` clone Just Works
  // without requiring an env var.
  const craftBinaryPath = (() => {
    const explicit = process.env.CRAFT_BIN
    if (explicit) {
      // Explicit override — use it if it exists, otherwise skip native mode.
      // Silently falling through to the well-known probe paths below would
      // be surprising: the user named a path, so honour that decision.
      // A non-existent CRAFT_BIN is also our test/headless escape hatch.
      return existsSync(explicit) ? explicit : undefined
    }
    const codeTools = `${process.env.HOME}/Code/Tools/craft/craft`
    if (existsSync(codeTools))
      return codeTools
    const codeToolsBin = `${process.env.HOME}/Code/Tools/craft/bin/craft`
    if (existsSync(codeToolsBin))
      return codeToolsBin
    const codeToolsZig = `${process.env.HOME}/Code/Tools/craft/packages/zig/zig-out/bin/craft`
    if (existsSync(codeToolsZig))
      return codeToolsZig
    const homeRel = `${process.env.HOME}/Documents/Projects/craft/packages/zig/zig-out/bin/craft`
    if (existsSync(homeRel))
      return homeRel
    return undefined
  })()

  // If we couldn't locate a real native binary, don't even attempt to spawn
  // — old SDK `findCraftBinary()` PATH fallbacks can resolve to their own
  // CLI shim. That shim then re-receives our
  // native-style flags (`--url ...`), clapp rejects them as unknown, and the
  // user sees a noisy "ClappError: Unknown option --url" before the process
  // exits. Skip native-window mode entirely instead and let the web fallback
  // below handle it.
  if (!craftBinaryPath) {
    createApp = undefined
  }

  if (!createApp) {
    // eslint-disable-next-line no-console
    console.log(`  ${dim('Native window unavailable. Set CRAFT_BIN to a craft binary, or open the URL above in a browser.')}\n`)
    await new Promise<never>(() => {})
  }

  const app = createApp!({
    url: initialUrl,
    quiet: !verbose,
    ...(craftBinaryPath && { craftPath: craftBinaryPath }),
    window: {
      title: 'Stacks Dashboard',
      width: 1400,
      height: 900,
      titlebarHidden: true,
      // Real vibrancy behind the stx-rendered macOS sidebar (see
      // views/dashboard/layouts/default.stx). The native NSOutlineView
      // sidebar is retired — the web one owns rendering and behavior.
      webSidebarMaterial: true,
      webSidebarWidth: 250,
      ...(appIconPath && { icon: appIconPath }),
    },
  })

  // Clean up on exit
  process.on('SIGINT', () => {
    app.close()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    app.close()
    process.exit(0)
  })

  try {
    await app.show()
    process.exit(0)
  }
  catch {
    const fallbackUrl = dashboardHttpsUrl || dashboardLocalUrl
    // eslint-disable-next-line no-console
    console.log(`  ${dim('Dashboard available at:')} ${cyan(fallbackUrl)}\n`)

    // Keep the process running since we're serving via STX
    await new Promise(() => {})
  }
}
else {
  // No native window — keep the HTTP server alive so the dashboard is
  // reachable via the URLs printed in the banner above. SIGINT/SIGTERM
  // exit cleanly without a window to close.
  //
  // We get here in two cases:
  //   1. The Craft SDK failed to import (catch above set createApp = null)
  //   2. We couldn't find a real native craft binary (CRAFT_BIN unset and the
  //      `~/Documents/Projects/craft` checkout isn't present). In that case
  //      we deliberately skipped native mode to avoid spawning the ts-craft
  //      CLI shim with native-style flags (which would error on `--url`).
  // eslint-disable-next-line no-console
  console.log(`  ${dim('Native window unavailable. Set CRAFT_BIN to a craft binary, or open the URL above in a browser.')}\n`)
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
  await new Promise(() => {})
}
