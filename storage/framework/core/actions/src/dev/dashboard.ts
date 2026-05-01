import process from 'node:process'
import { readFileSync, writeFileSync } from 'node:fs'
import { bold, cyan, dim, green } from '@stacksjs/cli'
import { projectPath, storagePath } from '@stacksjs/path'
import { buildDashboardUrl, buildManifest, buildSidebarConfig, discoverModels, findAvailablePort, waitForServer } from './dashboard-utils'

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

const dashboardPath = storagePath('framework/defaults/views/dashboard')
const dashboardPagesPath = `${dashboardPath}/pages`
const userDashboardPath = projectPath('resources/views/dashboard')
const userDashboardPagesPath = `${userDashboardPath}/pages`
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
  try {
    const vendoredStx = projectPath('pantry/@stacksjs/stx/dist/index.js')
    if (await Bun.file(vendoredStx).exists())
      stxModule = await import(vendoredStx)
  }
  catch { /* fall through */ }

  // Mount the config-editor API routes. The settings UI talks to these
  // to list config files, read their resolved values, and write edits
  // back to disk. They run in the dashboard server's process so they
  // share the same fs cwd and don't need a second port to be open.
  const { listConfigFiles, readConfig, updateConfigKey } = await import(
    storagePath('framework/defaults/resources/functions/dashboard/config-io.ts')
  )
  const configRoutes: Record<string, (req: Request) => Response | Promise<Response>> = {
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
  const serverPromise = serve({
    patterns: [userDashboardPagesPath, dashboardPagesPath],
    port: dashboardPort,
    componentsDir: storagePath('framework/defaults/resources/components/Dashboard'),
    layoutsDir: dashboardPath,
    partialsDir: dashboardPath,
    quiet: true,
    routes: configRoutes,
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
// sidebar.
async function loadDashboardToggles(): Promise<{
  library: boolean
  content: boolean
  commerce: boolean
  marketing: boolean
  analytics: boolean
  management: boolean
  utilities: boolean
}> {
  const fallback = {
    library: true,
    content: true,
    commerce: true,
    marketing: true,
    analytics: true,
    management: true,
    utilities: true,
  }
  try {
    const mod = await import(projectPath('config/dashboard.ts')) as { default?: { sections?: Record<string, { enabled?: boolean }> } }
    const sections = mod.default?.sections ?? {}
    return {
      library: sections.library?.enabled ?? true,
      content: sections.content?.enabled ?? true,
      commerce: sections.commerce?.enabled ?? true,
      marketing: sections.marketing?.enabled ?? true,
      analytics: sections.analytics?.enabled ?? true,
      management: sections.management?.enabled ?? true,
      utilities: sections.utilities?.enabled ?? true,
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
const baseRoute = dashboardLocalUrl
const sidebarConfig = buildSidebarConfig(baseRoute, discoveredModels, dashboardToggles)
const initialUrl = `http://localhost:${dashboardPort}/home?native-sidebar=1`

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
  console.log(`  ${dim('➜')}  ${dim('Sidebar')}:  ${dim(`${sidebarConfig.sections.length} sections, 240px`)}`)
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

// Import @craft-native/ts dynamically — its static import triggers bun-router
// config loading which prints warnings before our console.log override is active.
const { createApp } = await import('@craft-native/ts')

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
const app = createApp({
  url: initialUrl,
  quiet: !verbose,
  window: {
    title: 'Stacks Dashboard',
    width: 1400,
    height: 900,
    titlebarHidden: true,
    nativeSidebar: true,
    sidebarWidth: 240,
    sidebarConfig,
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
catch (err: any) {
  const fallbackUrl = dashboardHttpsUrl || dashboardLocalUrl
  // eslint-disable-next-line no-console
  console.log(`  ${dim('Dashboard available at:')} ${cyan(fallbackUrl)}\n`)

  // Keep the process running since we're serving via STX
  await new Promise(() => {})
}
