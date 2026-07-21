import type { CLI, DevOptions } from '@stacksjs/types'
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

let developmentRpx: DevelopmentRpx | undefined

/**
 * Resolve the on-disk entry for `@stacksjs/rpx`.
 *
 * A *bare* `import('@stacksjs/rpx')` resolves from the importing file's
 * directory (storage/framework/core/buddy/src/commands, and the spawned daemon
 * bootstrap in buddy/scripts) — where rpx isn't on the resolution path — so it
 * throws "Cannot find module" even though the app root has it. That breaks BOTH
 * the in-process proxy helpers AND the spawned daemon (which then never binds
 * :443, so the pretty URL refuses to connect). Returning an explicit path lets
 * us load it reliably and hand the daemon the same path. Prefer the project's
 * installed copy (a local Tools worktree's dist can lag behind), then Tools,
 * then pantry.
 */
function resolveRpxEntryPath(): string | null {
  const candidates = [
    projectPath('node_modules/@stacksjs/rpx/dist/index.js'),
    join(homedir(), 'Code/Tools/rpx/packages/rpx/dist/index.js'),
    projectPath('pantry/@stacksjs/rpx/dist/src/index.js'),
  ]
  return candidates.find(entry => existsSync(entry)) ?? null
}

async function importDevelopmentRpx(): Promise<DevelopmentRpx> {
  if (developmentRpx)
    return developmentRpx

  const entry = resolveRpxEntryPath()
  developmentRpx = (entry ? await import(entry) : await import('@stacksjs/rpx')) as DevelopmentRpx
  return developmentRpx
}

// rpx registry ids written by this `./buddy dev` session — cleared on shutdown.
const activeRpxRegistryIds: string[] = []

// Lazy-load @stacksjs/actions to avoid triggering bun-router config warnings at CLI startup
let _actions: typeof import('@stacksjs/actions') | undefined
async function actions(): Promise<typeof import('@stacksjs/actions')> {
  if (!_actions) _actions = await import('@stacksjs/actions')
  return _actions
}

export const interactiveDevChoices = [
  { value: 'all', title: 'All' },
  { value: 'frontend', title: 'Frontend' },
  { value: 'api', title: 'Backend' },
  { value: 'dashboard', title: 'Dashboard' },
  { value: 'desktop', title: 'Desktop' },
  { value: 'native', title: 'Native App' },
  { value: 'components', title: 'Components' },
  { value: 'docs', title: 'Documentation' },
] as const

type InteractiveDevSelection = typeof interactiveDevChoices[number]['value']
type InteractiveDevRunners = Record<InteractiveDevSelection, () => Promise<unknown>>

export async function dispatchInteractiveDevSelection(
  selection: string,
  runners: InteractiveDevRunners,
): Promise<boolean> {
  if (!Object.hasOwn(runners, selection))
    return false

  await runners[selection as InteractiveDevSelection]()
  return true
}

export function resolvePrettyDevDomain(appUrl: string | undefined, nativeMode = false): string | null {
  if (!appUrl || nativeMode)
    return null

  try {
    const url = new URL(/^https?:\/\//i.test(appUrl) ? appUrl : `https://${appUrl}`)
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0')
      return null
    return hostname
  }
  catch {
    return null
  }
}

export function shouldUsePrettyDevUrls(input: {
  domain: string | null
  localhostOnly: boolean
  proxyManagedExternally: boolean
  systemAuthorized: boolean
}): boolean {
  return input.domain !== null
    && !input.localhostOnly
    && (input.proxyManagedExternally || input.systemAuthorized)
}

async function canStartPrettyDevProxy(): Promise<boolean> {
  if (await waitForHttpsProxy(443, 150))
    return true

  try {
    const { authorizeSystemAccess } = await importDevelopmentRpx()
    return authorizeSystemAccess({ interactive: false })
  }
  catch {
    return false
  }
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
          choices: interactiveDevChoices,
        })

        const selectedValue: string = answer.value
        const a = await actions()
        const handled = await dispatchInteractiveDevSelection(selectedValue, {
          all: () => startDevelopmentServer(options, perf),
          frontend: () => a.runFrontendDevServer(options),
          api: () => a.runApiDevServer(options),
          dashboard: () => a.runDashboardDevServer(options),
          desktop: () => a.runDesktopDevServer(options),
          native: () => startDevelopmentServer({ ...options, native: true }, perf),
          components: () => a.runComponentsDevServer(options),
          docs: () => a.runDocsDevServer(options),
        })

        if (!handled) {
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
        cwd: libsPath('components/stx'),
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
  const appUrl = process.env.APP_URL ?? 'stacks.localhost'
  const nativeMode = options.native === true
  // When rpx's on-demand sites launch `./buddy dev`, rpx already owns the reverse
  // proxy, TLS and the shared :443 daemon — and injects PORT/PORT_API/PORT_DOCS
  // for us to bind. Detect that at entry (before we set the same flag for our own
  // children below) so we boot the backends but skip every proxy/TLS/daemon step,
  // which would otherwise fight rpx and could even restart the daemon that's
  // serving the request that booted us.
  const proxyManagedExternally = process.env.STACKS_PROXY_MANAGED === '1'
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
  const domain = resolvePrettyDevDomain(appUrl, nativeMode)
  const appLooksCustom = domain !== null
  // Pretty https URLs from APP_URL are the default dev experience, even when
  // the domain is public: rpx maps it to 127.0.0.1 (/etc/hosts plus a
  // domain-scoped resolver) and serves it with a locally trusted cert,
  // Valet-style. `STACKS_DEV_LOCALHOST=1` opts out (CI, or when the live
  // domain must keep resolving to production from this machine) and the
  // banner falls back to plain localhost URLs.
  const localhostOnly = process.env.STACKS_DEV_LOCALHOST === '1'
  const prettyUrlsRequested = appLooksCustom && !localhostOnly
  const systemAuthorized = !prettyUrlsRequested || proxyManagedExternally
    ? true
    : await canStartPrettyDevProxy()
  const usePrettyUrls = shouldUsePrettyDevUrls({
    domain,
    localhostOnly,
    proxyManagedExternally,
    systemAuthorized,
  })
  const prettySetupRequired = prettyUrlsRequested && !usePrettyUrls
  // Only manage the proxy/TLS/daemon ourselves when rpx isn't already doing it.
  const hasCustomDomain = usePrettyUrls && !proxyManagedExternally
  const displayedDomain = usePrettyUrls ? domain : null
  const dashboardDomain = displayedDomain ? `dashboard.${displayedDomain}` : null
  const frontendUrl = displayedDomain ? `https://${displayedDomain}` : `http://localhost:${frontendPort}`
  const apiUrl = displayedDomain ? `https://${displayedDomain}/api` : `http://localhost:${apiPort}`
  const docsUrl = displayedDomain ? `https://${displayedDomain}/docs` : `http://localhost:${docsPort}`
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
  if (prettySetupRequired) {
    console.log(`  ${yellow('⚠')}  ${yellow('Pretty URL setup required')} ${dim('- using localhost for this session')}`)
    console.log(`  ${dim('    ')}${dim('Run `./buddy setup:ssl` once, then restart `./buddy dev`.')}`)
    console.log()
  }
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
  // Opted out of pretty URLs: make sure no loopback override from a previous
  // pretty-URL session keeps the domain pointed at this machine.
  if (localhostOnly && domain && !proxyManagedExternally)
    void removeStalePublicDomainOverrides(domain, includeDashboard, options.verbose ?? false).catch(() => { /* best-effort */ })
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
    // Teardown order matters: an unawaited deregistration loses the race
    // against the group SIGTERM, leaving this session's rpx registry entry
    // behind - the root daemon then re-applies the /etc/hosts + resolver
    // overrides on every restart and a public APP_URL stays pointed at this
    // machine (and its dead proxy) after the dev session ended. Give the
    // deregistration and the public-domain override removal a bounded head
    // start, then proceed with the group kill.
    const rpxTeardown = (async () => {
      try {
        await unregisterRpxProxies(activeRpxRegistryIds)
        activeRpxRegistryIds.length = 0
        if (hasCustomDomain && domain)
          await removeStalePublicDomainOverrides(domain, includeDashboard, options.verbose ?? false)
      }
      catch { /* best-effort teardown */ }
    })()
    const teardownDeadline = new Promise<void>(resolve => setTimeout(resolve, SHUTDOWN_GRACE_MS))
    void Promise.race([rpxTeardown, teardownDeadline]).finally(() => {
      try { process.kill(-process.pid, 'SIGTERM') }
      catch {
        // Process group may not exist (e.g., not session leader) - try the
        // current process only. Worst case the inner SIGKILL below cleans up.
        try { process.kill(0, 'SIGTERM') } catch { /* ignore */ }
      }
      setTimeout(() => {
        try { process.kill(0, 'SIGKILL') }
        catch { process.exit(1) }
      }, SHUTDOWN_GRACE_MS).unref()
    })
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('SIGHUP', cleanup)

  // Start all servers silently — unified banner above handles output
  const quietOpts = { ...options, quiet: true }
  const a = await actions()

  // Background readiness probes. Each resolves when the backend port accepts
  // a TCP connection so the "ready in N ms" line below reflects the time at
  // which the URLs above actually serve traffic — not just when the spawn
  // calls returned. Probes run in parallel with the servers themselves.
  // Only the core app servers gate "ready" — the Docs (and Dashboard) servers
  // still start by default, but they boot in the background and shouldn't hold
  // up the readiness banner. This keeps `ready in` reporting when the app is
  // actually usable; the auxiliary URLs come up moments later.
  // Gate the "ready" banner on the API server — the core every Stacks app runs
  // and the one requests actually need. Like the docs and dashboard servers
  // above, the frontend server boots in the background and its URL comes up
  // moments later, so it must not hold the banner: an app whose whole site is
  // served by the API never binds a separate frontend port, and gating on that
  // port forced a fixed ~30s wait (readinessTimeoutMs) every boot. See stacksjs/stacks#2036.
  const ports = [
    { name: 'API', port: apiPort },
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
    // `results` IS used (in `failed` below); pickier misparses the multi-line arrow.
    // eslint-disable-next-line pickier/no-unused-vars
    .then(async (results) => {
      if (readyAnnounced) return
      readyAnnounced = true

      const failed = results
        .map((ok, i) => ok ? null : ports[i]?.name ?? null)
        .filter((x): x is string => x !== null)

      // Bring up the HTTPS reverse proxy (rpx + tlsx) for the pretty domain.
      // `proxyReachable` decides whether the banner advertises the pretty URLs
      // or falls back to the working http://localhost ones — a pretty URL that
      // refuses to connect is worse than an honest localhost link.
      let proxyReachable = false
      if (hasCustomDomain && domain) {
        // Kick off the proxy/TLS/daemon setup; don't await it directly — instead
        // wait on the real signal: :443 actually accepting connections. The
        // first run mints certs and re-execs the daemon through sudo to bind the
        // privileged port (rpx allows up to ~15s for that), but the root daemon
        // persists across sessions, so later runs detect :443 almost instantly.
        // The cap also keeps a failed elevation (wrong sudo) from hanging the
        // banner; the setup keeps running in the background regardless.
        void (async () => {
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
          catch { /* surfaced below via the :443 reachability probe */ }
        })()

        proxyReachable = await waitForHttpsProxy(443, 16_000)
        if (!proxyReachable) {
          console.log(`  ${yellow('⚠')}  ${yellow('HTTPS proxy not reachable on :443')} — serving ${cyan(`http://localhost:${frontendPort}`)} instead`)
          console.log(`  ${dim('    ')}${dim('rpx needs a valid SUDO_PASSWORD in .env to bind :443; trust the local CA, then restart `./buddy dev`.')}`)
          if (options.verbose)
            console.log(`  ${dim('    ')}${dim(`Trust CA: sh ${join(RPX_SSL_DIR, 'trust-rpx-cert.sh')}`)}`)
        }
      }

      eraseDevBootStartingLines()

      printDevReadyBanner({
        options,
        nativeMode,
        // Under rpx management we don't probe :443 ourselves, but rpx *is* serving
        // the pretty https URLs — advertise them rather than the localhost fallback.
        hasCustomDomain: !!appLooksCustom && !localhostOnly,
        proxyReachable: proxyManagedExternally ? true : proxyReachable,
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

// `input` IS used (`} = input` below); pickier misparses multi-line object-type params
// eslint-disable-next-line pickier/no-unused-vars
/**
 * True when the app is in "coming soon" mode — either the `./buddy coming-soon`
 * gate (state file) is active, or the holding page is baked into the homepage
 * view (`siteMode = 'coming-soon'` in resources/views/index.stx).
 */
function isComingSoonMode(): boolean {
  if (existsSync(projectPath('storage/framework/coming-soon')))
    return true
  try {
    const idx = projectPath('resources/views/index.stx')
    return existsSync(idx) && /siteMode\s*=\s*['"]coming-soon['"]/.test(readFileSync(idx, 'utf8'))
  }
  catch {
    return false
  }
}

/** True when a markdown blog exists at content/blog/ (served at /blog by BunPress). */
function blogIsConfigured(): boolean {
  try {
    const dir = projectPath('content/blog')
    return existsSync(dir) && readdirSync(dir).some(f => f.endsWith('.md'))
  }
  catch {
    return false
  }
}

// `input` IS used (destructured below); pickier misparses the multi-line object param.
// eslint-disable-next-line pickier/no-unused-vars
function printDevReadyBanner(input: {
  options: DevOptions
  nativeMode: boolean
  hasCustomDomain: boolean
  proxyReachable: boolean
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
    proxyReachable,
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

  // The pretty https://<domain> URLs are the headline whenever the proxy is
  // actually serving them; the raw localhost ports drop to a dim fallback line
  // for bypassing the proxy. Without a reachable proxy the localhost dev
  // servers stay the primary, honest URLs.
  const useProxy = hasCustomDomain && proxyReachable
  const feUrl = useProxy ? frontendUrl : `http://localhost:${frontendPort}`
  const apUrl = useProxy ? apiUrl : `http://localhost:${apiPort}`
  const dcUrl = useProxy ? docsUrl : `http://localhost:${docsPort}`
  const dbUrl = useProxy ? dashboardUrl : `http://localhost:${dashboardPort}`
  const blogUrl = `${feUrl}/blog`

  console.log()
  console.log(`  ${green('➜')}  ${bold('Frontend')}:    ${cyan(feUrl)}`)
  if (nativeMode)
    console.log(`  ${green('➜')}  ${bold('Native')}:      ${cyan(`Craft → ${feUrl}`)}`)
  console.log(`  ${green('➜')}  ${bold('API')}:         ${cyan(apUrl)}`)
  console.log(`  ${green('➜')}  ${bold('Docs')}:        ${cyan(dcUrl)}`)
  if (blogIsConfigured())
    console.log(`  ${green('➜')}  ${bold('Blog')}:        ${cyan(blogUrl)}`)
  if (includeDashboard)
    console.log(`  ${green('➜')}  ${bold('Dashboard')}:   ${cyan(dbUrl)}`)
  if (useProxy) {
    console.log(`  ${dim('➜')}  ${dim('Direct')}:      ${dim(`http://localhost:${frontendPort} (bypasses the proxy)`)}`)
    if (includeDashboard && dashboardDomain)
      console.log(`  ${dim('➜')}  ${dim('Direct')}:      ${dim(`http://localhost:${dashboardPort} (dashboard, bypasses the proxy)`)}`)
  }
  if (isComingSoonMode()) {
    console.log()
    console.log(`  ${yellow('●')}  ${bold(yellow('Coming soon mode'))} ${dim('— visitors see the holding page; bypass with the coming-soon secret.')}`)
  }
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
  let createApp: CraftSdk['createApp']

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

interface CraftApplication {
  show: () => Promise<void>
  close: () => void
}

interface CraftSdk {
  createApp?: (options: Record<string, unknown>) => CraftApplication
}

async function importCraftSdk(): Promise<CraftSdk> {
  const localCraftSdk = process.env.HOME
    ? `${process.env.HOME}/Code/Tools/craft/packages/typescript/src/index.ts`
    : undefined

  if (localCraftSdk && existsSync(localCraftSdk))
    return await import(localCraftSdk) as CraftSdk

  const packageNames = ['craft-native', '@craft-native/craft', '@stacksjs/ts-craft'] as const
  let primaryError: unknown
  for (const packageName of packageNames) {
    try {
      return await import(packageName) as CraftSdk
    }
    catch (error) {
      primaryError ??= error
    }
  }

  throw primaryError
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
    // Tight poll: a refused connection rejects instantly, so this is cheap and
    // detects "just bound" within ~50ms instead of up to a quarter second.
    await new Promise(r => setTimeout(r, 50))
  }
  return false
}

/**
 * Wait for the rpx HTTPS proxy to be listening on `port`. Uses a raw TCP
 * connect (not the HTTP probe `waitForPort` uses) — :443 speaks TLS, so an
 * HTTP probe would always fail there even when the proxy is up.
 */
async function waitForHttpsProxy(port: number, timeoutMs: number): Promise<boolean> {
  const { connect } = await import('node:net')
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = connect({ port, host: '127.0.0.1' })
      const finish = (v: boolean) => {
        try { socket.destroy() }
        catch { /* ignore */ }
        resolve(v)
      }
      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
      setTimeout(() => finish(false), 800).unref?.()
    })
    if (ok)
      return true
    await new Promise(r => setTimeout(r, 200))
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

function buildDevelopmentTlsHostnames(domain: string, includeDashboard: boolean): string[] {
  // App domain must be first — it becomes the cert CN. Safari/Chrome surface CN in
  // “cert is for …” errors even when SANs are present.
  return [
    domain,
    ...(includeDashboard ? [`dashboard.${domain}`] : []),
    'rpx.localhost',
  ]
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
  trustCertificate = true,
): Promise<void> {
  const verbose = options.verbose ?? false
  const {
    buildRegistryTlsProxyOptions,
    certIncludesSanHostnames,
    checkExistingCertificates,
    clearSslConfigCache,
    forceTrustCertificate,
    generateCertificate,
    getRegistryDir,
    isDaemonRunning,
    isRootCaTrustedForSsl,
    readAll,
    readCertCommonName,
    stopDaemon,
    trustRootCaForBrowsers,
    verifyHttpsChain,
  } = await importDevelopmentRpx()

  const hostnames = buildDevelopmentTlsHostnames(domain, includeDashboard)
  const entries = await readAll(getRegistryDir(), false).catch(() => [])
  for (const entry of entries) {
    const host = entry.to?.trim()
    if (host && !hostnames.includes(host))
      hostnames.push(host)
  }
  const tlsOptions = buildRegistryTlsProxyOptions(hostnames, domain, verbose)

  const hostnameInCert = certIncludesSanHostnames(RPX_HOST_CERT_PATH, hostnames)
  const cnMatchesApp = readCertCommonName(RPX_HOST_CERT_PATH) === domain

  let certRegenerated = false
  const existing = await checkExistingCertificates(tlsOptions)
  if (!existing || !hostnameInCert || !cnMatchesApp) {
    clearSslConfigCache()
    await generateCertificate({ ...tlsOptions, forceRegenerate: true } as unknown as Parameters<typeof generateCertificate>[0])
    certRegenerated = true
  }

  let trusted = isRootCaTrustedForSsl(RPX_ROOT_CA_PATH, domain, { verbose })
  if (!trusted && trustCertificate) {
    trusted = trustRootCaForBrowsers(RPX_ROOT_CA_PATH, { serverName: domain, verbose })
      || await forceTrustCertificate(RPX_ROOT_CA_PATH, { serverName: domain, verbose })
      || isRootCaTrustedForSsl(RPX_ROOT_CA_PATH, domain, { verbose })
    if (trusted)
      console.log(`  ${green('✓')}  ${dim('HTTPS')}:         ${dim('Local CA trusted — reload the browser if you still see a warning')}`)
    else
      console.log(`  ${yellow('⚠')}  ${yellow('HTTPS')}:         ${yellow(`Local CA not trusted — run: sh ${join(RPX_SSL_DIR, 'trust-rpx-cert.sh')}`)}`)
  }
  else if (verbose) {
    console.log(`  ${green('✓')}  ${dim('HTTPS')}:         ${dim('Local certificate trusted for SSL')}`)
  }

  const chainOk = existsSync(RPX_ROOT_CA_PATH)
    ? await verifyHttpsChain(domain, RPX_ROOT_CA_PATH)
    : false

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

  const bootstrap = join(dirname(fileURLToPath(import.meta.url)), '../../scripts/rpx-daemon-bootstrap.ts')
  if (existsSync(bootstrap))
    return dirname(bootstrap)

  return homedir()
}

async function resolveRpxDaemonSpawnCommand(): Promise<string[]> {
  // Bootstrap first — never loads the app's Bun preloader.
  const bootstrap = join(dirname(fileURLToPath(import.meta.url)), '../../scripts/rpx-daemon-bootstrap.ts')
  if (existsSync(bootstrap))
    return [process.execPath, bootstrap]

  const fromEnv = process.env.RPX_BIN || process.env.STACKS_RPX_BIN
  if (fromEnv && existsSync(fromEnv))
    return [fromEnv, 'daemon:start']

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
 * Undo rpx overrides a previous dev session left behind for a PUBLIC domain:
 * the `127.0.0.1 <domain>` lines in /etc/hosts and the root-owned
 * /etc/resolver/<domain> file pointing at rpx's local DNS. The public-domain
 * guard only prevents NEW overrides; without this cleanup one stale install
 * keeps the live domain hijacked on this Mac (every browser and curl hits a
 * dead local proxy instead of production). Best-effort throughout: removal
 * needs sudo (SUDO_PASSWORD or cached credentials), never throws, and logs the
 * exact manual command when it cannot finish.
 */
async function removeStalePublicDomainOverrides(domain: string, includeDashboard: boolean, verbose: boolean): Promise<void> {
  const { checkHosts, removeHosts, resolverFilePath, contentLooksLikeRpxResolver } = await importDevelopmentRpx()

  const hosts = [domain, ...(includeDashboard ? [`dashboard.${domain}`] : [])]

  // /etc/hosts is world-readable, so checking first keeps a deliberately
  // hand-written (non-rpx) entry from being rewritten for no reason.
  const present = await checkHosts(hosts, verbose).catch(() => hosts.map(() => false))
  const staleHosts = hosts.filter((_, i) => present[i] === true)
  if (staleHosts.length > 0) {
    await removeHosts(staleHosts, verbose).catch(() => { /* best-effort */ })
    const remaining = await checkHosts(staleHosts, verbose).catch(() => staleHosts.map(() => true))
    if (remaining.some(Boolean))
      log.warn(`Stale /etc/hosts entries still point ${staleHosts.join(', ')} at loopback. Remove them with: sudo nano /etc/hosts`)
    else
      log.info(`Removed stale /etc/hosts entries for ${staleHosts.join(', ')} (left by a previous dev session)`)
  }

  // /etc/resolver/<domain> is root-owned. rpx exposes the path and the
  // ownership probe but no per-domain remover, so unlink it here, and only
  // when the content proves rpx manages the file. rpx scopes resolver files
  // to the last two domain labels (dashboard.<apex> shares the apex file).
  if (process.platform !== 'darwin')
    return

  const labels = domain.split('.')
  const basename = labels.length >= 2 ? labels.slice(-2).join('.') : domain
  const resolverPath = resolverFilePath(basename)
  let isRpxManaged = false
  try {
    isRpxManaged = contentLooksLikeRpxResolver(readFileSync(resolverPath, 'utf8'))
  }
  catch { /* no stale resolver file */ }
  if (!isRpxManaged)
    return

  const quotedPath = `'${resolverPath.replace(/'/g, `'\\''`)}'`
  const rm = process.env.SUDO_PASSWORD
    ? `printf '%s\n' "$SUDO_PASSWORD" | sudo -S rm -f ${quotedPath}`
    : `sudo -n rm -f ${quotedPath}`
  try {
    execSync(rm, { stdio: ['pipe', 'ignore', 'ignore'] })
    log.info(`Removed stale rpx DNS resolver ${resolverPath} (left by a previous dev session)`)
    // Make the live domain resolve again immediately instead of waiting out
    // the system DNS cache. Best-effort on the cached sudo timestamp.
    execSync('sudo -n dscacheutil -flushcache; sudo -n killall -HUP mDNSResponder; true', { stdio: ['pipe', 'ignore', 'ignore'] })
  }
  catch {
    log.warn(`A stale rpx DNS resolver still hijacks ${domain}. Remove it with: sudo rm ${resolverPath}`)
  }
}

/**
 * Update /etc/hosts and align TLS material while backends boot. The daemon is
 * started in `registerRpxProxiesForDomain` once HTTP ports are ready.
 */
async function prepareRpxTlsForDev(input: {
  domain: string
  includeDashboard: boolean
  options: DevOptions
  skipHosts?: boolean
  trustCertificate?: boolean
}): Promise<void> {
  const { domain, includeDashboard, options, skipHosts = false, trustCertificate = true } = input
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

  const { addHosts, setupDevelopmentDns } = await importDevelopmentRpx()

  // `.test` / custom dev TLDs: prefer domain-scoped macOS resolver files + the
  // rpx DNS server on :15353 (RFC 6761 `.localhost` skips this path).
  const dnsDomains = !skipHosts && hostsNeedingFile.length > 0
    ? hosts
    : []
  if (dnsDomains.length > 0) {
    const dnsReady = await setupDevelopmentDns({ domains: dnsDomains, verbose }).catch(() => false)
    if (!dnsReady && verbose)
      log.warn(`Dev DNS not configured for ${dnsDomains.join(', ')} — falling back to /etc/hosts`)
  }

  if (!skipHosts && hostsNeedingFile.length > 0) {
    await addHosts(hostsNeedingFile, verbose).catch((err) => {
      log.warn(`Could not update /etc/hosts for ${hostsNeedingFile.join(', ')}: ${(err as Error).message}`)
      log.warn('Add 127.0.0.1 entries manually or set SUDO_PASSWORD in .env')
    })
  }

  await ensureRpxDevelopmentHttps(domain, options, includeDashboard, trustCertificate)
}

export async function setupPrettyDevEnvironment(input: {
  domain?: string
  skipHosts?: boolean
  skipTrust?: boolean
  verbose?: boolean
}): Promise<boolean> {
  const domain = resolvePrettyDevDomain(input.domain ?? process.env.APP_URL ?? 'stacks.localhost')
  if (!domain) {
    log.info('APP_URL already uses localhost; no pretty URL setup is needed')
    return true
  }

  const rpx = await importDevelopmentRpx()
  if (!rpx.authorizeSystemAccess({ interactive: process.stdin.isTTY === true && process.stdout.isTTY === true })) {
    log.error('Pretty URL setup needs administrator authorization to bind ports 80 and 443 and trust the local CA')
    return false
  }

  await prepareRpxTlsForDev({
    domain,
    includeDashboard: process.env.STACKS_DEV_DASHBOARD === '1',
    options: { verbose: input.verbose } as DevOptions,
    skipHosts: input.skipHosts,
    trustCertificate: !input.skipTrust,
  })

  const spawnEnv: Record<string, string> = {}
  if (process.env.SUDO_PASSWORD)
    spawnEnv.SUDO_PASSWORD = process.env.SUDO_PASSWORD
  if (input.verbose)
    spawnEnv.RPX_VERBOSE = '1'
  const rpxEntry = resolveRpxEntryPath()
  if (rpxEntry)
    spawnEnv.RPX_MODULE = rpxEntry

  await startRpxDaemonIfNeeded({
    spawnCommand: await resolveRpxDaemonSpawnCommand(),
    spawnEnv,
    verbose: input.verbose ?? false,
    stopRpx: rpx.stopDaemon,
  })

  const ready = await waitForHttpsProxy(443, 5000)
  if (ready)
    log.success(`Pretty URLs are ready at https://${domain}`)
  else
    log.error('rpx did not become reachable on port 443')
  return ready
}

async function startRpxDaemonIfNeeded(input: {
  spawnCommand: string[]
  spawnEnv?: Record<string, string>
  verbose: boolean
  stopRpx: (opts: { timeoutMs: number }) => Promise<unknown>
}): Promise<void> {
  const { ensureDaemonRunning, isDaemonRunning: isRpxUp } = await importDevelopmentRpx()
  if (await isRpxUp()) {
    // A live pid file is not proof the daemon serves :443 — a previous run can
    // leave a bootstrap process that never elevated (bad sudo, port busy), and
    // reusing it means the proxy simply never comes up. Only reuse the daemon
    // when the port actually answers; otherwise stop it and respawn below.
    if (await waitForHttpsProxy(443, 1500))
      return
    await input.stopRpx({ timeoutMs: 5000 }).catch(() => { /* stale */ })
  }

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
// `input` IS used (`= input` below); pickier misparses multi-line object-type params
// eslint-disable-next-line pickier/no-unused-vars
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

  const {
    getRegistryDir,
    readAll,
    stopDaemon: stopRpx,
    syncDevelopmentDnsFromRegistry,
    writeEntry,
  } = await importDevelopmentRpx()
  const spawnCommand = await resolveRpxDaemonSpawnCommand()
  const spawnEnv: Record<string, string> = {}
  if (process.env.SUDO_PASSWORD)
    spawnEnv.SUDO_PASSWORD = process.env.SUDO_PASSWORD
  if (verbose)
    spawnEnv.RPX_VERBOSE = '1'
  // The daemon bootstrap runs from buddy/scripts where a bare `@stacksjs/rpx`
  // import fails the same way — hand it the resolved entry so it can start.
  const rpxEntry = resolveRpxEntryPath()
  if (rpxEntry)
    spawnEnv.RPX_MODULE = rpxEntry

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
      pid: process.pid,
      pathRewrites: proxy.pathRewrites,
    }, undefined, verbose)
    if (!activeRpxRegistryIds.includes(proxy.id))
      activeRpxRegistryIds.push(proxy.id)
    if (verbose)
      console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`https://${proxy.to} → ${proxy.from}`)}`)
  }

  const registryDir = getRegistryDir()
  const entries = await readAll(registryDir, verbose).catch(() => [])
  await syncDevelopmentDnsFromRegistry(entries, { verbose, ownerPid: process.pid }).catch((err) => {
    if (verbose) {
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ${dim('    ')}${dim(`Dev DNS sync: ${message}`)}`)
    }
  })
}

function wantsInteractive(options: DevOptions) {
  return options.interactive
}
