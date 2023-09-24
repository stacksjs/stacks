import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import { type CLI, type ExamplesOptions } from '@stacksjs/types'
import { runExample } from '@stacksjs/actions'

export function example(buddy: CLI) {
  const descriptions = {
    example: 'Which example do you want to see?',
    components: 'Test your libraries against your built bundle',
    vue: 'Test your Vue component library',
    webComponents: 'Test your web component library',
    select: 'Which example are you trying to view?',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('example', descriptions.example)
    .option('-c, --components', descriptions.components)
    .option('-v, --vue', descriptions.vue)
    .option('-w, --web-components', descriptions.webComponents)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ExamplesOptions) => {
      // const answer = await prompt.require()
      //   .select(descriptions.select, {
      //     options: [
      //       { value: 'components', label: 'Vue Components' },
      //       { value: 'web-components', label: 'Web Components' },
      //     ],
      //   })

      // if (answer === 'components')
      //   await componentExample(options)
      // else if (answer === 'web-components')
      //   await webComponentExample(options)
      // else process.exit(ExitCode.InvalidArgument)

      await runExample(options)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('example:vue', descriptions.vue)
    .option('-v, --vue', descriptions.verbose, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('example:components')
    .action(async (options: ExamplesOptions) => {
      await runExample(options)
    })

  buddy
    .command('example:web-components', 'Test your Web Component library.')
    .option('-w, --web-components', descriptions.verbose, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ExamplesOptions) => {
      await runExample(options)
    })

  buddy.on('example:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
