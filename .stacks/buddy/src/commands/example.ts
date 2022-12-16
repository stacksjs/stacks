import { ExitCode } from '@stacksjs/types'
import type { CLI, ExamplesOption, ExamplesOptions } from '@stacksjs/types'
import { italic, log, prompts } from '@stacksjs/cli'
import { componentExample, invoke as runExample, webComponentExample } from '@stacksjs/actions/examples'

async function example(buddy: CLI) {
  const descriptions = {
    example: 'Which example do you want to see?',
    components: 'Test your libraries against your built bundle',
    vue: 'Test your Vue component library',
    webComponents: 'Test your web component library',
    debug: 'Enable debug mode',
  }

  buddy
    .command('example', descriptions.example)
    .option('-c, --components', descriptions.components)
    .option('-v, --vue', descriptions.vue)
    .option('-w, --web-components', descriptions.webComponents)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: ExamplesOptions) => {
      const answer: ExamplesOption = await prompts.select({
        type: 'select',
        name: 'example',
        message: 'Which example are you trying to view?',
        choices: [
          { title: 'Components', value: 'components' },
          { title: 'Web Components', value: 'web-components' },
        ],
      })

      if (answer !== null) {
        log.error(`You did not provide an answer. Please try again, ${italic('or report the issue')}`)
        process.exit()
      }

      if (answer === 'components')
        await componentExample(options)
      else if (answer === 'web-components')
        await webComponentExample(options)
      else process.exit(ExitCode.InvalidArgument)

      await runExample(options)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('example:vue', descriptions.vue)
    .option('-v, --vue', descriptions.debug, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .alias('example:components')
    .action(async (options: ExamplesOptions) => {
      await runExample(options)
    })

  buddy
    .command('example:web-components', 'Test your Web Component library.')
    .option('-w, --web-components', descriptions.debug, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: ExamplesOptions) => {
      await runExample(options)
    })
}

export { example }
