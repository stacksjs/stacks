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
import { intro, log, outro, prompts, runCommand } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { libsPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

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
    .option('-t, --desktop', descriptions.desktop)
    .option('-d, --docs', descriptions.docs)
    .option('-t, --system-tray', descriptions.systemTray)
    .option('-i, --interactive', descriptions.interactive, { default: false })
    .option('-l, --with-localhost', descriptions.withLocalhost, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (server: string | undefined, options: DevOptions) => {
      log.debug('Running `buddy dev [server]` ...', options)

      const perf = await intro('buddy dev')

      // log.info('Ensuring web server/s running...')

      // // check if port 443 is open
      // const result = await runCommand('lsof -i :443', { silent: true })

      // if (result.isErr())
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
        const answer = await prompts({
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
        if (options.docs)
          await runDocsDevServer(options)
        else if (options.api)
          await runApiDevServer(options)
        // else if (options.email)
        //   await runEmailDevServer(options)
      }

      await startDevelopmentServer(options)

      outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:components', descriptions.components)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      log.debug('Running `buddy dev:components` ...', options)

      const perf = await intro('buddy dev:components')
      const result = await runCommand('bun run dev', {
        cwd: libsPath('components/vue'),
        // silent: !options.verbose,
      })

      if (options.verbose)
        log.info('buddy dev:components result', result)

      if (result.isErr()) {
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
      log.debug('Running `buddy dev:docs` ...', options)

      const perf = await intro('buddy dev:docs')
      const result = await runAction(Action.DevDocs, options)

      if (result.isErr()) {
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
      log.debug('Running `buddy dev:desktop` ...', options)

      const perf = await intro('buddy dev:desktop')
      const result = await runAction(Action.DevDesktop, options)

      if (result.isErr()) {
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
      log.debug('Running `buddy dev:api` ...', options)

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
      log.debug('Running `buddy dev:frontend` ...', options)
      await runFrontendDevServer(options)
    })

  buddy
    .command('dev:dashboard', descriptions.dashboard)
    .alias('dev:admin')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      log.debug('Running `buddy dev:dashboard` ...', options)
      await runDashboardDevServer(options)
    })

  buddy
    .command('dev:system-tray', descriptions.systemTray)
    .alias('dev:tray')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      log.debug('Running `buddy dev:system-tray` ...', options)
      await runSystemTrayDevServer(options)
    })

  buddy.on('dev:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

export async function startDevelopmentServer(options: DevOptions): Promise<void> {
  const result = await runAction(Action.Dev, options)

  if (result.isErr()) {
    log.error('While running the dev command, there was an issue', result.error)
    process.exit(ExitCode.InvalidArgument)
  }
}

function wantsInteractive(options: DevOptions) {
  return options.interactive
}
