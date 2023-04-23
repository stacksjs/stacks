import { Action, ExitCode } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import type { CLI, DevOptions } from '@stacksjs/types'
import { intro, log, outro, prompt } from '@stacksjs/cli'
import { components, desktop, functions, pages } from '@stacksjs/actions/dev'

// import { components, desktop, functions, pages, invoke as startDevelopmentServer } from '@stacksjs/actions/dev'

async function dev(buddy: CLI) {
  const descriptions = {
    components: 'Start the Components development server',
    desktop: 'Start the Desktop development server',
    functions: 'Start the Functions development server',
    docs: 'Start the Documentation development server',
    pages: 'Start the Pages development server',
    select: 'Which development server are you trying to start?',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('dev', 'Start the development server for any of the following')
    .option('-c, --components', descriptions.components)
    .option('-f, --functions', descriptions.functions)
    .option('-d, --docs', descriptions.docs)
    .option('-p, --pages', descriptions.pages)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      if (hasNoOptions(options)) {
        const answer = await prompt(descriptions.select, {
          type: 'select',
          required: true,
          options: [
            { value: 'pages', label: 'Pages' },
            { value: 'desktop', label: 'Desktop' },
            { value: 'components', label: 'Components' },
            { value: 'functions', label: 'Functions' },
            { value: 'docs', label: 'Documentation' },
          ],
        })

        if (answer !== null)
          process.exit(ExitCode.InvalidArgument)

        if (answer === 'components')
          await components(options)
        else if (answer === 'functions')
          await functions(options)
        else if (answer === 'pages')
          await pages(options)
        // else if (answer === 'docs')
          // await docs(options)

        else process.exit(ExitCode.InvalidArgument)
      }

      // await startDevelopmentServer(options)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:components', descriptions.components)
    .action(async (options: DevOptions) => {
      const perf = await intro('buddy dev:components')
      const result = await runAction(Action.DevComponents, { ...options, verbose: true })

      if (options.verbose)
        log.info('The result object is', result)

      // check if result is an array
      if (Array.isArray(result)) {
        // check if any of the items in the array is an error
        if (result.some(item => item.isErr())) {
          outro('While running the dev:components command, there was an issue', { startTime: perf, useSeconds: true, isError: true })
          process.exit()
        }
      }

      // check if result is an error
      else if (result.isErr()) {
        outro('While running the dev:components command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      outro('Finished running dev:components.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:docs', descriptions.docs)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      const perf = await intro('buddy dev:docs')
      const result = await runAction(Action.DevDocs, { ...options, verbose: true })

      // check if result is an array
      if (Array.isArray(result)) {
        // check if any of the items in the array is an error
        if (result.some(item => item.isErr())) {
          outro('While running the dev:docs command, there was an issue', { startTime: perf, useSeconds: true, isError: true })
          process.exit()
        }
      }

      // check if result is an error
      else if (result.isErr()) {
        outro('While running the dev:components command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      outro('Finished running dev:docs.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:desktop', descriptions.desktop)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await desktop(options)
    })

  buddy
    .command('dev:functions', descriptions.functions)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await functions(options)
    })

  buddy
    .command('dev:pages', descriptions.pages)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: DevOptions) => {
      await pages(options)
    })
}

function hasNoOptions(options: DevOptions) {
  return !options.components && !options.all && !options.docs && !options.functions && !options.pages
}

export { dev }
