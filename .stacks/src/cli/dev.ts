import { ExitCode } from '@stacksjs/types'
import type { CLI, DevOption, DevOptions } from '@stacksjs/types'
import { Prompts } from '@stacksjs/cli'
import { components, docs, functions, pages, invoke as startDevelopmentServer } from './actions/dev'

const { prompts } = Prompts

const descriptions = {
  components: 'Start the Components development server',
  functions: 'Start the Functions development server',
  docs: 'Start the Documentation development server',
  pages: 'Start the Pages development server',
  debug: 'Add additional debug logging',
}

async function dev(stacks: CLI) {
  stacks
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
    })

  stacks
    .command('dev:components', descriptions.components)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: DevOptions) => {
      await startDevelopmentServer(options)
    })

  stacks
    .command('dev:docs', descriptions.docs)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: DevOptions) => {
      await docs(options)
    })

  stacks
    .command('dev:functions', descriptions.functions)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: DevOptions) => {
      await functions(options)
    })

  stacks
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
