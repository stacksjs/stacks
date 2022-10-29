import { ExitCode, NpmScript } from '@stacksjs/types'
import type { CLI, DevOption, DevOptions } from '@stacksjs/types'
import { Prompts, consola } from '@stacksjs/cli'
import { runNpmScript } from '@stacksjs/utils'
import { devComponents, invoke as startDevelopmentServer } from './actions/dev'

const { prompts } = Prompts

async function dev(stacks: CLI) {
  stacks
    .command('dev', 'Start the development server for any of the following')
    .option('-c, --components', 'Start the Components development server')
    .option('-f, --functions', 'Start the Functions development server')
    .option('-d, --docs', 'Start the Documentation development server')
    .option('-p, --pages', 'Start the Pages development server')
    .action(async (options: DevOptions) => {
      if (hasNoOptions(options)) {
        const answer: DevOption = await prompts.select({
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

        if (answer === 'components') {
          await devComponents()
        }

        else if (answer === 'functions') {
          consola.info('Starting development server for your components...')
          await runNpmScript(NpmScript.DevFunctions)
        }

        else if (answer === 'pages') {
          consola.info('Starting development server for your components...')
          await runNpmScript(NpmScript.DevPages)
        }

        else if (answer === 'docs') {
          consola.info('Starting docs server for your components...')
          await runNpmScript(NpmScript.DevDocs)
        }

        else { process.exit(ExitCode.InvalidArgument) }
      }

      await startDevelopmentServer(options)
    })

  stacks
    .command('dev:components', 'Start the development server for your component library')
    .action(async (options: DevOptions) => {
      await startDevelopmentServer(options)
    })

  stacks
    .command('dev:docs', 'Start the development server for your documentation')
    .action(async (options: DevOptions) => {
      await startDevelopmentServer({ docs: true, ...options.map(option => option !== 'dev') })
    })
}

function hasNoOptions(options: DevOptions) {
  return !options.components && !options.all && !options.docs && !options.functions && !options.pages
}

export { dev }
