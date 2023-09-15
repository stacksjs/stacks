import process from 'node:process'
import { Action, ExitCode } from '@stacksjs/types'
import {
  runAction,
  runComponentsDevServer,
  runDesktopDevServer,
  runFunctionsDevServer,
  runPagesDevServer,
} from '@stacksjs/actions'
import type { CLI, DevOptions } from '@stacksjs/types'
import { intro, log, outro, runCommand } from '@stacksjs/cli'
import { vitePath } from '@stacksjs/path'

export function dev(buddy: CLI) {
  const descriptions = {
    components: 'Start the Components development server',
    desktop: 'Start the Desktop development server',
    api: 'Start the local API development server',
    docs: 'Start the Documentation development server',
    pages: 'Start the Pages development server',
    select: 'Which development server are you trying to start?',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('dev', 'Start the development server for any of the following')
    .option('-c, --components', descriptions.components)
    .option('-a, --api', descriptions.api)
    .option('-d, --docs', descriptions.docs)
    .option('-p, --views', descriptions.pages)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      // const perf = await intro('buddy dev')
      // const result = await runAction(Action.Dev, options)

      if (hasNoOptions(options)) {
        // const answer = await prompt.require()
        //   .select(descriptions.select, {
        //     options: [
        //       { value: 'all', label: 'All' },
        //       { value: 'pages', label: 'Frontend' },
        //       { value: 'api', label: 'Backend' },
        //       { value: 'desktop', label: 'Desktop' },
        //       { value: 'components', label: 'Components' },
        //       { value: 'functions', label: 'Functions' },
        //       { value: 'docs', label: 'Documentation' },
        //     ],
        //   })

        // if (answer === 'components')
        //   await components(options)
        // else if (answer === 'functions')
        //   await functions(options)
        // else if (answer === 'pages')
        //   await pages(options)
        // else if (answer === 'docs')
        //   await docs(options)

        // else process.exit(ExitCode.InvalidArgument)
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
        // else if (options.docs)
      }
      // await startDevelopmentServer(options)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:components', descriptions.components)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      const perf = await intro('buddy dev:components')
      const result = await runCommand(`bunx --bun vite --config ${vitePath('src/vue-components.ts')}`, options)

      if (options.verbose)
        log.info('buddy dev:components result', result)

      if (result.isErr()) {
        await outro('While running the dev:components command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
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
        await outro('While running the dev:docs command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:desktop', descriptions.desktop)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await runDesktopDevServer(options)
    })

  buddy
    .command('dev:functions', descriptions.api)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await runFunctionsDevServer(options)
    })

  buddy
    .command('dev:views', descriptions.pages)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await runPagesDevServer(options)
    })
}

function hasNoOptions(options: DevOptions) {
  return !options.components && !options.all && !options.docs && !options.api && !options.pages
}
