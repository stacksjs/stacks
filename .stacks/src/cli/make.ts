import { ExitCode } from '@stacksjs/types'
import type { CLI, MakeOptions } from '@stacksjs/types'
import { Prompts, consola } from '@stacksjs/cli'
import { component as makeComponent, fx as makeFunction, language as makeLanguage, page as makePage, stack as makeStack } from './actions/make'
// import { component as makeComponent, fx as makeFunction, language as makeLanguage, notification as makeNotification, page as makePage, stack as makeStack } from './actions/make'

const { prompts } = Prompts

async function make(stacks: CLI) {
  stacks
    .command('make', 'The make command')
    .option('-c, --component', 'Create a new component', { default: false })
    .option('-p, --page', 'Create a new page', { default: false })
    .option('-f, --function', 'Create a new function', { default: false })
    .option('-l, --language', 'Create a new language', { default: false })
    .option('-d, --database', 'Create a new database', { default: false })
    .option('-m, --migration', 'Create a new migration', { default: false })
    .option('-f, --factory', 'Create a new factory', { default: false })
    .option('-n, --notification', 'Create a new notification', { default: false })
    .option('-s, --stack', 'Create a new new stack', { default: false })
    .option('--debug', 'Add additional debug logging', { default: false })
    .action(async (options: MakeOptions) => {
      const name = stacks.args[0]

      if (hasNoOptions(options)) {
        if (!name) {
          consola.error('You need to specify a name')
          process.exit(ExitCode.InvalidArgument)
        }

        const answers = await prompts.multiselect({
          type: 'multiselect',
          name: 'make',
          message: 'What are you trying to make?',
          choices: [
            { title: 'Component', value: 'component' },
            { title: 'Function', value: 'function' },
            { title: 'Page', value: 'page' },
            { title: 'Language', value: 'language' },
            { title: 'Notification', value: 'notification' },
            { title: 'Database', value: 'database' },
            { title: 'Migration', value: 'migration' },
            { title: 'Factory', value: 'factory' },
            { title: 'Stack', value: 'stack' },
          ],
        })

        // creates an object out of array and sets answers to true
        options = answers.reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      }

      // await runMake(stacks.args[0], options)
    })

  stacks
    .command('make:component', 'Create a new component')
    .action(async () => {
      await makeComponent(stacks.args[0])
    })

  stacks
    .command('make:database', 'Create a new database')
    .action(async () => {
      // await makeDatabase(stacks.args[0])
    })

  stacks
    .command('make:migration', 'Create a new migration')
    .action(async () => {
      // await makeDatabase(stacks.args[0])
    })

  stacks
    .command('make:factory', 'Create a new factory')
    .action(async () => {
      // await makeDatabase(stacks.args[0])
    })

  stacks
    .command('make:page', 'Create a new page')
    .action(async () => {
      await makePage(stacks.args[0])
    })

  stacks
    .command('make:function', 'Create a new function')
    .action(async () => {
      await makeFunction(stacks.args[0])
    })

  stacks
    .command('make:lang', 'Create a new language file')
    .action(async () => {
      await makeLanguage(stacks.args[0])
    })

  stacks
    .command('make:notification', 'Create a new language notification')
    .action(async () => {
      // await makeNotification(stacks.args[0])
    })

  stacks
    .command('make:stack', 'Create a new new stack')
    .action(async () => {
      await makeStack(stacks.args[0])
    })
}

function hasNoOptions(options: MakeOptions) {
  return !options.component && !options.page && !options.function && !options.language && !options.database && !options.migration && !options.factory && !options.notification && !options.stack
}

export { make }
