import { ExitCode } from '@stacksjs/types'
import type { CLI, MakeOptions } from '@stacksjs/types'
import { Prompts, consola } from '@stacksjs/cli'
import { invoke, component as makeComponent, fx as makeFunction, language as makeLanguage, page as makePage, stack as makeStack } from './actions/make'
// import { component as makeComponent, fx as makeFunction, language as makeLanguage, notification as makeNotification, page as makePage, stack as makeStack } from './actions/make'

const { prompts } = Prompts

const descriptions = {
  component: 'Create a new component',
  page: 'Create a new page',
  function: 'Create a new function',
  language: 'Create a new language',
  database: 'Create a new database',
  migration: 'Create a new migration',
  factory: 'Create a new factory',
  notification: 'Create a new notification',
  stack: 'Create a new new stack',
  debug: 'Add additional debug logging',
}

async function make(stacks: CLI) {
  stacks
    .command('make', 'The make command')
    .option('-c, --component', descriptions.component, { default: false })
    .option('-p, --page', descriptions.page, { default: false })
    .option('-f, --function', descriptions.function, { default: false })
    .option('-l, --language', descriptions.language, { default: false })
    .option('-d, --database', descriptions.database, { default: false })
    .option('-m, --migration', descriptions.migration, { default: false })
    .option('-f, --factory', descriptions.factory, { default: false })
    .option('-n, --notification', descriptions.notification, { default: false })
    .option('-s, --stack', descriptions.stack, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const name = stacks.args[0]

      if (!name) {
        consola.error('You need to specify a name. Read more about the documentation here.')
        process.exit(ExitCode.InvalidArgument)
      }

      if (hasNoOptions(options)) {
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

      await invoke(options)

      process.exit(ExitCode.Success)
    })

  stacks
    .command('make:component', 'Create a new component')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeComponent(options)
    })

  stacks
    .command('make:database', 'Create a new database')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeDatabase(options)
    })

  stacks
    .command('make:migration', 'Create a new migration')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeMigration(options)
    })

  stacks
    .command('make:factory', 'Create a new factory')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeFactory(options)
    })

  stacks
    .command('make:page', 'Create a new page')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makePage(options)
    })

  stacks
    .command('make:function', 'Create a new function')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeFunction(options)
    })

  stacks
    .command('make:lang', 'Create a new language file')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeLanguage(options)
    })

  stacks
    .command('make:notification', 'Create a new language notification')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeNotification(options)
    })

  stacks
    .command('make:stack', 'Create a new new stack')
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeStack(options)
    })
}

function hasNoOptions(options: MakeOptions) {
  return !options.component && !options.page && !options.function && !options.language && !options.database && !options.migration && !options.factory && !options.notification && !options.stack
}

export { make }
