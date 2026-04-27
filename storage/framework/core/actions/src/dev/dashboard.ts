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
  // Pre-warm `ts-broadcasting` so stx's static import of it lands cached.
  // See dev/views.ts for the full reasoning — clarity@0.3.24's TLA stalls
  // the chain when it's hit transitively through stx.
  try {
    await import('ts-broadcasting')
  }
  catch {
    // optional — keep going if missing
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

  // serve() starts a long-lived server — do NOT await it.
  // It resolves only when the server stops, which is never during dev.
  const serverPromise = serve({
    patterns: [userDashboardPagesPath, dashboardPagesPath],
    port: dashboardPort,
    componentsDir: storagePath('framework/defaults/resources/components/Dashboard'),
    layoutsDir: dashboardPath,
    partialsDir: dashboardPath,
    quiet: true,
  })

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

// Write manifest
const manifestPath = storagePath('framework/defaults/views/dashboard/.discovered-models.json')
writeFileSync(manifestPath, JSON.stringify(buildManifest(discoveredModels), null, 2))

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
const sidebarConfig = buildSidebarConfig(baseRoute, discoveredModels)
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
