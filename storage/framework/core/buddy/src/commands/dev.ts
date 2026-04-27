import type { CLI, DevOptions } from '@stacksjs/types'
import process from 'node:process'
import { bold, cyan, dim, green, intro, log, outro, prompts, runCommand } from '@stacksjs/cli'
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
        || ((options as any).systemTray || (options as any)['system-tray'] ? 'system-tray' : undefined)
        || (options.docs ? 'docs' : undefined)

      if (target) {
        const serverOptions = { ...options }
        const a = await actions()
        switch (target) {
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
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {

      await (await actions()).runApiDevServer(options)
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

  buddy.on('dev:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

export async function startDevelopmentServer(options: DevOptions, startTime?: number): Promise<void> {
  const appUrl = process.env.APP_URL
  const frontendPort = Number(process.env.PORT) || 3000
  const apiPort = Number(process.env.PORT_API) || 3008
  const docsPort = Number(process.env.PORT_DOCS) || 3006
  const dashboardPort = Number(process.env.PORT_ADMIN) || 3002
  const hasCustomDomain = appUrl && appUrl !== 'localhost' && !appUrl.includes('localhost:')
  const domain = hasCustomDomain ? appUrl.replace(/^https?:\/\//, '') : null
  const apiDomain = domain ? `api.${domain}` : null
  const docsDomain = domain ? `docs.${domain}` : null
  const dashboardDomain = domain ? `dashboard.${domain}` : null
  const frontendUrl = domain ? `https://${domain}` : `http://localhost:${frontendPort}`
  const apiUrl = apiDomain ? `https://${apiDomain}` : `http://localhost:${apiPort}`
  const docsUrl = docsDomain ? `https://${docsDomain}` : `http://localhost:${docsPort}`
  const dashboardUrl = dashboardDomain ? `https://${dashboardDomain}` : `http://localhost:${dashboardPort}`

  // Print Vite-style unified output. Banner first so the user has the URLs
  // while servers boot — the "ready" line lands later, once each backend
  // actually accepts a TCP connection on its port.
  console.log()
  console.log(`  ${bold(cyan('stacks'))} ${dim(`v${version}`)}`)
  console.log()
  console.log(`  ${green('➜')}  ${bold('Frontend')}:    ${cyan(frontendUrl)}`)
  console.log(`  ${green('➜')}  ${bold('API')}:         ${cyan(apiUrl)}`)
  console.log(`  ${green('➜')}  ${bold('Docs')}:        ${cyan(docsUrl)}`)
  console.log(`  ${green('➜')}  ${bold('Dashboard')}:   ${cyan(dashboardUrl)}`)
  if (options.verbose && domain) {
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${frontendPort} → ${domain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${apiPort} → ${apiDomain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${docsPort} → ${docsDomain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${dashboardPort} → ${dashboardDomain}`)}`)
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
    try {
      // Match `bun --watch storage/framework/core/actions/src/dev/*.ts`
      // and any older `bun cli.ts dev` from this project. We deliberately
      // don't use `pkill -f buddy` — the current process matches that.
      await Bun.spawn(['pkill', '-9', '-f', 'bun --watch storage/framework/core/actions/src/dev/'], { stdout: 'ignore', stderr: 'ignore' }).exited
      await new Promise(r => setTimeout(r, 200))
    }
    catch {
      // pkill not available or no matches — fine, just continue
    }
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
  const SHUTDOWN_GRACE_MS = 1500
  const cleanup = () => {
    if (isExiting) return
    isExiting = true
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
    { name: 'Dashboard', port: dashboardPort },
  ]
  const readinessTimeoutMs = 30000
  let readyAnnounced = false
  Promise.all(ports.map(p => waitForPort(p.port, readinessTimeoutMs)))
    .then((results) => {
      if (readyAnnounced) return
      readyAnnounced = true
      const failed = results
        .map((ok, i) => ok ? null : ports[i].name)
        .filter((x): x is string => x !== null)
      if (startTime) {
        const elapsedMs = (Bun.nanoseconds() - startTime) / 1_000_000
        const summary = failed.length
          ? `ready in ${(elapsedMs / 1000).toFixed(1)}s — ${failed.join(', ')} did not bind within ${readinessTimeoutMs / 1000}s`
          : `ready in ${(elapsedMs / 1000).toFixed(1)}s`
        console.log(`  ${dim(summary)}\n`)
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
    a.runDashboardDevServer(quietOpts).catch((error) => {
      if (options.verbose)
        log.error(`Dashboard: ${error}`)
    }),
    hasCustomDomain
      ? startReverseProxy(options).catch((error) => {
        if (options.verbose)
          log.warn(`Proxy: ${error}`)
      })
      : Promise.resolve(),
  ])
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

  try {
    const { startProxies } = await import('@stacksjs/rpx')

    // Use multi-proxy mode so rpx generates a SINGLE cert covering all domains
    await startProxies({
      proxies: [
        { from: `localhost:${frontendPort}`, to: domain, cleanUrls: false, pathRewrites: [{ from: '/api', to: `localhost:${apiPort}`, stripPrefix: false }] },
        { from: `localhost:${apiPort}`, to: apiDomain, cleanUrls: false },
        { from: `localhost:${docsPort}`, to: docsDomain, cleanUrls: false },
        { from: `localhost:${dashboardPort}`, to: dashboardDomain, cleanUrls: false },
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
