import { ExitCode } from '@stacksjs/types'
import type { CLI, ExampleOption, ExampleOptions } from '@stacksjs/types'
import { Prompts } from '@stacksjs/cli'
import { componentExample, invoke as runExample, webComponentExample } from './actions/examples'

const { prompts } = Prompts

async function example(stacks: CLI) {
  stacks
    .command('example', 'Test your libraries against your built bundle.')
    .option('-c, --components', 'Test your Vue component library')
    .option('-v, --vue', 'Test your Vue component library')
    .option('-w, --web-components', 'Test your web component library')
    .action(async (options: ExampleOptions) => {
      const answer: ExampleOption = await prompts.select({
        type: 'select',
        name: 'example',
        message: 'Which example are you trying to view?',
        choices: [
          { title: 'Components', value: 'components' },
          { title: 'Web Components', value: 'web-components' },
        ],
      })

      if (answer !== null)
        process.exit(ExitCode.InvalidArgument)

      if (answer === 'components')
        await componentExample()

      if (answer === 'web-components')
        await webComponentExample()

      else process.exit(ExitCode.InvalidArgument)

      await runExample(options)
    })

  stacks
    .command('example:vue', 'Test your Vue component library.')
    .alias('example:components')
    .action(async () => {
      await runExample('vue')
    })

  stacks
    .command('example:web-components', 'Test your Web Component library.')
    .action(async () => {
      await runExample('web-components')
    })
}

export { example }
