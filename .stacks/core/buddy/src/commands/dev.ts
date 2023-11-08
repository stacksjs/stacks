import process from 'node:process'
import { Action, ExitCode } from '@stacksjs/types'
import { runAction, runComponentsDevServer, runFunctionsDevServer, runDocsDevServer } from '@stacksjs/actions'
import type { CLI, DevOptions } from '@stacksjs/types'
import { intro, log, outro, runCommand, prompt } from '@stacksjs/cli'
import { vitePath } from '@stacksjs/path'

export function dev(buddy: CLI) {
  const descriptions = {
    dev: 'Starts development server',
    views: 'Starts the frontend development server',
    components: 'Start the Components development server',
    desktop: 'Start the Desktop development server',
    api: 'Start the local API development server',
    docs: 'Start the Documentation development server',
    interactive: 'Get asked which development server to start',
    select: 'Which development server are you trying to start?',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('dev [server]', descriptions.dev)
    .option('-c, --components', descriptions.components)
    .option('-a, --api', descriptions.api)
    .option('-d, --docs', descriptions.docs)
    .option('-i, --interactive', descriptions.interactive, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (server: string | undefined, options: DevOptions) => {
      const perf = await intro('buddy dev')

      switch (server) {
        case 'frontend':
          await runPagesDevServer(options)
          break
        case 'api':
          await runFunctionsDevServer(options)
          break
        case 'components':
          await runComponentsDevServer(options)
          break
        case 'docs':
          await runDocsDevServer(options)
          break
        default:
      }

      if (wantsInteractive(options)) {
        const answer = await prompt.require()
          .select(descriptions.select, {
            options: [
              { value: 'all', label: 'All' },
              { value: 'frontend', label: 'Frontend' },
              { value: 'api', label: 'Backend' },
              { value: 'desktop', label: 'Desktop' },
              { value: 'components', label: 'Components' },
              // { value: 'functions', label: 'Functions' },
              { value: 'docs', label: 'Documentation' },
            ],
          })

        if (answer === 'components')
          await runComponentsDevServer(options)
        // else if (answer === 'functions')
        //   await runFunctionsDevServer(options)
        else if (answer === 'frontend')
          await runPagesDevServer(options)
        else if (answer === 'docs')
          await runDocsDevServer(options)

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
          await runFunctionsDevServer(options)
        else if (options.pages)
          await runPagesDevServer(options)
      }

      await startDevelopmentServer(options)

      outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:components', descriptions.components)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      const perf = await intro('buddy dev:components')
      const cmd = `bunx --bun vite --config ${vitePath('src/vue-components.ts')}`
      const result = await runCommand(cmd, options)

      if (options.verbose)
        log.info('buddy dev:components result', result)

      if (result.isErr()) {
        await outro('While running the dev:components command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit()
      }

      // eslint-disable-next-line no-console
      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:docs', descriptions.docs)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      const perf = await intro('buddy dev:docs')
      const result = await runAction(Action.DevDocs, options)

      if (result.isErr()) {
        await outro('While running the dev:docs command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit()
      }

      // eslint-disable-next-line no-console
      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:desktop', descriptions.desktop)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      const perf = await intro('buddy dev:desktop')
      const result = await runAction(Action.DevDesktop, options)

      if (result.isErr()) {
        await outro('While running the dev:desktop command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit()
      }

      // eslint-disable-next-line no-console
      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:functions', descriptions.api)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await runFunctionsDevServer(options)
    })

  buddy
    .command('dev:views', descriptions.views)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await runPagesDevServer(options)
    })

  buddy.on('dev:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

export async function startDevelopmentServer(options: DevOptions) {
  const result = await runAction(Action.Dev, options)

  if (result.isErr()) {
    log.error('While running the dev command, there was an issue', result.error)
    process.exit(ExitCode.InvalidArgument)
  }
}

function wantsInteractive(options: DevOptions) {
  return options.interactive
}
