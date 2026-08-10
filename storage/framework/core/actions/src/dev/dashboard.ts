import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { bold, cyan, dim, green } from '@stacksjs/cli'
import { projectPath, publicPath, storagePath } from '@stacksjs/path'
import { seedCsrfPageResponse, validateDevCsrfRequest } from './csrf'
import { shouldDelegateDashboardRequest } from './dashboard-request-routing'
import { buildDashboardUrl, buildManifest, discoverModels, findAvailablePort, waitForServer } from './dashboard-utils'
import { runDashboardSupervisor } from './dashboard-supervisor'

if (process.env.STACKS_DASHBOARD_WORKER !== '1') {
  // The STX server owns template and component HMR. Backend modules need a
  // clean Bun process because its ESM dependency cache cannot be invalidated
  // safely when an action helper adds or removes an export.
  // eslint-disable-next-line ts/no-top-level-await
  const exitCode = await runDashboardSupervisor(import.meta.path, process.argv.slice(2))
  process.exit(exitCode)
}

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
  await import('@stacksjs/orm')

  let serve: typeof import('bun-plugin-stx/serve').serve
  try {
    const localServe = process.env.BUN_PLUGIN_STX_SRC
      || `${process.env.HOME}/Code/Tools/stx/packages/bun-plugin/src/serve.ts`
    if (!(await Bun.file(localServe).exists()))
      throw new Error('local bun-plugin-stx source not found')
    const mod = await import(localServe)
    serve = mod.serve
  }
  catch {
    try {
      const mod = await import('bun-plugin-stx/serve')
      serve = mod.serve
    }
    catch {
      const mod = await import(projectPath('pantry/bun-plugin-stx/dist/serve.js'))
      serve = mod.serve
    }
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
    if (await Bun.file(localStx).exists()) {
      const localCrosswind = `${process.env.HOME}/Code/Tools/crosswind/packages/crosswind/src/index.ts`
      if (!process.env.CROSSWIND_SRC && await Bun.file(localCrosswind).exists())
        process.env.CROSSWIND_SRC = localCrosswind
      stxModule = await import(localStx)
    }
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
  const { listConfigFiles, readConfig, updateConfigKeys } = await import(
    storagePath('framework/defaults/resources/functions/dashboard/config-io.ts')
  )
  // Dashboard chart modules are loaded lazily from explicit dev-server URLs.
  // Package dist files are intentionally not served verbatim: they retain
  // package-internal bare imports, which browsers cannot resolve. Build each
  // entry into one browser-native ESM module and cache it for this dev session.
  const localTsChartsRoot = process.env.TS_CHARTS_SRC
    || `${process.env.HOME}/Code/Libraries/ts-charts`
  const dependencyBundles = new Map<string, Promise<string>>()

  function resolveTsChartsSource(packageName: string): string | null {
    const candidates = [
      `${localTsChartsRoot}/packages/${packageName}/src/index.ts`,
      projectPath(`node_modules/@ts-charts/${packageName}/src/index.ts`),
      projectPath(`pantry/@ts-charts/${packageName}/src/index.ts`),
    ]
    return candidates.find(existsSync) || null
  }

  const tsChartsEntry = [
    `${localTsChartsRoot}/packages/ts-charts/src/index.ts`,
    projectPath('node_modules/ts-charts/src/index.ts'),
    projectPath('pantry/ts-charts/src/index.ts'),
  ].find(existsSync)

  async function buildDashboardDependency(entrypoint: string): Promise<string> {
    const cached = dependencyBundles.get(entrypoint)
    if (cached)
      return cached

    const build = (async () => {
      const result = await Bun.build({
        entrypoints: [entrypoint],
        target: 'browser',
        format: 'esm',
        minify: true,
        plugins: [{
          name: 'dashboard-ts-charts-source',
          setup(builder) {
            builder.onResolve({ filter: /^@ts-charts\/[a-z0-9-]+$/ }, (args) => {
              const packageName = args.path.slice('@ts-charts/'.length)
              const source = resolveTsChartsSource(packageName)
              if (source)
                return { path: source }
              return null
            })
          },
        }],
      })
      if (!result.success) {
        const errors = result.logs
          .filter(log => log.level === 'error')
          .map(log => log.message)
          .join('\n')
        throw new Error(errors || `Failed to bundle ${entrypoint}`)
      }
      const output = result.outputs.find(file => file.path.endsWith('.js'))
      if (!output)
        throw new Error(`No JavaScript output produced for ${entrypoint}`)
      return output.text()
    })()

    dependencyBundles.set(entrypoint, build)
    return build
  }

  function browserDependencyRoute(entrypoint: string): () => Promise<Response> {
    return async () => {
      try {
        return new Response(await buildDashboardDependency(entrypoint), {
          headers: {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': 'no-cache',
          },
        })
      }
      catch (error) {
        dependencyBundles.delete(entrypoint)
        return new Response(`throw new Error(${JSON.stringify((error as Error).message)})`, {
          status: 500,
          headers: { 'content-type': 'text/javascript; charset=utf-8' },
        })
      }
    }
  }

  // Dashboard icons render through Crosswind icon classes (`i-hugeicons-*`), but most are
  // applied via dynamic bindings — `:class="stat.icon"` — whose values live in `<script>`
  // state. The stx Crosswind extractor only sees static `class="…"` and string literals
  // written inline inside `:class="…"`, so dynamically-bound icons never get CSS generated
  // and render as empty boxes. Generate the CSS for every icon the dashboard references
  // (framework defaults + userland overrides) ONCE and serve it as a browser-cached
  // stylesheet the layout links, rather than inlining ~260KB of icon CSS into every page.
  // The matching <link> is injected by the dashboard layout — see
  // `storage/framework/defaults/views/dashboard/layouts/default.stx`.
  let dashboardIconCss: Promise<string> | null = null
  async function buildDashboardIconCss(): Promise<string> {
    const { generateCrosswindCSS } = await import('@stacksjs/stx')
    const dirs = [dashboardPath, userDashboardPath, storagePath('framework/defaults/resources/components/Dashboard')]
    const icons = new Set<string>()
    for (const dir of dirs) {
      if (!existsSync(dir))
        continue
      const glob = new Bun.Glob('**/*.{stx,ts}')
      for await (const file of glob.scan({ cwd: dir, absolute: true })) {
        const text = await Bun.file(file).text()
        // `i-collection-name` icon tokens; two+ segments avoids matching `i-foo`.
        for (const match of text.matchAll(/\bi-[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g))
          icons.add(match[0])
      }
    }
    if (icons.size === 0)
      return ''
    return generateCrosswindCSS(`<div class="${[...icons].join(' ')}"></div>`, process.cwd())
  }

  const configRoutes: Record<string, (req: Request) => Response | Promise<Response>> = {
    '/__deps/charts.js': browserDependencyRoute(
      storagePath('framework/core/charts/src/index.ts'),
    ),
    '/__deps/ts-charts.js': browserDependencyRoute(
      tsChartsEntry || `${localTsChartsRoot}/packages/ts-charts/src/index.ts`,
    ),
    '/__deps/dashboard-icons.css': async () => {
      if (!dashboardIconCss)
        dashboardIconCss = buildDashboardIconCss()
      return new Response(await dashboardIconCss, {
        headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-cache' },
      })
    },
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
        // Strip raw source and the duplicate values object. The editor works
        // from field metadata, while /api/config/source serves source text.
        return Response.json({ ok: true, name, fields: result.fields })
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
        await validateDevCsrfRequest(req)
        const body = (await req.json()) as { file?: string, key?: string, value?: unknown, updates?: Array<{ path?: string, key?: string, value?: unknown }> }
        // Accept two shapes:
        //   1) { file, key, value }                 — single key edit
        //   2) { file, updates: [{ path|key, value }] } — batch (used by services.stx)
        const file = body.file?.replace(/\.ts$/, '')
        if (!file || !/^[\w-]+$/.test(file))
          return Response.json({ ok: false, error: 'Invalid file' }, { status: 400 })

        const updates: Array<{ key: string, value: unknown }> = []
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

        const invalid = updates.find(update =>
          !/^[A-Za-z_$][\w$]*$/.test(update.key)
          || (
            typeof update.value !== 'string'
            && typeof update.value !== 'number'
            && typeof update.value !== 'boolean'
          )
          || (typeof update.value === 'number' && !Number.isFinite(update.value)),
        )
        if (invalid)
          return Response.json({ ok: false, error: `Invalid value for configuration key "${invalid.key}"` }, { status: 400 })

        const typedUpdates = updates as Array<{ key: string, value: string | number | boolean }>
        try {
          await updateConfigKeys(file, typedUpdates)
        }
        catch (err) {
          const error = (err as Error)?.message || 'Configuration values could not be updated.'
          const results = typedUpdates.map(update => ({
            key: update.key,
            ok: false,
            error,
          }))
          return Response.json({ ok: false, file, results, error }, { status: 422 })
        }
        const results = typedUpdates.map(update => ({
          key: update.key,
          ok: true,
          newValue: update.value,
        }))
        return Response.json({ ok: true, file, results })
      }
      catch (e) {
        if ((e as { status?: number })?.status === 403)
          return Response.json({ ok: false, error: 'Forbidden', message: 'CSRF token mismatch' }, { status: 403 })
        return Response.json({ ok: false, error: (e as Error)?.message }, { status: 500 })
      }
    },
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
  const routeRegistry = (await import(projectPath('app/Routes.ts'))).default
  await router.loadRoutes(routeRegistry)
  const stacksRoute = router.route

  const serverPromise = serve({
    patterns: [userDashboardPath, dashboardPath],
    port: dashboardPort,
    componentsDir: storagePath('framework/defaults/resources/components/Dashboard'),
    layoutsDir: dashboardPath,
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
    prewarmRenderCache: 4,
    watchDirs: [
      projectPath('resources/functions'),
      storagePath('framework/defaults/resources/functions'),
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
    onRequest: async (req: Request) => {
      const url = new URL(req.url)
      const pathname = url.pathname

      if (shouldDelegateDashboardRequest(pathname, req.method))
        return stacksRoute.handleRequest(req)

      return null
    },
    // The dashboard's login and registration views submit to CSRF-protected
    // framework routes. Seed the token on the HTML response, matching the
    // regular development and production page servers.
    onResponse: seedCsrfPageResponse,
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

// Phase 1: Start STX server and discover models in parallel
// eslint-disable-next-line ts/no-top-level-await
const [, discoveredModels] = await Promise.all([
  startStxServer(),
  discoverModels(projectPath('app/Models'), storagePath('framework/defaults/app/Models')),
])

// eslint-disable-next-line ts/no-top-level-await
const { loadDashboardToggles } = await import(
  storagePath('framework/defaults/resources/functions/dashboard/toggles.ts')
)
// eslint-disable-next-line ts/no-top-level-await
const dashboardToggles = await loadDashboardToggles(projectPath('config/dashboard.ts'))

// Write manifest. The envelope format includes the section toggles so the
// web sidebar (which runs in STX server-script context and can't easily do
// async config loading) can read them synchronously alongside the model
// list. Older readers that expect a bare array are handled in the loader.
const manifestPath = storagePath('framework/defaults/views/dashboard/.discovered-models.json')
const manifestPayload = {
  models: buildManifest(discoveredModels),
  sections: dashboardToggles,
}
const manifestTempPath = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`
try {
  writeFileSync(manifestTempPath, JSON.stringify(manifestPayload, null, 2), { flag: 'wx' })
  renameSync(manifestTempPath, manifestPath)
}
finally {
  if (existsSync(manifestTempPath))
    unlinkSync(manifestTempPath)
}

// Wait briefly for STX server (it's usually ready by now)
// eslint-disable-next-line ts/no-top-level-await
const serverReady = await waitForServer(dashboardPort)

// Restore console before our output
restoreConsole()

// The native Craft window uses the same pretty HTTPS URL as the browser.
// When the parent `buddy dev` process already owns rpx/tlsx, it is ready or
// becoming ready there. A direct `buddy dev:dashboard` waits for its own proxy.
let proxyStarted = Boolean(process.env.STACKS_PROXY_MANAGED)
if (!proxyStarted) {
  // eslint-disable-next-line ts/no-top-level-await
  proxyStarted = await startReverseProxy().catch((err) => {
    if (verbose) console.warn('[Dashboard] Reverse proxy failed:', err)
    return false
  })
}

const dashboardHttpsUrl = dashboardDomain ? `https://${dashboardDomain}` : null
const dashboardLocalUrl = `http://localhost:${dashboardPort}`

const initialUrl = dashboardHttpsUrl && proxyStarted
  ? `${dashboardHttpsUrl}/`
  : `${dashboardLocalUrl}/`

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
    // Same pretty HTTPS URL as the browser. Craft's WKWebView trusts the tlsx
    // local-dev CA via its didReceiveAuthenticationChallenge handler (scoped to
    // loopback / *.localhost), so the native window loads it directly instead of
    // failing the cert and going blank.
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
