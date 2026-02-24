import type { CLI, DevOptions } from '@stacksjs/types'
import process from 'node:process'
import {
  runAction,
  runApiDevServer,
  runComponentsDevServer,
  runDashboardDevServer,
  runDesktopDevServer,
  runDocsDevServer,
  runFrontendDevServer,
  runSystemTrayDevServer,
} from '@stacksjs/actions'
import { bold, cyan, dim, green, intro, log, outro, prompts, runCommand } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { libsPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { version } from '../../package.json'

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

      switch (server) {
        case 'frontend':
          await runFrontendDevServer(options)
          break
        case 'api':
          await runApiDevServer(options)
          break
        case 'components':
          await runComponentsDevServer(options)
          break
        case 'dashboard':
          await runDashboardDevServer(options)
          break
        case 'desktop':
          await runDesktopDevServer(options)
          break
        case 'system-tray':
          await runSystemTrayDevServer(options)
          break
        // case 'email':
        //   await runEmailDevServer(options)
        //   break
        case 'docs':
          await runDocsDevServer(options)
          break
        default:
      }

      if (wantsInteractive(options)) {
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
          await runComponentsDevServer(options)
        }
        else if (selectedValue === 'api') {
          await runApiDevServer(options)
        }
        else if (selectedValue === 'dashboard') {
          await runDashboardDevServer(options)
        }
        // else if (selectedValue === 'email')
        //   await runEmailDevServer(options)
        else if (selectedValue === 'docs') {
          await runDocsDevServer(options)
        }
        else {
          log.error('Invalid option during interactive mode')
          process.exit(ExitCode.InvalidArgument)
        }
      }
      else {
        if (options.components)
          await runComponentsDevServer(options)
        else if ((options as any).dashboard)
          await runDashboardDevServer(options)
        else if (options.docs)
          await runDocsDevServer(options)
        else if (options.api)
          await runApiDevServer(options)
        // else if (options.email)
        //   await runEmailDevServer(options)
      }

      await startDevelopmentServer(options, perf)

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
        process.exit()
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
      const result = await runAction(Action.DevDocs, options)

      if (result.isErr) {
        await outro(
          'While running the dev:docs command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
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
      const result = await runAction(Action.DevDesktop, options)

      if (result.isErr) {
        await outro(
          'While running the dev:desktop command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
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

      await runApiDevServer(options)
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
      await runFrontendDevServer(options)
    })

  buddy
    .command('dev:dashboard', descriptions.dashboard)
    .alias('dev:admin')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await runDashboardDevServer(options)
    })

  buddy
    .command('dev:system-tray', descriptions.systemTray)
    .alias('dev:tray')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await runSystemTrayDevServer(options)
    })

  buddy.on('dev:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

export async function startDevelopmentServer(options: DevOptions, startTime?: number): Promise<void> {
  const appUrl = process.env.APP_URL
  const frontendPort = Number(process.env.PORT) || 3000
  const apiPort = 3008
  const docsPort = Number(process.env.PORT_DOCS) || 3006
  const dashboardPort = Number(process.env.PORT_ADMIN) || 3456
  const hasCustomDomain = appUrl && appUrl !== 'localhost' && !appUrl.includes('localhost:')
  const domain = hasCustomDomain ? appUrl.replace(/^https?:\/\//, '') : null
  const apiDomain = domain ? `api.${domain}` : null
  const docsDomain = domain ? `docs.${domain}` : null
  const dashboardDomain = domain ? `dashboard.${domain}` : null
  const frontendUrl = domain ? `https://${domain}` : `http://localhost:${frontendPort}`
  const apiUrl = apiDomain ? `https://${apiDomain}` : `http://localhost:${apiPort}`
  const docsUrl = docsDomain ? `https://${docsDomain}` : `http://localhost:${docsPort}`
  const dashboardUrl = dashboardDomain ? `https://${dashboardDomain}` : `http://localhost:${dashboardPort}`

  // Print Vite-style unified output
  console.log()
  console.log(`  ${bold(cyan('stacks'))} ${dim(`v${version}`)}`)
  console.log()
  console.log(`  ${green('➜')}  ${bold('Frontend')}:    ${cyan(frontendUrl)}`)
  console.log(`  ${green('➜')}  ${bold('API')}:         ${cyan(apiUrl)}`)
  console.log(`  ${green('➜')}  ${bold('Docs')}:        ${cyan(docsUrl)}`)
  console.log(`  ${green('➜')}  ${bold('Dashboard')}:   ${cyan(dashboardUrl)}`)
  if (startTime) {
    const elapsedMs = (Bun.nanoseconds() - startTime) / 1_000_000
    console.log(`\n  ${dim(`ready in ${elapsedMs.toFixed(2)} ms`)}`)
  }
  if (options.verbose && domain) {
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${frontendPort} → ${domain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${apiPort} → ${apiDomain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${docsPort} → ${docsDomain}`)}`)
    console.log(`  ${dim('➜')}  ${dim('Proxy')}:       ${dim(`localhost:${dashboardPort} → ${dashboardDomain}`)}`)
  }
  console.log()

  // Clean up child processes on exit to prevent orphaned processes
  let isExiting = false
  const cleanup = () => {
    if (isExiting) return
    isExiting = true
    // SIGKILL the entire process group (all children spawned by this process)
    try { process.kill(0, 'SIGKILL') }
    catch { process.exit(0) }
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Start all servers silently — output is handled above
  await Promise.all([
    runFrontendDevServer(options).catch((error) => {
      if (options.verbose)
        log.error(`Frontend: ${error}`)
    }),
    runApiDevServer(options).catch((error) => {
      if (options.verbose)
        log.error(`API: ${error}`)
    }),
    runDocsDevServer(options).catch((error) => {
      if (options.verbose)
        log.error(`Docs: ${error}`)
    }),
    runDashboardDevServer(options).catch((error) => {
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
  const apiPort = 3008
  const docsPort = Number(process.env.PORT_DOCS) || 3006
  const dashboardPort = Number(process.env.PORT_ADMIN) || 3456
  const sslBasePath = `${process.env.HOME}/.stacks/ssl`
  const verbose = options.verbose ?? false

  try {
    const { startProxies } = await import('@stacksjs/rpx')

    // Use multi-proxy mode so rpx generates a SINGLE cert covering all domains
    await startProxies({
      proxies: [
        { from: `localhost:${frontendPort}`, to: domain, cleanUrls: false },
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
