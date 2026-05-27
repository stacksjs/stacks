import type { CLI, DevOptions } from '@stacksjs/types'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import readline from 'node:readline'
import process from 'node:process'
import { bold, cyan, dim, green, intro, log, onUnknownSubcommand, outro, prompts, runCommand, yellow } from "@stacksjs/cli"
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Action } from '@stacksjs/enums'
import { libsPath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { version } from '../../package.json'

/** Local Tools checkout — has non-interactive sudo + `.localhost` hosts skip. */
const TOOLS_RPX_SRC = join(homedir(), 'Code/Tools/rpx/packages/rpx/src/index.ts')

/** Lines printed before the ready banner (`blank`, `stacks … starting…`, `blank`). */
const DEV_BOOT_STARTING_LINE_COUNT = 3

function eraseDevBootStartingLines(): void {
  if (!process.stdout.isTTY)
    return
  for (let i = 0; i < DEV_BOOT_STARTING_LINE_COUNT; i++) {
    readline.moveCursor(process.stdout, 0, -1)
    readline.clearLine(process.stdout, 0)
  }
}

type DevelopmentRpx = typeof import('@stacksjs/rpx')

async function importDevelopmentRpx(): Promise<DevelopmentRpx> {
  if (existsSync(TOOLS_RPX_SRC))
    return await import(TOOLS_RPX_SRC) as DevelopmentRpx
  return await import('@stacksjs/rpx')
}

// rpx registry ids written by this `./buddy dev` session — cleared on shutdown.
let activeRpxRegistryIds: string[] = []

// Lazy-load @stacksjs/actions to avoid triggering bun-router config warnings at CLI startup
let _actions: typeof import('@stacksjs/actions') | undefined
async function actions(): Promise<typeof import('@stacksjs/actions')> {
  if (!_actions) _actions = await import('@stacksjs/actions')
  return _actions
}

export function dev(buddy: CLI): void {
  const descriptions = {
    dev: 'Start development server',
    frontend: 'Start the frontend development server',
    components: 'Start the Components development server',
    desktop: 'Start the Desktop App development server',
    native: 'Start the app in a native Craft window',
    dashboard: 'Start the Dashboard development server',
    api: 'Start the local API development server',
    email: 'Start the Email development server',
    docs: 'Start the Documentation development server',
    systemTray: 'Start the System Tray development server',
    interactive: 'Get asked which development server to start',
    select: 'Which development server are you trying to start?',
    withLocalhost: 'Include the localhost URL in the output',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('dev [server]', descriptions.dev) // server is optional because options can be used
    .option('-f, --frontend', descriptions.frontend)
    .option('-a, --api', descriptions.api)
    .option('-e, --email', descriptions.email)
    .option('-c, --components', descriptions.components)
    .option('-d, --dashboard', descriptions.dashboard)
    .option('-k, --desktop', descriptions.desktop)
    .option('-n, --native', descriptions.native)
    .option('-o, --docs', descriptions.docs)
    .option('-s, --system-tray', descriptions.systemTray)
    .option('-i, --interactive', descriptions.interactive, { default: false })
    .option('-l, --with-localhost', descriptions.withLocalhost, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (server: string | undefined, options: DevOptions) => {

      const perf = Bun.nanoseconds()

      // log.info('Ensuring web server/s running...')

      // // check if port 443 is open
      // const result = await runCommand('lsof -i :443', { silent: true })

      // if (result.isErr)
      //   log.warn('While checking if port 443 is open, we noticed it may be in use')

      // Determine the target server from positional arg or flags
      const target = server
        || (options.frontend ? 'frontend' : undefined)
        || (options.api ? 'api' : undefined)
        || (options.components ? 'components' : undefined)
        || ((options as any).dashboard ? 'dashboard' : undefined)
        || (options.desktop ? 'desktop' : undefined)
        || (options.native ? 'native' : undefined)
        || ((options as any).systemTray || (options as any)['system-tray'] ? 'system-tray' : undefined)
        || (options.docs ? 'docs' : undefined)

      if (target) {
        const serverOptions = { ...options }
        const a = await actions()
        switch (target) {
          case 'native':
            await startDevelopmentServer({ ...serverOptions, native: true }, perf)
            break
          case 'frontend':
            await a.runFrontendDevServer(serverOptions)
            break
          case 'api':
            await a.runApiDevServer(serverOptions)
            break
          case 'components':
            await a.runComponentsDevServer(serverOptions)
            break
          case 'dashboard':
            await a.runDashboardDevServer(serverOptions)
            break
          case 'desktop':
            await a.runDesktopDevServer(serverOptions)
            break
          case 'system-tray':
            await a.runSystemTrayDevServer(serverOptions)
            break
          case 'docs':
            await a.runDocsDevServer(serverOptions)
            break
          default:
            log.error(`Unknown server: ${target}`)
            process.exit(ExitCode.InvalidArgument)
        }
      }
      else if (wantsInteractive(options)) {
        const answer = await (prompts as any)({
          type: 'select',
          name: 'value',
          message: descriptions.select,
          choices: [
            { value: 'all', title: 'All' },
            { value: 'frontend', title: 'Frontend' },
            { value: 'api', title: 'Backend' },
            { value: 'dashboard', title: 'Dashboard' },
            { value: 'desktop', title: 'Desktop' },
            { value: 'native', title: 'Native App' },
            { value: 'email', title: 'Email' },
            { value: 'components', title: 'Components' },
            { value: 'docs', title: 'Documentation' },
          ],
        })

        const selectedValue: string = answer.value

        if (selectedValue === 'components') {
          await (await actions()).runComponentsDevServer(options)
        }
        else if (selectedValue === 'api') {
          await (await actions()).runApiDevServer(options)
        }
        else if (selectedValue === 'dashboard') {
          await (await actions()).runDashboardDevServer(options)
        }
        else if (selectedValue === 'native') {
          await startDevelopmentServer({ ...options, native: true }, perf)
        }
        // else if (selectedValue === 'email')
        //   await runEmailDevServer(options)
        else if (selectedValue === 'docs') {
          await (await actions()).runDocsDevServer(options)
        }
        else {
          log.error('Invalid option during interactive mode')
          process.exit(ExitCode.InvalidArgument)
        }
      }
      else {
        // No specific server requested - start everything
        await startDevelopmentServer(options, perf)
      }

      outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:components', descriptions.components)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {

      const perf = await intro('buddy dev:components')
      const result = await runCommand('bun run dev', {
        cwd: libsPath('components/vue'),
        // silent: !options.verbose,
      })

      if (options.verbose)
        log.info('buddy dev:components result', result)

      if (result.isErr) {
        await outro(
          'While running the dev:components command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:docs', descriptions.docs)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {

      const perf = await intro('buddy dev:docs')
      const result = await (await actions()).runAction(Action.DevDocs, options)

      if (result.isErr) {
        await outro(
          'While running the dev:docs command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:native', descriptions.native)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      const perf = await intro('buddy dev:native')
      await startDevelopmentServer({ ...options, native: true }, perf)
    })

  buddy
    .command('dev:desktop', descriptions.desktop)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {

      const perf = await intro('buddy dev:desktop')
      const result = await (await actions()).runAction(Action.DevDesktop, options)

      if (result.isErr) {
        await outro(
          'While running the dev:desktop command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:api', descriptions.api)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--no-watch-types', 'Skip the model/config type-regeneration watcher', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions & { watchTypes?: boolean }) => {
      const a = await actions()

      // Spawn the model/config watcher as a sidecar. Fire-and-forget:
      // `watchTypes()` returns a promise that only resolves on SIGINT,
      // so awaiting would block the dev server from booting. When the
      // user Ctrl-C's `dev:api`, the SIGINT handler inside watchTypes
      // tears down its fs.watch listeners and the dev server exits in
      // parallel — no orphan listeners, no zombie process.
      //
      // Default-on; pass `--no-watch-types` to skip (e.g. when running
      // a separate `generate:types --watch` in another terminal and
      // you don't want two regen passes per save).
      if (options.watchTypes !== false) {
        a.watchTypes(options as any).catch((err: unknown) => {
          log.warn('[dev:api] type watcher exited:', err as any)
        })
      }

      await a.runApiDevServer(options)
    })

  // buddy
  //   .command('dev:functions', descriptions.api)
  //   .option('-p, --project [project]', descriptions.project, { default: false })//
  //   .option('--verbose', descriptions.verbose, { default: false })
  //   .action(async (options: DevOptions) => {
  //     await runFunctionsDevServer(options)
  //   })

  buddy
    .command('dev:frontend', descriptions.frontend)
    .alias('dev:pages')
    .alias('dev:views')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await (await actions()).runFrontendDevServer(options)
    })

  buddy
    .command('dev:dashboard', descriptions.dashboard)
    .alias('dev:admin')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await (await actions()).runDashboardDevServer(options)
    })

  buddy
    .command('dev:system-tray', descriptions.systemTray)
    .alias('dev:tray')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await (await actions()).runSystemTrayDevServer(options)
    })

  onUnknownSubcommand(buddy, "dev")
}

export async function startDevelopmentServer(_options: DevOptions, _startTime?: number): Promise<void> {
  const options = _options
  const startedAt = _startTime
  const appUrl = process.env.APP_URL
  const nativeMode = options.native === true
  const frontendPort = Number(process.env.PORT) || 3000
  const apiPort = Number(process.env.PORT_API) || 3008
  const docsPort = Number(process.env.PORT_DOCS) || 3006
  const dashboardPort = Number(process.env.PORT_ADMIN) || 3002
  // Dashboard is opt-in. It boots a separate stx-serve process + a craft
  // window when ts-craft is installed, both of which are heavyweight and
  // unnecessary for most app development sessions. Use
  // `STACKS_DEV_DASHBOARD=1 ./buddy dev` (or `./buddy dev:dashboard` to
  // run it standalone) when you actually want the dashboard up.
  const includeDashboard = process.env.STACKS_DEV_DASHBOARD === '1'
  const hasCustomDomain = !nativeMode && appUrl && appUrl !== 'localhost' && !appUrl.includes('localhost:')
  const domain = hasCustomDomain ? appUrl.replace(/^https?:\/\//, '') : null
  const dashboardDomain = domain ? `dashboard.${domain}` : null
  const frontendUrl = domain ? `https://${domain}` : `http://localhost:${frontendPort}`
  const apiUrl = domain ? `https://${domain}/api` : `http://localhost:${apiPort}`
  const docsUrl = domain ? `https://${domain}/docs` : `http://localhost:${docsPort}`
  const dashboardUrl = dashboardDomain ? `https://${dashboardDomain}` : `http://localhost:${dashboardPort}`
  const managedPorts = [
    frontendPort,
    apiPort,
    docsPort,
    ...(includeDashboard ? [dashboardPort] : []),
  ]

  // Signal subprocesses that the main dev server manages the reverse proxy,
  // so they don't start their own (which would conflict on port 443).
  // Suppress early Crosswind/STX/auth config noise — `printDevEngineNotes()` prints after "ready in".
  process.env.STACKS_PROXY_MANAGED = '1'
  process.env.STACKS_DEV_QUIET = '1'

  // Minimal header while backends boot — URLs print once everything is ready.
  console.log()
  console.log(`  ${bold(cyan('stacks'))} ${dim(`v${version}`)}  ${dim('starting…')}`)
  console.log()

  // Pre-flight: clean up orphaned bun processes from prior dev runs that
  // didn't shut down cleanly (`pkill -9` from a foreground terminal exits
  // the parent but leaves detached children holding `:3000`/`:3002`/etc).
  // Without this, the readiness probe sees stale listeners and reports
  // "ready in 0.0s" while the *new* backends never bind because their
  // ports are already taken. Skipped when `STACKS_DEV_NO_KILL` is set
  // (e.g. in CI where there's nothing to clean up).
  if (process.env.STACKS_DEV_NO_KILL !== '1') {
    await cleanupStaleDevProcesses(managedPorts)
  }

  // Mint TLS + start the rpx daemon in parallel with backend boot. Awaiting here
  // would delay every dev server; readiness waits on this promise before writing
  // registry entries.
  const rpxTlsPreflight = hasCustomDomain && domain
    ? prepareRpxTlsForDev({ domain, includeDashboard, options })
    : Promise.resolve()
  // The HTTPS proxy is optional. This preflight is only awaited later (inside the
  // readiness handler, behind the frontend port probe), so without a handler
  // attached now an early failure — e.g. falling back to an @stacksjs/rpx build
  // that predates the TLS helpers `ensureRpxDevelopmentHttps` calls — would
  // surface as an unhandled rejection and kill the dev server before the frontend
  // even binds. The no-op catch keeps it "handled"; the await below still warns
  // and the dev server degrades to http://localhost.
  void rpxTlsPreflight.catch(() => {})

  // Clean up child processes on exit to prevent orphaned processes.
  //
  // Two-phase shutdown: SIGTERM first to give STX serve / rpx / queue
  // workers a chance to flush in-flight writes (sessions table, queue
  // ack, log buffers). If anything is still alive after the grace
  // window we follow up with SIGKILL on the whole process group. The
  // previous "SIGKILL immediately" path corrupted dev sqlite files
  // every now and then because writes were mid-flight.
  let isExiting = false
  let closeNativeApp: (() => void) | undefined
  const SHUTDOWN_GRACE_MS = 1500
  const cleanup = () => {
    if (isExiting) return
    isExiting = true
    closeNativeApp?.()
    void unregisterRpxProxies(activeRpxRegistryIds)
    activeRpxRegistryIds.length = 0
    try { process.kill(-process.pid, 'SIGTERM') }
    catch {
      // Process group may not exist (e.g., not session leader) — try the
      // current process only. Worst case the inner SIGKILL below cleans up.
      try { process.kill(0, 'SIGTERM') } catch { /* ignore */ }
    }
    setTimeout(() => {
      try { process.kill(0, 'SIGKILL') }
      catch { process.exit(1) }
    }, SHUTDOWN_GRACE_MS).unref()
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Start all servers silently — unified banner above handles output
  const quietOpts = { ...options, quiet: true }
  const a = await actions()

  // Background readiness probes. Each resolves when the backend port accepts
  // a TCP connection so the "ready in N ms" line below reflects the time at
  // which the URLs above actually serve traffic — not just when the spawn
  // calls returned. Probes run in parallel with the servers themselves.
  const ports = [
    { name: 'Frontend', port: frontendPort },
    { name: 'API', port: apiPort },
    { name: 'Docs', port: docsPort },
    ...(includeDashboard ? [{ name: 'Dashboard', port: dashboardPort }] : []),
  ]
  const readinessTimeoutMs = 30000
  let readyAnnounced = false
  const nativeUrl = `http://localhost:${frontendPort}`
  const nativeWindowReady = nativeMode
    ? waitForPort(frontendPort, readinessTimeoutMs).then(async (ready) => {
      if (!ready) {
        log.warn(`Native window skipped because the frontend did not answer within ${readinessTimeoutMs / 1000}s`)
        return
      }

      closeNativeApp = await launchNativeAppWindow(nativeUrl, options)
    })
    : Promise.resolve()

  Promise.all(ports.map(p => waitForPort(p.port, readinessTimeoutMs)))
    .then(async (results) => {
      if (readyAnnounced) return
      readyAnnounced = true

      const failed = results
        .map((ok, i) => ok ? null : ports[i].name)
        .filter((x): x is string => x !== null)

      if (hasCustomDomain && domain) {
        try {
          await rpxTlsPreflight
          await registerRpxProxiesForDomain({
            domain,
            frontendPort,
            apiPort,
            docsPort,
            dashboardPort,
            includeDashboard,
            options,
          })
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.log(`  ${yellow('⚠')}  ${yellow('HTTPS proxy unavailable')}: ${message}`)
          console.log(`  ${dim('    ')}${dim('Use http://localhost:3000 or set SUDO_PASSWORD in .env and restart `./buddy dev`')}`)
          if (options.verbose)
            console.log(`  ${dim('    ')}${dim(`Trust CA: sh ${join(RPX_SSL_DIR, 'trust-rpx-cert.sh')}`)}`)
        }
      }

      eraseDevBootStartingLines()

      printDevReadyBanner({
        options,
        nativeMode,
        hasCustomDomain,
        frontendUrl,
        apiUrl,
        docsUrl,
        dashboardUrl,
        frontendPort,
        apiPort,
        docsPort,
        includeDashboard,
        domain,
        dashboardPort,
        dashboardDomain,
      })

      if (startedAt) {
        const elapsedMs = (Bun.nanoseconds() - startedAt) / 1_000_000
        const summary = failed.length
          ? `ready in ${(elapsedMs / 1000).toFixed(1)}s — ${failed.join(', ')} did not bind within ${readinessTimeoutMs / 1000}s`
          : `ready in ${(elapsedMs / 1000).toFixed(1)}s`
        console.log(`  ${dim(summary)}`)
        console.log()
        printDevEngineNotes()
        console.log()
      }

      if (process.env.STACKS_PRINT_ROUTES === '1') {
        await printRegisteredRoutes(apiPort).catch(() => { /* best effort */ })
      }
    })
    .catch(() => { /* swallow — verbose-mode error handlers below already log */ })

  await Promise.all([
    a.runFrontendDevServer(quietOpts).catch((error) => {
      if (options.verbose)
        log.error(`Frontend: ${error}`)
    }),
    a.runApiDevServer(quietOpts).catch((error) => {
      if (options.verbose)
        log.error(`API: ${error}`)
    }),
    a.runDocsDevServer(quietOpts).catch((error) => {
      if (options.verbose)
        log.error(`Docs: ${error}`)
    }),
    includeDashboard
      ? a.runDashboardDevServer(quietOpts).catch((error) => {
        if (options.verbose)
          log.error(`Dashboard: ${error}`)
      })
      : Promise.resolve(),
    nativeWindowReady.catch((error) => {
      if (options.verbose)
        log.warn(`Native window: ${error}`)
    }),
  ])
}

function printDevReadyBanner(input: {
  options: DevOptions
  nativeMode: boolean
  hasCustomDomain: boolean
  frontendUrl: string
  apiUrl: string
  docsUrl: string
  dashboardUrl: string
  frontendPort: number
  apiPort: number
  docsPort: number
  includeDashboard: boolean
  domain: string | null
  dashboardPort: number
  dashboardDomain: string | null
}): void {
  const {
    options,
    nativeMode,
    hasCustomDomain,
    frontendUrl,
    apiUrl,
    docsUrl,
    dashboardUrl,
    frontendPort,
    apiPort,
    docsPort,
    includeDashboard,
    domain,
    dashboardPort,
    dashboardDomain,
  } = input
  const verbose = options.verbose ?? false
  const showLocalUrls = verbose || options.withLocalhost === true

  console.log()
  console.log(`  ${green('➜')}  ${bold('Frontend')}:    ${cyan(frontendUrl)}`)
  if (showLocalUrls)
    console.log(`  ${dim('➜')}  ${dim('Local')}:       ${dim(`http://localhost:${frontendPort}`)}`)
  if (nativeMode)
    console.log(`  ${green('➜')}  ${bold('Native')}:      ${cyan(`Craft → http://localhost:${frontendPort}`)}`)
  console.log(`  ${green('➜')}  ${bold('API')}:         ${cyan(apiUrl)}`)
  if (showLocalUrls)
    console.log(`  ${dim('➜')}  ${dim('Local API')}:   ${dim(`http://localhost:${apiPort}`)}`)
  console.log(`  ${green('➜')}  ${bold('Docs')}:        ${cyan(docsUrl)}`)
  if (showLocalUrls)
    console.log(`  ${dim('➜')}  ${dim('Local docs')}:  ${dim(`http://localhost:${docsPort}`)}`)
  if (includeDashboard)
    console.log(`  ${green('➜')}  ${bold('Dashboard')}:   ${cyan(dashboardUrl)}`)
  if (verbose && domain) {
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${frontendPort} → ${domain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`${frontendUrl}/api → localhost:${apiPort}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`${frontendUrl}/docs → localhost:${docsPort}`)}`)
    if (includeDashboard)
      console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${dashboardPort} → ${dashboardDomain}`)}`)
  }
  console.log()
}

/** Post-ready notes from frontend tooling (Crosswind, STX routes) in a consistent style. */
function printDevEngineNotes(): void {
  const routesFile = join(projectPath(), '.stx/routes.ts')
  const crosswindConfig = join(projectPath(), 'config/crosswind.ts')
  const hasCrosswind = existsSync(crosswindConfig)
    || existsSync(join(projectPath(), 'crosswind.config.ts'))

  if (hasCrosswind)
    console.log(`  ${green('[Crosswind]')} ${dim('CSS engine loaded')}`)

  if (existsSync(routesFile)) {
    try {
      const source = readFileSync(routesFile, 'utf8')
      const routeCount = (source.match(/pattern:/g) ?? []).length
      if (routeCount > 0)
        console.log(`  ${green('[stx]')} ${dim(`Generated ${routeCount} routes → .stx/routes.ts`)}`)
    }
    catch {
      console.log(`  ${green('[stx]')} ${dim('Routes manifest → .stx/routes.ts')}`)
    }
  }
}

async function launchNativeAppWindow(url: string, options: DevOptions): Promise<(() => void) | undefined> {
  let createApp: ((_opts: any) => { show: () => Promise<void>, close: () => void }) | undefined

  try {
    const craft = await importCraftSdk()
    createApp = craft.createApp
  }
  catch (error) {
    if (options.verbose)
      log.warn(`Native window unavailable: ${error}`)

    console.log(`  ${dim('Native window unavailable. Install craft-native or set CRAFT_BIN to a Craft binary.')}\n`)
    return undefined
  }

  if (!createApp) {
    console.log(`  ${dim('Native window unavailable. The Craft SDK did not export createApp.')}\n`)
    return undefined
  }

  const craftBinaryPath = resolveCraftBinaryPath()
  if (!craftBinaryPath) {
    console.log(`  ${dim('Native window unavailable. Set CRAFT_BIN to a Craft binary, or install Craft in ~/Code/Tools/craft.')}\n`)
    return undefined
  }

  const appIconPath = resolveNativeAppIconPath()
  const app = createApp({
    url,
    quiet: !options.verbose,
    craftPath: craftBinaryPath,
    window: {
      title: await resolveNativeAppTitle(),
      width: 1280,
      height: 860,
      titlebarHidden: true,
      webSidebarMaterial: true,
      webSidebarWidth: 286,
      webSidebarMaterialOpacity: 0.78,
      ...(appIconPath && { icon: appIconPath }),
    },
  })

  app.show().catch((error) => {
    if (options.verbose)
      log.warn(`Native window exited: ${error}`)
  })

  return () => app.close()
}

async function importCraftSdk(): Promise<{ createApp?: (_opts: any) => { show: () => Promise<void>, close: () => void } }> {
  const localCraftSdk = process.env.HOME
    ? `${process.env.HOME}/Code/Tools/craft/packages/typescript/src/index.ts`
    : undefined

  if (localCraftSdk && existsSync(localCraftSdk))
    return await import(localCraftSdk)

  try {
    return await import('craft-native')
  }
  catch (primaryError) {
    try {
      return await import('@craft-native/craft')
    }
    catch {
      try {
        return await import('@stacksjs/ts-craft')
      }
      catch {
        throw primaryError
      }
    }
  }
}

async function cleanupStaleDevProcesses(ports: number[]): Promise<void> {
  const projectRoot = projectPath()
  const actionDevPath = projectPath('storage/framework/core/actions/src/dev/')
  const pids = new Set<number>()

  for (const port of ports) {
    for (const pid of await listenerPids(port)) {
      if (pid === process.pid)
        continue

      const command = await commandForPid(pid)
      if (!command.includes(projectRoot))
        continue

      const isStacksDevProcess = command.includes('storage/framework/core/buddy/src/cli.ts dev')
        || command.includes('storage/framework/core/actions/src/dev/')
        || command.includes(actionDevPath)

      if (isStacksDevProcess)
        pids.add(pid)
    }
  }

  if (pids.size === 0)
    return

  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM') }
    catch { /* stale process already exited */ }
  }

  await new Promise(r => setTimeout(r, 250))

  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL') }
    catch { /* stale process already exited */ }
  }

  await new Promise(r => setTimeout(r, 150))
}

async function listenerPids(port: number): Promise<number[]> {
  try {
    const proc = Bun.spawn(['lsof', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited

    return output
      .split(/\s+/)
      .map(value => Number(value))
      .filter(pid => Number.isInteger(pid) && pid > 0)
  }
  catch {
    return []
  }
}

async function commandForPid(pid: number): Promise<string> {
  try {
    const proc = Bun.spawn(['ps', '-p', String(pid), '-o', 'command='], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    return output.trim()
  }
  catch {
    return ''
  }
}

function resolveCraftBinaryPath(): string | undefined {
  const home = process.env.HOME
  const candidates = [
    process.env.CRAFT_BIN,
    home ? `${home}/Code/Tools/craft/craft` : undefined,
    home ? `${home}/Code/Tools/craft/bin/craft` : undefined,
    home ? `${home}/Code/Tools/craft/packages/zig/zig-out/bin/craft` : undefined,
    home ? `${home}/Documents/Projects/craft/packages/zig/zig-out/bin/craft` : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate))

  return candidates.find(candidate => existsSync(candidate))
}

function resolveNativeAppIconPath(): string | undefined {
  const candidates = [
    projectPath('resources/assets/images/app-icon.png'),
    projectPath('resources/assets/images/icon.png'),
    projectPath('public/icon.png'),
  ]

  return candidates.find(candidate => existsSync(candidate))
}

async function resolveNativeAppTitle(): Promise<string> {
  try {
    const pkg = await Bun.file(projectPath('package.json')).json()
    const name = typeof pkg.productName === 'string' ? pkg.productName : pkg.name

    if (typeof name === 'string' && name.length > 0) {
      return name
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    }
  }
  catch {
    // package.json is optional for framework internals.
  }

  return 'Stacks App'
}

const METHOD_COLORS: Record<string, (s: string) => string> = {
  GET: cyan,
  POST: green,
  PUT: cyan,
  PATCH: cyan,
  DELETE: cyan,
  OPTIONS: dim,
}

/**
 * Hit the API server's `/__routes` introspection endpoint and print a
 * compact table of registered routes. Skips silently if the endpoint
 * isn't available (e.g. a custom server that doesn't expose it) — the
 * dev server stays usable either way.
 */
async function printRegisteredRoutes(apiPort: number): Promise<void> {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 1500)
    const res = await fetch(`http://127.0.0.1:${apiPort}/__routes`, { signal: ac.signal }).catch(() => null)
    clearTimeout(t)
    if (!res || !res.ok) return
    const routes = (await res.json()) as Array<{ method: string, path: string, name?: string }>
    if (!Array.isArray(routes) || routes.length === 0) return

    const sorted = [...routes].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
    const longestPath = Math.max(...sorted.map(r => r.path.length))
    console.log(`  ${dim('Registered routes')}\n`)
    for (const r of sorted) {
      const color = METHOD_COLORS[r.method.toUpperCase()] ?? dim
      const method = color(r.method.toUpperCase().padEnd(6))
      const path = r.path.padEnd(longestPath)
      const named = r.name ? `  ${dim(`(${r.name})`)}` : ''
      console.log(`  ${method}  ${path}${named}`)
    }
    console.log()
  }
  catch {
    /* probe failed — never block the dev server on this */
  }
}

/**
 * Resolve `true` once an HTTP request to localhost:port returns *any*
 * response (including 404, 500 — we just want to confirm the server is
 * actually fielding requests, not just bound to the socket). A TCP-only
 * probe was insufficient: stx serve and bun-router can hold the FD in
 * LISTEN state for seconds before their request handler is wired, and
 * the rpx proxy ALSO binds the upstream port (so a TCP probe was getting
 * fooled by the proxy itself, not the backend behind it).
 *
 * Returns `false` if no HTTP response arrives before `timeoutMs`.
 */
async function probeDevServerHttp(port: number): Promise<boolean> {
  for (const path of ['/__health', '/']) {
    const ok = await new Promise<boolean>((resolve) => {
      const ac = new AbortController()
      // First stx request can block on Crosswind compile — allow several seconds.
      const t = setTimeout(() => ac.abort(), path === '/' ? 8000 : 800)
      fetch(`http://127.0.0.1:${port}${path}`, { signal: ac.signal, redirect: 'manual' })
        .then(() => { clearTimeout(t); resolve(true) })
        .catch(() => { clearTimeout(t); resolve(false) })
    })
    if (ok)
      return true
  }
  return false
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await probeDevServerHttp(port))
      return true
    await new Promise(r => setTimeout(r, 250))
  }
  return false
}

/**
 * Resolve how to start the rpx daemon. Buddy is invoked as `bun …/buddy`, so
 * rpx's default spawn (`process.argv[1] + 'daemon:start'`) would incorrectly
 * run `buddy daemon:start`. The published `dist/bin/cli.js` also ships a
 * duplicate shebang that Bun 1.3.x rejects — prefer a compiled `rpx` binary
 * or our bootstrap script.
 */
const RPX_SSL_DIR = join(homedir(), '.stacks', 'ssl')
const RPX_ROOT_CA_PATH = join(RPX_SSL_DIR, 'rpx-root-ca.crt')
const RPX_HOST_CERT_PATH = join(RPX_SSL_DIR, 'rpx.localhost.crt')
const LOGIN_KEYCHAIN = join(homedir(), 'Library/Keychains/login.keychain-db')

function normalizeSha256Fingerprint(raw: string): string {
  const value = raw.includes('=') ? raw.split('=').pop()! : raw
  return value.replace(/SHA-256\s+hash:\s*/gi, '').replace(/:/g, '').trim().toUpperCase()
}

function readCertFingerprint(certPath: string): string | null {
  try {
    const out = execSync(`openssl x509 -noout -fingerprint -sha256 -in "${certPath}"`, { encoding: 'utf8' })
    return normalizeSha256Fingerprint(out)
  }
  catch {
    return null
  }
}

/**
 * True when the on-disk rpx Root CA fingerprint appears in a keychain Chrome/Safari use.
 */
function isRpxRootCaInKeychain(caPath: string): boolean {
  const fp = readCertFingerprint(caPath)
  if (!fp)
    return false

  const keychains = [
    '/Library/Keychains/System.keychain',
    LOGIN_KEYCHAIN,
  ]

  for (const keychain of keychains) {
    try {
      const listing = execSync(`security find-certificate -a -Z "${keychain}" 2>/dev/null || true`, { encoding: 'utf8' })
      for (const line of listing.split('\n')) {
        if (line.toUpperCase().includes('SHA-256') && normalizeSha256Fingerprint(line) === fp)
          return true
      }
    }
    catch { /* try next keychain */ }
  }

  return false
}

function execSudoSh(command: string): void {
  const sudoPassword = process.env.SUDO_PASSWORD
  const escaped = command.replace(/'/g, `'\\''`)
  if (sudoPassword)
    execSync(`echo '${sudoPassword}' | sudo -S sh -c '${escaped}' 2>/dev/null`, { stdio: ['pipe', 'pipe', 'pipe'] })
  else
    execSync(`sudo -n sh -c '${escaped}'`, { stdio: ['pipe', 'pipe', 'pipe'] })
}

/** Chrome/Edge need SSL + basic trust policies — plain trustRoot often leaves "trust settings: 0". */
const MACOS_CA_TRUST_FLAGS = '-d -r trustRoot -p ssl -p basic'

function listRpxRootCaHashesInKeychain(keychain: string): string[] {
  const listing = execSync(
    `security find-certificate -a -c "rpx.localhost" -Z "${keychain}" 2>/dev/null || true`,
    { encoding: 'utf8' },
  )
  const hashes: string[] = []
  for (const line of listing.split('\n')) {
    const match = line.match(/SHA-256 hash:\s*([A-F0-9]+)/i)
    if (match)
      hashes.push(match[1]!.toUpperCase())
  }
  return hashes
}

function pruneStaleRpxRootCas(caPath: string): void {
  if (process.platform !== 'darwin')
    return

  const keep = readCertFingerprint(caPath)
  if (!keep)
    return

  for (const keychain of ['/Library/Keychains/System.keychain', LOGIN_KEYCHAIN]) {
    for (const hash of listRpxRootCaHashesInKeychain(keychain)) {
      if (hash === keep)
        continue
      try {
        if (keychain.startsWith('/Library'))
          execSudoSh(`security delete-certificate -Z ${hash} "${keychain}"`)
        else
          execSync(`security delete-certificate -Z ${hash} "${keychain}"`, { stdio: 'ignore' })
      }
      catch { /* already removed */ }
    }
  }
}

function isRpxRootCaTrustedForSsl(caPath: string, serverName: string): boolean {
  if (process.platform !== 'darwin')
    return isRpxRootCaInKeychain(caPath)

  try {
    const out = execSync(
      `security verify-cert -c "${caPath}" -s "${serverName}" -l -L -R ssl 2>&1`,
      { encoding: 'utf8' },
    )
    return out.includes('successful')
  }
  catch {
    return false
  }
}

function trustRpxRootCaForBrowsers(caPath: string, serverName: string): boolean {
  if (process.platform !== 'darwin')
    return false

  pruneStaleRpxRootCas(caPath)

  try {
    execSync(
      `security add-trusted-cert ${MACOS_CA_TRUST_FLAGS} -k "${LOGIN_KEYCHAIN}" "${caPath}"`,
      { stdio: 'ignore' },
    )
  }
  catch { /* may already exist — re-apply trust below */ }

  try {
    execSudoSh(`security add-trusted-cert ${MACOS_CA_TRUST_FLAGS} -k /Library/Keychains/System.keychain "${caPath}"`)
  }
  catch {
    return false
  }

  return isRpxRootCaTrustedForSsl(caPath, serverName)
    || isRpxRootCaInKeychain(caPath)
}

/**
 * True when :443 presents a chain signed by the current ~/.stacks/ssl/rpx-root-ca.crt.
 */
function isLiveHttpsChainValid(domain: string): boolean {
  if (!existsSync(RPX_ROOT_CA_PATH))
    return false

  try {
    const out = execSync(
      `echo | openssl s_client -connect ${domain}:443 -servername ${domain} -CAfile "${RPX_ROOT_CA_PATH}" 2>/dev/null | grep "Verify return code"`,
      { encoding: 'utf8', timeout: 4000 },
    )
    return out.includes(': 0 (ok)')
  }
  catch {
    return false
  }
}

function buildDevelopmentTlsHostnames(domain: string, includeDashboard: boolean): string[] {
  // App domain must be first — it becomes the cert CN. Safari/Chrome surface CN in
  // “cert is for …” errors even when SANs are present.
  return [
    domain,
    ...(includeDashboard ? [`dashboard.${domain}`] : []),
    'rpx.localhost',
  ]
}

function readCertCommonName(certPath: string): string | null {
  try {
    const subject = execSync(`openssl x509 -in "${certPath}" -noout -subject -nameopt RFC2253`, { encoding: 'utf8' })
    const match = subject.match(/CN=([^,/]+)/)
    return match?.[1]?.trim() ?? null
  }
  catch {
    return null
  }
}

function buildDevelopmentTlsOptions(domain: string, includeDashboard: boolean, verbose: boolean) {
  const hostnames = buildDevelopmentTlsHostnames(domain, includeDashboard)
  return {
    https: {
      certPath: RPX_HOST_CERT_PATH,
      keyPath: join(RPX_SSL_DIR, 'rpx.localhost.key'),
      caCertPath: join(RPX_SSL_DIR, 'rpx.localhost.ca.crt'),
      commonName: domain,
    },
    verbose,
    regenerateUntrustedCerts: true,
    proxies: hostnames.map(to => ({ from: 'localhost:1', to })),
  } as Parameters<typeof import('@stacksjs/rpx').generateCertificate>[0]
}

/**
 * Mint (if needed), trust, and align the rpx daemon TLS material with APP_URL.
 * Chrome requires each `<app>.localhost` hostname in the cert SAN — `*.localhost`
 * alone triggers ERR_CERT_COMMON_NAME_INVALID.
 */
async function ensureRpxDevelopmentHttps(
  domain: string,
  options: DevOptions,
  includeDashboard: boolean,
): Promise<void> {
  const verbose = options.verbose ?? false
  const {
    checkExistingCertificates,
    clearSslConfigCache,
    forceTrustCertificate,
    generateCertificate,
    isDaemonRunning,
    stopDaemon,
  } = await importDevelopmentRpx()

  const hostnames = buildDevelopmentTlsHostnames(domain, includeDashboard)
  const tlsOptions = buildDevelopmentTlsOptions(domain, includeDashboard, verbose)

  const hostnameInCert = hostnames.every((host) => {
    try {
      const text = execSync(`openssl x509 -in "${RPX_HOST_CERT_PATH}" -noout -text`, { encoding: 'utf8' })
      return text.includes(`DNS:${host}`)
    }
    catch {
      return false
    }
  })
  const cnMatchesApp = readCertCommonName(RPX_HOST_CERT_PATH) === domain

  let certRegenerated = false
  const existing = await checkExistingCertificates(tlsOptions)
  if (!existing || !hostnameInCert || !cnMatchesApp) {
    clearSslConfigCache()
    await generateCertificate({ ...tlsOptions, forceRegenerate: true } as Parameters<typeof generateCertificate>[0])
    certRegenerated = true
  }

  let trusted = isRpxRootCaTrustedForSsl(RPX_ROOT_CA_PATH, domain)
  if (!trusted) {
    trusted = trustRpxRootCaForBrowsers(RPX_ROOT_CA_PATH, domain)
      || await forceTrustCertificate(RPX_ROOT_CA_PATH, { serverName: domain, verbose })
      || isRpxRootCaTrustedForSsl(RPX_ROOT_CA_PATH, domain)
    if (trusted)
      console.log(`  ${green('✓')}  ${dim('HTTPS')}:         ${dim('Local CA trusted — reload the browser if you still see a warning')}`)
    else
      console.log(`  ${yellow('⚠')}  ${yellow('HTTPS')}:         ${yellow(`Local CA not trusted — run: sh ${join(RPX_SSL_DIR, 'trust-rpx-cert.sh')}`)}`)
  }
  else if (verbose) {
    console.log(`  ${green('✓')}  ${dim('HTTPS')}:         ${dim('Local certificate trusted for SSL')}`)
  }

  const chainOk = isLiveHttpsChainValid(domain)

  // Stop a running daemon only when TLS material changed — registerRpxProxiesForDomain
  // starts the daemon afterward. Do not stop merely because chainOk is false while
  // :443 is still coming up; that race caused ensureDaemonRunning to time out.
  if ((certRegenerated || !hostnameInCert || !cnMatchesApp) && await isDaemonRunning()) {
    await stopDaemon({ timeoutMs: 8000 }).catch(() => { /* stale pid */ })
    if (verbose)
      log.info('Restarting rpx daemon to load TLS certificates for this app')
  }
  else if (!chainOk && verbose) {
    console.log(`  ${dim('    ')}${dim('HTTPS chain not yet valid on :443 — daemon will (re)start after backends are ready')}`)
  }
}

/**
 * Working directory for the rpx daemon child. Must NOT be the Stacks app root —
 * Bun would load the app's `bunfig.toml` / preloader and the daemon never binds :443.
 */
function resolveRpxDaemonSpawnCwd(): string {
  const fromEnv = process.env.RPX_BIN || process.env.STACKS_RPX_BIN
  if (fromEnv && existsSync(fromEnv))
    return dirname(fromEnv)

  const toolsPkg = join(homedir(), 'Code/Tools/rpx/packages/rpx')
  if (existsSync(join(toolsPkg, 'package.json')))
    return toolsPkg

  const bootstrap = join(dirname(fileURLToPath(import.meta.url)), '../scripts/rpx-daemon-bootstrap.ts')
  if (existsSync(bootstrap))
    return dirname(bootstrap)

  return homedir()
}

async function resolveRpxDaemonSpawnCommand(): Promise<string[]> {
  // Bootstrap first — never loads the app's Bun preloader.
  const bootstrap = join(dirname(fileURLToPath(import.meta.url)), '../scripts/rpx-daemon-bootstrap.ts')
  if (existsSync(bootstrap))
    return [process.execPath, bootstrap]

  const fromEnv = process.env.RPX_BIN || process.env.STACKS_RPX_BIN
  if (fromEnv && existsSync(fromEnv))
    return [fromEnv, 'daemon:start']

  const toolsCli = join(homedir(), 'Code/Tools/rpx/packages/rpx/bin/cli.ts')
  if (existsSync(toolsCli))
    return [process.execPath, toolsCli, 'daemon:start']

  const toolsBinary = join(homedir(), 'Code/Tools/rpx/packages/rpx/bin/rpx')
  if (existsSync(toolsBinary))
    return [toolsBinary, 'daemon:start']

  const pkgUrl = import.meta.resolve('@stacksjs/rpx/package.json')
  const cli = join(dirname(fileURLToPath(pkgUrl)), 'dist/bin/cli.js')
  return [process.execPath, cli, 'daemon:start']
}

type RpxProxySpec = {
  id: string
  from: string
  to: string
  pathRewrites?: Array<{ from: string, to: string, stripPrefix?: boolean }>
}

function buildRpxProxySpecs(input: {
  domain: string
  frontendPort: number
  apiPort: number
  docsPort: number
  dashboardPort: number
  includeDashboard: boolean
}): RpxProxySpec[] {
  const { domain, frontendPort, apiPort, docsPort, dashboardPort, includeDashboard } = input
  const dashboardDomain = `dashboard.${domain}`

  return [
    // Path-based routing on the app host (https://app.localhost/api, /docs).
    // /api: preserve prefix — routes are registered under /api (stacksjs/stacks#1835).
    // /docs: strip prefix — BunPress serves from / on the docs port.
    {
      id: `${domain}-frontend`,
      from: `localhost:${frontendPort}`,
      to: domain,
      pathRewrites: [
        { from: '/api', to: `localhost:${apiPort}`, stripPrefix: false },
        { from: '/docs', to: `localhost:${docsPort}`, stripPrefix: true },
      ],
    },
    ...(includeDashboard
      ? [{ id: `${domain}-dashboard`, from: `localhost:${dashboardPort}`, to: dashboardDomain }]
      : []),
  ]
}

async function unregisterRpxProxies(ids: string[]): Promise<void> {
  if (ids.length === 0)
    return
  try {
    const { removeEntry } = await importDevelopmentRpx()
    for (const id of ids)
      await removeEntry(id).catch(() => { /* already gone */ })
  }
  catch { /* rpx not installed */ }
}

/**
 * Update /etc/hosts and align TLS material while backends boot. The daemon is
 * started in `registerRpxProxiesForDomain` once HTTP ports are ready.
 */
async function prepareRpxTlsForDev(input: {
  domain: string
  includeDashboard: boolean
  options: DevOptions
}): Promise<void> {
  const { domain, includeDashboard, options } = input
  const verbose = options.verbose ?? false
  const hosts = [
    domain,
    ...(includeDashboard ? [`dashboard.${domain}`] : []),
  ]

  // `.localhost` resolves to 127.0.0.1 without /etc/hosts (RFC 6761). Only
  // custom TLDs need hosts entries — and only when we can do so non-interactively.
  const hostsNeedingFile = hosts.filter((host) => {
    const h = host.trim().toLowerCase()
    return h !== 'localhost' && !h.endsWith('.localhost') && !h.endsWith('.localhost.')
  })

  if (hostsNeedingFile.length > 0) {
    const { addHosts } = await importDevelopmentRpx()
    await addHosts(hostsNeedingFile, verbose).catch((err) => {
      log.warn(`Could not update /etc/hosts for ${hostsNeedingFile.join(', ')}: ${(err as Error).message}`)
      log.warn('Add 127.0.0.1 entries manually or set SUDO_PASSWORD in .env')
    })
  }

  await ensureRpxDevelopmentHttps(domain, options, includeDashboard)
}

async function startRpxDaemonIfNeeded(input: {
  spawnCommand: string[]
  spawnEnv?: Record<string, string>
  verbose: boolean
  stopRpx: (opts: { timeoutMs: number }) => Promise<unknown>
}): Promise<void> {
  const { ensureDaemonRunning, isDaemonRunning: isRpxUp } = await importDevelopmentRpx()
  if (await isRpxUp())
    return

  const spawnOpts = {
    spawnCommand: input.spawnCommand,
    spawnCwd: resolveRpxDaemonSpawnCwd(),
    startupTimeoutMs: 45_000,
    spawnEnv: input.spawnEnv,
    verbose: input.verbose,
  }

  try {
    await ensureDaemonRunning(spawnOpts)
  }
  catch (firstError) {
    await input.stopRpx({ timeoutMs: 5000 }).catch(() => { /* stale */ })
    await ensureDaemonRunning(spawnOpts).catch(() => { throw firstError })
  }
}

/**
 * Register proxy routes with the rpx daemon. Entries are written **without**
 * a pid so the daemon's PID-GC does not delete them when a short-lived parent
 * exits — we unregister explicitly on `./buddy dev` shutdown instead.
 */
async function registerRpxProxiesForDomain(input: {
  domain: string
  frontendPort: number
  apiPort: number
  docsPort: number
  dashboardPort: number
  includeDashboard: boolean
  options: DevOptions
}): Promise<void> {
  const { domain, frontendPort, apiPort, docsPort, dashboardPort, includeDashboard, options } = input
  const verbose = options.verbose ?? false
  const proxies = buildRpxProxySpecs({ domain, frontendPort, apiPort, docsPort, dashboardPort, includeDashboard })

  // Drop legacy subdomain proxies from older dev sessions (api./docs. hosts).
  await unregisterRpxProxies([`${domain}-api`, `${domain}-docs`])

  const { stopDaemon: stopRpx, writeEntry } = await importDevelopmentRpx()
  const spawnCommand = await resolveRpxDaemonSpawnCommand()
  const spawnEnv = process.env.SUDO_PASSWORD
    ? { SUDO_PASSWORD: process.env.SUDO_PASSWORD }
    : undefined

  try {
    await startRpxDaemonIfNeeded({ spawnCommand, spawnEnv, verbose, stopRpx })
  }
  catch (error) {
    const { isDaemonRunning } = await importDevelopmentRpx()
    if (!(await isDaemonRunning()))
      throw error
    if (verbose) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`  ${dim('    ')}${dim(`rpx daemon spawn skipped (${message}); reusing existing daemon`)}`)
    }
  }

  const createdAt = new Date().toISOString()
  for (const proxy of proxies) {
    await writeEntry({
      id: proxy.id,
      from: proxy.from,
      to: proxy.to,
      cwd: process.cwd(),
      createdAt,
      pathRewrites: proxy.pathRewrites,
    }, undefined, verbose)
    if (!activeRpxRegistryIds.includes(proxy.id))
      activeRpxRegistryIds.push(proxy.id)
    if (verbose)
      console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`https://${proxy.to} → ${proxy.from}`)}`)
  }
}

function wantsInteractive(options: DevOptions) {
  return options.interactive
}
