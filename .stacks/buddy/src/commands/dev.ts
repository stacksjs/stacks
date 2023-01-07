import { Action, ExitCode } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import type { CLI, DevOption, DevOptions } from '@stacksjs/types'
import { intro, outro, prompts } from '@stacksjs/cli'
import { components, desktop, docs, functions, pages, invoke as startDevelopmentServer } from '@stacksjs/actions/dev'

async function dev(buddy: CLI) {
  const descriptions = {
    components: 'Start the Components development server',
    desktop: 'Start the Desktop development server',
    functions: 'Start the Functions development server',
    docs: 'Start the Documentation development server',
    pages: 'Start the Pages development server',
    debug: 'Enable debug mode',
  }

  buddy
    .command('dev', 'Start the development server for any of the following')
    .option('-c, --components', descriptions.components)
    .option('-f, --functions', descriptions.functions)
    .option('-d, --docs', descriptions.docs)
    .option('-p, --pages', descriptions.pages)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: DevOptions) => {
      if (hasNoOptions(options)) {
        const answer: DevOption | void = await prompts.select({
          type: 'select',
          name: 'development',
          message: 'Which development server are you trying to start?',
          choices: [
            { title: 'Components', value: 'components' },
            { title: 'Functions', value: 'functions' },
            { title: 'Pages', value: 'pages' },
            { title: 'Docs', value: 'docs' },
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
        else if (answer === 'docs')
          await docs(options)

        else process.exit(ExitCode.InvalidArgument)
      }

      await startDevelopmentServer(options)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:components', descriptions.components)
    .action(async (options: DevOptions) => {
      const perf = await intro('buddy dev:components')
      const result = await runAction(Action.DevComponents, { ...options, debug: true })

      if (result.isErr()) {
        outro('While running the dev:components command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      outro('Finished running dev:components.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dev:docs', descriptions.docs)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: DevOptions) => {
      await docs(options)
    })

  buddy
    .command('dev:desktop', descriptions.desktop)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: DevOptions) => {
      await desktop(options)
    })

  buddy
    .command('dev:functions', descriptions.functions)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: DevOptions) => {
      await functions(options)
    })

  buddy
    .command('dev:pages', descriptions.pages)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: DevOptions) => {
      await pages(options)
    })
}

function hasNoOptions(options: DevOptions) {
  return !options.components && !options.all && !options.docs && !options.functions && !options.pages
}

export { dev }
