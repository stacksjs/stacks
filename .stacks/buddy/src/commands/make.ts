import { ExitCode } from '@stacksjs/types'
import type { CLI, MakeOptions } from '@stacksjs/types'
import { intro, italic, log, outro, prompts, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import {
  createModel,
  createNotification,
  invoke,
  component as makeComponent,
  database as makeDatabase,
  factory as makeFactory,
  fx as makeFunction,
  language as makeLanguage,
  page as makePage,
  stack as makeStack,

} from '@stacksjs/actions/make'

async function make(buddy: CLI) {
  const descriptions = {
    model: 'Create a new model',
    component: 'Create a new component',
    page: 'Create a new page',
    function: 'Create a new function',
    language: 'Create a new language',
    database: 'Create a new database',
    migration: 'Create a new migration',
    factory: 'Create a new factory',
    notification: 'Create a new notification',
    stack: 'Create a new new stack',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
  }

  buddy
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
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const name = buddy.args[0]

      if (!name) {
        log.error('You need to specify a name. Read more about the documentation here.')
        process.exit()
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

  buddy
    .command('make:component', descriptions.component)
    .option('-n, --name', 'The name of the component')
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify a name. Read more about the documentation here.')
        process.exit()
      }

      await makeComponent(options)
    })

  buddy
    .command('make:database', descriptions.database)
    .option('-n, --name', 'The name of the database')
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify a name. Read more about the documentation here.')
        process.exit()
      }

      await makeDatabase(options)
    })

  buddy
    .command('make:factory', descriptions.factory)
    .option('-n, --name', 'The name of the factory')
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify a name. Read more about the documentation here.')
        process.exit()
      }

      await makeFactory(options)
    })

  buddy
    .command('make:page', descriptions.page)
    .option('-n, --name', 'The name of the page')
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify a name. Read more about the documentation here.')
        process.exit()
      }

      await makePage(options)
    })

  buddy
    .command('make:function', descriptions.function)
    .option('-n, --name', 'The name of the function')
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      await makeFunction(options)
    })

  buddy
    .command('make:lang', descriptions.language)
    .option('-n, --name', 'The name of the language')
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify a name. Read more about the documentation here.')
        process.exit()
      }

      await makeLanguage(options)
    })

  buddy
    .command('make:notification', descriptions.notification)
    .option('-n, --name', 'The name of the notification')
    .option('-e, --email', 'Is it an email notification?', { default: true })
    .option('-c, --chat', 'Is it a chat notification?', { default: false })
    .option('-s, --sms', 'Is it a SMS notification?', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const perf = await intro('buddy make:notification')

      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify a name. Read more about the documentation here.')
        process.exit()
      }

      const result = await createNotification(options)

      if (!result) {
        outro('While running the make:notification command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
        process.exit()
      }

      outro(`Created your ${italic(name)} notification.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('make:stack', descriptions.stack)
    .option('-n, --name', 'The name of the stack')
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: MakeOptions) => {
      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify a name. Read more about the documentation here.')
        process.exit()
      }

      await makeStack(options)
    })

  buddy
    .command('make:model', descriptions.model)
    .option('-n, --name', 'The name of the model')
    .action(async (options: MakeOptions) => {
      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify the model name')
        process.exit()
      }

      await createModel(options)
    })

  buddy
    .command('make:migration', descriptions.migration)
    .option('-n, --name', 'The name of the migration')
    .option('-e, --env', 'The environment to run the migration in', { default: 'dev' })
    .action(async (options: MakeOptions) => {
      const path = `${projectPath()}/.stacks/database/schema.prisma`
      const name = buddy.args[0] || options.name
      options.name = name

      if (!name) {
        log.error('You need to specify the migration name')
        process.exit()
      }

      await runCommand(`npx prisma migrate ${options.env} --name=${name} --schema=${path}`)
      log.success(path, name)
    })
}

function hasNoOptions(options: MakeOptions) {
  return !options.component && !options.page && !options.function && !options.language && !options.database && !options.migration && !options.factory && !options.notification && !options.stack
}

export { make }
