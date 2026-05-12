import type { CLI, DevOptions } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { bold, cyan, dim, green, intro, log, onUnknownSubcommand, outro, prompts, runCommand } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { libsPath, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { version } from '../../package.json'

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
  const apiDomain = domain ? `api.${domain}` : null
  const docsDomain = domain ? `docs.${domain}` : null
  const dashboardDomain = domain ? `dashboard.${domain}` : null
  const frontendUrl = domain ? `https://${domain}` : `http://localhost:${frontendPort}`
  const apiUrl = apiDomain ? `https://${apiDomain}` : `http://localhost:${apiPort}`
  const docsUrl = docsDomain ? `https://${docsDomain}` : `http://localhost:${docsPort}`
  const dashboardUrl = dashboardDomain ? `https://${dashboardDomain}` : `http://localhost:${dashboardPort}`
  const managedPorts = [
    frontendPort,
    apiPort,
    docsPort,
    ...(includeDashboard ? [dashboardPort] : []),
  ]

  // Print Vite-style unified output. Banner first so the user has the URLs
  // while servers boot — the "ready" line lands later, once each backend
  // actually accepts a TCP connection on its port.
  console.log()
  console.log(`  ${bold(cyan('stacks'))} ${dim(`v${version}`)}`)
  console.log()
  console.log(`  ${green('➜')}  ${bold('Frontend')}:    ${cyan(frontendUrl)}`)
  if (nativeMode) {
    console.log(`  ${green('➜')}  ${bold('Native')}:      ${cyan(`Craft → http://localhost:${frontendPort}`)}`)
  }
  console.log(`  ${green('➜')}  ${bold('API')}:         ${cyan(apiUrl)}`)
  console.log(`  ${green('➜')}  ${bold('Docs')}:        ${cyan(docsUrl)}`)
  if (includeDashboard) {
    console.log(`  ${green('➜')}  ${bold('Dashboard')}:   ${cyan(dashboardUrl)}`)
  }
  if (options.verbose && domain) {
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${frontendPort} → ${domain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${apiPort} → ${apiDomain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${docsPort} → ${docsDomain}`)}`)
    if (includeDashboard) {
      console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${dashboardPort} → ${dashboardDomain}`)}`)
    }
  }
  console.log()

  // Signal subprocesses that the main dev server manages the reverse proxy,
  // so they don't start their own (which would conflict on port 443)
  process.env.STACKS_PROXY_MANAGED = '1'

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
      if (startedAt) {
        const elapsedMs = (Bun.nanoseconds() - startedAt) / 1_000_000
        const summary = failed.length
          ? `ready in ${(elapsedMs / 1000).toFixed(1)}s — ${failed.join(', ')} did not bind within ${readinessTimeoutMs / 1000}s`
          : `ready in ${(elapsedMs / 1000).toFixed(1)}s`
        console.log(`  ${dim(summary)}\n`)
      }
      // Print the registered API routes once the API server reports
      // ready. Hidden by default — the table is long (~250 routes once
      // the framework defaults register) and dominates the dev banner.
      // Opt in with `STACKS_PRINT_ROUTES=1` when you actually want to
      // grep through it from the terminal.
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
    hasCustomDomain
      ? startReverseProxy(options).catch((error) => {
        if (options.verbose)
          log.warn(`Proxy: ${error}`)
      })
      : Promise.resolve(),
  ])
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
async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 800)
      fetch(`http://127.0.0.1:${port}/__health`, { signal: ac.signal, redirect: 'manual' })
        .then(() => { clearTimeout(t); resolve(true) })
        .catch(() => { clearTimeout(t); resolve(false) })
    })
    if (ok) return true
    await new Promise(r => setTimeout(r, 250))
  }
  return false
}

/**
 * Start the reverse proxies (rpx) to enable HTTPS with custom domains.
 * Proxies frontend, API, docs, and dashboard subdomains.
 * rpx wraps tlsx and handles SSL (certs, hosts, trust) automatically.
 */
async function startReverseProxy(options: DevOptions): Promise<void> {
  const appUrl = process.env.APP_URL

  // Skip if no APP_URL is set or if it's localhost
  if (!appUrl || appUrl === 'localhost' || appUrl.includes('localhost:')) {
    return
  }

  const domain = appUrl.replace(/^https?:\/\//, '')
  const apiDomain = `api.${domain}`
  const docsDomain = `docs.${domain}`
  const dashboardDomain = `dashboard.${domain}`
  const frontendPort = Number(process.env.PORT) || 3000
  const apiPort = Number(process.env.PORT_API) || 3008
  const docsPort = Number(process.env.PORT_DOCS) || 3006
  const dashboardPort = Number(process.env.PORT_ADMIN) || 3002
  const sslBasePath = `${process.env.HOME}/.stacks/ssl`
  const verbose = options.verbose ?? false

  // Mirror the dashboard opt-in from startDevelopmentServer — when the
  // dashboard isn't being launched, don't ask rpx to issue a cert for
  // its subdomain (the proxy entry would just point at a port nothing
  // is bound to).
  const includeDashboard = process.env.STACKS_DEV_DASHBOARD === '1'

  try {
    const { startProxies } = await import('@stacksjs/rpx')

    // Use multi-proxy mode so rpx generates a SINGLE cert covering all domains
    await startProxies({
      proxies: [
        // Forward /api/** straight to the API server, preserving the prefix.
        // The API registers its routes as /api/cart/add, /api/checkout/place,
        // etc., so stripPrefix must be false — otherwise the API would see
        // /cart/add and 404. The frontend's stx-serve also has a fallback
        // proxy for direct localhost:PORT access.
        { from: `localhost:${frontendPort}`, to: domain, cleanUrls: false, pathRewrites: [{ from: '/api', to: `localhost:${apiPort}`, stripPrefix: false }] },
        { from: `localhost:${apiPort}`, to: apiDomain, cleanUrls: false },
        { from: `localhost:${docsPort}`, to: docsDomain, cleanUrls: false },
        ...(includeDashboard
          ? [{ from: `localhost:${dashboardPort}`, to: dashboardDomain, cleanUrls: false }]
          : []),
      ],
      https: {
        basePath: sslBasePath,
        validityDays: 825,
      },
      regenerateUntrustedCerts: false,
      verbose,
    })
  }
  catch (error) {
    if (options.verbose) {
      log.warn('Reverse proxy not available, skipping HTTPS')
      log.warn(String(error))
    }
  }
}

function wantsInteractive(options: DevOptions) {
  return options.interactive
}
