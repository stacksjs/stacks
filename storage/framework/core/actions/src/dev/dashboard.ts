import process from 'node:process'
import { existsSync, mkdirSync } from 'node:fs'
import { bold, cyan, dim, green } from '@stacksjs/cli'
import { clearProjectService, defaultsPath, projectPath, publicPath, recordProjectService, storagePath } from '@stacksjs/path'
import { seedCsrfPageResponse, validateDevCsrfRequest } from './csrf'
import { resolveComponentsLibraryRoot } from './defaults-resources'
import { dashboardGitHubIssuesRoutes } from './dashboard-github-issues'
import { createIdleExit, projectSwitcherRoutes } from './dashboard-projects'
import { shouldDelegateDashboardRequest } from './dashboard-request-routing'
import { openDashboardNativeWindow } from './dashboard-native'
import { dashboardHttpsAnswers, dashboardOriginUrl, dashboardPendingHeader, dashboardReadyHeader, dashboardReadyPath, resolveDashboardDomain, startDashboardReverseProxy } from './dashboard-proxy'
import { buildManifest, discoverProjectModels, findAvailablePort, modelsWithEnabledFeatures, waitForServer, writeFileIfChanged } from './dashboard-utils'
import { dashboardSoftwareUpdateRoutes } from './dashboard-software-updates'
import { runDashboardSupervisor } from './dashboard-supervisor'
import { createWorkerHmrRetirement, frontendHmrResponse } from './frontend-hmr'
import { retainFrontendPageState } from './frontend-hmr-state'
import { dashboardAssetRoutes, dashboardRenderOptions } from '../dashboard-assets'
import { ensureDiscoveredPackages } from '../discover-packages'
import { resolveStxSource } from '../stx-source'
import { installServeRelayWorker, serveRelayPort } from '../helpers/serve-relay-worker'

if (process.env.STACKS_DASHBOARD_WORKER !== '1') {
  // The STX server owns template and component HMR. Backend modules need a
  // clean Bun process because its ESM dependency cache cannot be invalidated
  // safely when an action helper adds or removes an export.
  // eslint-disable-next-line ts/no-top-level-await
  const exitCode = await runDashboardSupervisor(import.meta.path, process.argv.slice(2))
  process.exit(exitCode)
}

// Dashboard routes, layout types and bundles belong to this server. Sharing
// the application's STX directory would overwrite its web route manifest.
//
// A sibling of `framework/runtime/dashboard`, never inside it: that directory
// is a watched root (see `watchDirs` below, for the models manifest), and stx
// writes bundles and CSS here on every render. Inside it, each render looked
// like a source change: it bumped the HMR version, so every open page
// reloaded, rendered again and bumped it again, and the kept-page cache never
// matched its own fingerprint, so nothing was served from it.
process.env.STX_DIR = storagePath('framework/runtime/dashboard-stx')

// The layout draws the project switcher only for this server. A deployed
// dashboard serves the one project it was deployed with.
process.env.STACKS_DASHBOARD_PROJECTS = '1'

// buddyOptions serializes `verbose: false` as `--verbose false`, so
// process.argv.includes('--verbose') would always match. Check the value too.
const verboseIdx = process.argv.indexOf('--verbose')
const verbose = verboseIdx !== -1 && process.argv[verboseIdx + 1] !== 'false'
const startTime = Bun.nanoseconds()

// Buffer all dependency console output (STX serve, ts-css, bun-router)
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
const dashboardPath = defaultsPath('views/dashboard')
const userDashboardPath = projectPath('resources/views/dashboard')
// The app's own copies of dashboard components (`buddy publish:component`),
// searched ahead of the framework's (stacksjs/stacks#3032).
const dashboardComponentsPath = defaultsPath('resources/components/Dashboard')
const userDashboardComponentsPath = projectPath('resources/components/Dashboard')
const preferredPort = Number(process.env.PORT_ADMIN) || 3002
const privatePort = serveRelayPort('dashboard')
const relay = privatePort ? installServeRelayWorker(() => process.exit(0)) : undefined
const restartPort = Number(process.env.STACKS_DASHBOARD_RESTART_PORT) || undefined
const dashboardHostname = '127.0.0.1'
const dashboardListener = { hostname: dashboardHostname }
// eslint-disable-next-line ts/no-top-level-await
const dashboardPort = relay ? Number(process.env.STACKS_DASHBOARD_PUBLIC_PORT) : restartPort ?? await findAvailablePort(preferredPort)
const listenerPort = privatePort ?? dashboardPort
const dashboardAddress = `${dashboardHostname}:${dashboardPort}`
const dashboardLocalUrl = `http://${dashboardAddress}`

// A dashboard the background daemon started stops itself once nobody has used
// it for this long (see `createIdleExit`). One started in a terminal has no
// such limit: it runs until that session ends it.
const idleExitMs = Number(process.env.STACKS_DASHBOARD_IDLE_EXIT_MS) || 0
// Under the supervisor the record carries the supervisor's pid, so it stays
// true across the worker restarts a backend edit causes.
const servicePid = Number(process.env.STACKS_DASHBOARD_SUPERVISOR_PID) || process.pid
const idleExit = createIdleExit(relay ? 0 : idleExitMs, () => {
  clearProjectService(projectPath(), 'dashboard', servicePid)
  process.exit(0)
})

const dashboardInstance = (relay && process.env.STACKS_DASHBOARD_INSTANCE) || crypto.randomUUID()
const hmrRetirement = relay && createWorkerHmrRetirement('stacks:dashboard-hmr-reconnect')
let dashboardReady = false
let dashboardPublished = false
const { app, config, feature, overridesReady } = await import('@stacksjs/config')
await overridesReady
const appUrl = process.env.APP_URL || app.url || ''
const localhostOnly = process.env.STACKS_DEV_LOCALHOST === '1'
const defaultDashboardDomain = resolveDashboardDomain(appUrl, localhostOnly)
const managedDashboardDomain = process.env.STACKS_MANAGED_DASHBOARD_DOMAIN
const dashboardDomain = managedDashboardDomain === undefined
  ? resolveDashboardDomain(appUrl, localhostOnly, process.env.DASHBOARD_URL) ?? defaultDashboardDomain
  : managedDashboardDomain || null
const originDomain = dashboardDomain?.endsWith('.localhost') ? dashboardDomain : defaultDashboardDomain
let dashboardBrowserUrl = (relay && process.env.STACKS_DASHBOARD_PUBLIC_URL) || dashboardOriginUrl(originDomain, dashboardPort)
if (relay) {
  process.on('message', (message) => {
    if (!message || typeof message !== 'object' || !('type' in message))
      return
    if (message.type === 'stacks:dashboard-url' && 'url' in message && typeof message.url === 'string')
      dashboardBrowserUrl = message.url
  })
}

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

const { dashboardViewExclusions, readDashboardPageAvailability } = await import(
  defaultsPath('resources/functions/dashboard/page-availability.ts')
)
const { resolveDashboardNav } = await import(defaultsPath('resources/functions/dashboard/toggles.ts'))
const dashboardAvailability = readDashboardPageAvailability()

async function startStxServer(): Promise<void> {
  // The dev preloader skips globals. Like the API worker, the dashboard must
  // discover packages and refresh the app barrels before injecting primitives,
  // models, functions and authorization. Do this before importing app routes:
  // their transitive action imports can use `new Action()` at module scope.
  const { autoImportsAreStale, generateAutoImportFiles, injectGlobalAutoImports } = await import('@stacksjs/server')
  await ensureDiscoveredPackages()
  if (!existsSync(storagePath('framework/auto-imports/models.ts')) || autoImportsAreStale())
    await generateAutoImportFiles()
  await injectGlobalAutoImports()

  // The installed dependency, unless an operator names another copy by path.
  //
  // This used to be a silent chain: a hardcoded `~/Code/Tools/stx` checkout,
  // then the project's `pantry/` directory, then the installed package - the
  // same inversion `production-server.ts` was fixed for in #2369, which the
  // dev server never got. It had stopped being hypothetical: pantry carried
  // `@stacksjs/stx@0.2.484` while the repository pinned `0.2.607`, so every
  // dashboard page rendered through a compiler 123 versions behind the one
  // the application ships, and nothing said so. A bug reproduced here was
  // being reproduced against the wrong stx.
  //
  // `resolveStxSource` is the rule `production-server.ts` already uses, now
  // shared rather than restated. A named path that does not exist is refused
  // instead of silently falling back to a guess.
  const serveSource = resolveStxSource({ value: process.env.BUN_PLUGIN_STX_SRC })
  if (serveSource.kind === 'missing') {
    throw new Error(
      `BUN_PLUGIN_STX_SRC points at ${serveSource.path}, which does not exist. `
      + `Unset it to use the installed bun-plugin-stx.`,
    )
  }

  let serve: typeof import('bun-plugin-stx/serve').serve
  if (serveSource.kind === 'override') {
    serve = (await import(serveSource.path)).serve
    console.log(`[Dashboard] bun-plugin-stx from ${serveSource.path}`)
  }
  else {
    serve = (await import('bun-plugin-stx/serve')).serve
  }

  // Same rule for the renderer itself. Left undefined when there is no
  // override, so `serve` resolves `@stacksjs/stx` the ordinary way and the
  // process holds one instance of it rather than two.
  const stxSource = resolveStxSource({ value: process.env.STX_SRC })
  if (stxSource.kind === 'missing') {
    throw new Error(
      `STX_SRC points at ${stxSource.path}, which does not exist. `
      + `Unset it to use the installed @stacksjs/stx.`,
    )
  }

  let stxModule: any
  if (stxSource.kind === 'override') {
    stxModule = await import(stxSource.path)
    console.log(`[Dashboard] stx from ${stxSource.path}`)
  }

  let configEditor: Promise<ReturnType<typeof import('./dashboard-config')['dashboardConfigRoutes']>> | undefined
  function configEditorRoute(path: string) {
    return async (request: Request) => {
      configEditor ??= import('./dashboard-config').then(({ dashboardConfigRoutes }) => dashboardConfigRoutes({
        directory: projectPath('config'),
        hosts: () => [
          `127.0.0.1:${dashboardPort}`,
          `localhost:${dashboardPort}`,
          new URL(dashboardBrowserUrl).host,
          ...(dashboardDomain ? [dashboardDomain] : []),
        ],
        validateWrite: validateDevCsrfRequest,
      }))
      return (await configEditor)[path]!(request)
    }
  }

  const configRoutes: Record<string, (req: Request) => Response | Promise<Response>> = {
    ...dashboardAssetRoutes(defaultsPath(), projectPath()),
    ...projectSwitcherRoutes({
      root: projectPath(),
      get url() { return dashboardBrowserUrl },
      idleExitMs,
      validateWrite: validateDevCsrfRequest,
      // Loaded on first use: most sessions never switch project, and the
      // daemon is only started by the first one that does.
      openDashboard: async root => (await import('../daemon/client')).openProjectDashboard(root),
    }),
    ...dashboardGitHubIssuesRoutes({
      root: projectPath(),
      port: dashboardPort,
      url: () => dashboardBrowserUrl,
    }),
    ...dashboardSoftwareUpdateRoutes({
      root: projectPath(),
      port: dashboardPort,
      url: () => dashboardBrowserUrl,
      validateWrite: validateDevCsrfRequest,
    }),
    '/api/config/list': configEditorRoute('/api/config/list'),
    '/api/config/read': configEditorRoute('/api/config/read'),
    '/api/config/update': configEditorRoute('/api/config/update'),
    '/api/config/dns': configEditorRoute('/api/config/dns'),
    '/api/config/dns/add': configEditorRoute('/api/config/dns/add'),
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
  const router = await import('@stacksjs/router')
  // `app/Routes.ts` is optional: an app whose routes all live in
  // `routes/api.ts` needs no manifest saying so.
  await router.loadRoutes(await router.appRouteRegistry())
  // Opening the standalone dashboard explicitly opts into its operational
  // JSON API, even when the application skips default route bundles. Keep
  // the application's public bundles unchanged; this process serves only
  // the developer dashboard, and these endpoints retain their own guards.
  await router.route.register(defaultsPath('routes/dashboard-api.ts'))
  const stacksRoute = router.route

  const serverPromise = serve({
    ...dashboardRenderOptions,
    root: projectPath('resources'),
    patterns: [userDashboardPath, dashboardPath],
    exclude: dashboardViewExclusions(dashboardPath, dashboardAvailability),
    // Local dashboard actions can run without an authenticated browser session.
    ...dashboardListener,
    port: listenerPort,
    ...((privatePort !== undefined || restartPort !== undefined) && { autoIncrementPort: false }),
    // The app's dashboard components first, then the framework's, both ahead
    // of `@stacksjs/components` below: that library shares names with the
    // dashboard's own (`Button`, `Card`, `Table`, ...), so the framework's
    // cannot be the fallback (stacksjs/stacks#3032, stacksjs/stx#2130).
    componentsDir: userDashboardComponentsPath,
    additionalComponentsDirs: [dashboardComponentsPath],
    // The layout's `<Sidebar>` and `<SidebarHeader>` ship in
    // `@stacksjs/components`. Searched last, so an app's own component of
    // the same name still wins (stacksjs/stacks#2641).
    fallbackComponentsDir: resolveComponentsLibraryRoot(),
    // Both are the `layouts` directories: stx looks `layouts/default` up as
    // `default.stx` inside them. An app's
    // `resources/views/dashboard/layouts/default.stx` (`buddy
    // publish:view dashboard/layouts/default`) replaces the dashboard chrome;
    // every layout it does not have comes from the framework (#3032).
    layoutsDir: projectPath('resources/views/dashboard/layouts'),
    fallbackLayoutsDir: defaultsPath('views/dashboard/layouts'),
    partialsDir: dashboardPath,
    // Pin the app's canonical public root. Dashboard pages can be discovered
    // from framework storage while the assets they reference still belong to
    // the application, independent of the process working directory or an
    // inferred STX template root.
    publicDir: publicPath(),
    // Dashboard routes render source-derived STX shells and load live data
    // through dashboardApi() after hydration. Reuse the dependency-aware
    // static render between navigations, while watching every composable root
    // whose client bundle can change the emitted HTML.
    renderCache: true,
    renderCacheVary: 'source',
    // No prewarm. It fetched every dashboard route from this same process,
    // four at a time, on the thread that serves the developer's requests: about
    // 170 seconds of CPU after "ready", during which a page took 3-28s because
    // it queued behind the renders (stacksjs/stacks#2964). On demand, a page's
    // first visit costs its own ~1s render and every later one comes from the
    // cache above in under 10ms. Concurrency 1 did not help: each render holds
    // the thread for about a second, so even cached pages still waited 1-3s.
    prewarmRenderCache: false,
    // During a rolling restart the old worker can render with its cached
    // ESM modules after files change. Keep each worker's page cache in memory
    // so those renders cannot populate the replacement's cache.
    renderCachePersist: !relay,
    watchDirs: [
      projectPath('resources/functions'),
      defaultsPath('resources/functions'),
      defaultsPath('functions'),
      // The sidebar reads these inputs without importing them.
      projectPath('config'),
      storagePath('framework/runtime/dashboard'),
    ],
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
    //   3. `/auth/*` and `/me` are JSON authentication endpoints even on
    //      GET, so they also delegate to the Stacks router.
    //   4. For everything else, GET and HEAD go to STX (page rendering wins,
    //      so `/health`, `/login`, `/content/authors`, etc. render their
    //      `.stx` view) and non-GET goes to bun-router (so POST `/login`
    //      reaches the action). Without rule (3a), root-level routes that
    //      collide with a page — e.g. `route.health()` registering a
    //      `/health` LB-probe at root — would intercept the page.
    onRequest: async (req: Request, server) => {
      hmrRetirement?.trackServer(server)
      const peer = (relay?.wrap(server) ?? server).requestIP(req)?.address
      if (!peer || (peer !== '::1' && !/^(?:::ffff:)?127\./.test(peer)))
        return new Response('Not found', { status: 404 })

      idleExit.touch()
      const url = new URL(req.url)
      const pathname = url.pathname

      if (pathname === dashboardReadyPath && req.method === 'HEAD') {
        return new Response(null, { status: dashboardReady ? 204 : 503, headers: {
          [dashboardReadyHeader]: dashboardInstance,
          [dashboardPendingHeader]: dashboardPublished ? '0' : '1',
          'cache-control': 'no-store',
        } })
      }

      if (pathname === '/environment' && (req.method === 'GET' || req.method === 'HEAD')
        && !existsSync(projectPath('resources/views/dashboard/environment.stx'))
        && !existsSync(projectPath('resources/views/dashboard/environment/index.stx'))) {
        return new Response(null, { status: 307, headers: { location: `/settings/environment${url.search}` } })
      }

      if (shouldDelegateDashboardRequest(pathname, req.method))
        return stacksRoute.handleRequest(req)

      return null
    },
    // The dashboard's login and registration views submit to CSRF-protected
    // framework routes. Seed the token on the HTML response, matching the
    // regular development and production page servers.
    onResponse: async (req, response) => {
      const live = hmrRetirement && (frontendHmrResponse(req, response, dashboardInstance, hmrRetirement.signal) ?? retainFrontendPageState(response))
      return await seedCsrfPageResponse(req, live ?? response) ?? live
    },
    auth: false,
    ...(stxModule && { stxModule }),
  })

  serverPromise.catch((err: Error) => {
    restoreConsole()
    console.error(`\n  Failed to start dashboard server: ${err?.message || err}\n`)
    process.exit(1)
  })
}

// A supervised dashboard keeps one proxy route for its public relay.
const proxy = relay ? Promise.resolve(false) : startDashboardReverseProxy({
  domain: dashboardDomain, address: dashboardAddress, pid: servicePid, verbose,
})

// Phase 1: Start STX server and discover models in parallel
// eslint-disable-next-line ts/no-top-level-await
const [, allDiscoveredModels] = await Promise.all([
  startStxServer(),
  discoverProjectModels(),
])

const dashboardNav = resolveDashboardNav(config.dashboard)
const { frameworkModelFeature } = await import('@stacksjs/orm')
const discoveredModels = modelsWithEnabledFeatures(allDiscoveredModels, frameworkModelFeature, name => feature(name as Parameters<typeof feature>[0]))

// Write manifest. The envelope format includes the section toggles and any
// app-declared nav sections so the web sidebar (which runs in STX
// server-script context and can't easily do async config loading) can read
// them synchronously alongside the model list. Older readers that expect a
// bare array are handled in the loader.
// Under `framework/runtime/`, which `.gitignore` already covers, and not in
// `framework/defaults/` where this used to live. The manifest is generated
// per app from its own models and `config/dashboard.ts` section toggles, so
// a tracked copy means every app that runs `buddy dev --dashboard` gets a
// dirty file in its vendored framework tree - and flipping a section toggle
// rewrites it. The upgrade sync already treated it as local state it must not
// clobber; this puts it where local state belongs.
const manifestDir = storagePath('framework/runtime/dashboard')
const manifestPath = storagePath('framework/runtime/dashboard/.discovered-models.json')
mkdirSync(manifestDir, { recursive: true })
const manifestPayload = {
  models: buildManifest(discoveredModels),
  schemaModels: dashboardAvailability.schemaModels,
  sections: dashboardAvailability.sections,
  nav: dashboardNav,
}
writeFileIfChanged(manifestPath, JSON.stringify(manifestPayload, null, 2))

// Wait briefly for STX server (it's usually ready by now)
// eslint-disable-next-line ts/no-top-level-await
const serverReady = await waitForServer(listenerPort)

// Restore console before our output
restoreConsole()

if (!serverReady) {
  console.error('Dashboard server did not start listening.')
  process.exit(1)
}
dashboardReady = true
const dashboardHttpsUrl = dashboardDomain ? `https://${dashboardDomain}` : null
const proxyStarted = dashboardDomain && await proxy && await dashboardHttpsAnswers(dashboardDomain, dashboardInstance)
if (dashboardHttpsUrl && proxyStarted)
  dashboardBrowserUrl = dashboardHttpsUrl

// Say where this dashboard is, in the project itself. `buddy dashboard`, the
// background daemon and the project switcher of every other dashboard read
// this to learn that the project already has one up, whoever started it.
if (relay) {
  dashboardPublished = true
  process.send?.({ type: 'stacks:dashboard-ready', instance: dashboardInstance, domain: dashboardDomain, url: dashboardBrowserUrl })
}
else {
  recordProjectService(projectPath(), {
    name: 'dashboard',
    pid: servicePid,
    port: dashboardPort,
    url: dashboardBrowserUrl,
    startedAt: new Date().toISOString(),
    ...(servicePid !== process.pid ? { restartInstance: dashboardInstance } : {}),
    ...(idleExitMs > 0 ? { idleExitMs } : {}),
  })
  dashboardPublished = true
  // Legacy supervisors clean the record when the session ends.
  if (servicePid === process.pid)
    process.on('exit', () => clearProjectService(projectPath(), 'dashboard', servicePid))
}

const initialUrl = `${dashboardBrowserUrl}/`

// Print vite-style output
const elapsedMs = (Bun.nanoseconds() - startTime) / 1_000_000

/* eslint-disable no-console */
console.log()
console.log(`  ${bold(cyan('stacks dashboard'))}`)
console.log()
// Only lead with the pretty URL when something is actually serving it.
// Printing `https://dashboard.<domain>` on the strength of APP_URL alone sent
// people to a host that refused the connection whenever the proxy had not come
// up, with the URL that does work hidden on the `Origin` line below it.
if (dashboardHttpsUrl && proxyStarted) {
  console.log(`  ${green('➜')}  ${bold('Local')}:   ${cyan(dashboardHttpsUrl)}`)
  console.log(`  ${dim('➜')}  ${dim('Origin')}:  ${dim(dashboardLocalUrl)}`)
}
else {
  console.log(`  ${green('➜')}  ${bold('Local')}:   ${cyan(dashboardBrowserUrl)}`)
  if (dashboardHttpsUrl)
    console.log(`  ${dim('➜')}  ${dim('Pretty')}:  ${dim(`${dashboardHttpsUrl} needs the rpx proxy - run \`buddy setup:ssl\``)}`)
}
console.log(`  ${green('➜')}  ${bold('Window')}:  ${dim('Stacks Dashboard')} ${dim('1400×900')}`)
console.log(`  ${green('➜')}  ${bold('Models')}:  ${dim(`${discoveredModels.length} discovered`)}`)
if (dashboardPort !== preferredPort) {
  console.log(`  ${dim('➜')}  ${dim(`Port ${preferredPort} in use, using ${dashboardPort}`)}`)
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
    console.log(`  ${dim('➜')}  ${dim('SSL')}:      ${dim(`${process.env.HOME}/.stacks/ssl`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:    ${dim(`${dashboardAddress} → ${dashboardDomain}`)}`)
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

if (!relay) {
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
  try {
    const app = await openDashboardNativeWindow(dashboardLocalUrl, verbose)
    if (app) {
      for (const signal of ['SIGINT', 'SIGTERM'] as const)
        process.prependOnceListener(signal, () => app.kill())
      const exitCode = await app.exited
      if (exitCode === 0)
        process.exit(0)
      throw new Error(`Craft exited with code ${exitCode}`)
    }
  }
  catch (error) {
    console.warn(`Native Craft window failed: ${error instanceof Error ? error.message : error}`)
  }
}

await new Promise(() => {})
