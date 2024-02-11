import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { CAC } from 'cac'
import { ensureProjectIsInitialized } from '@stacksjs/utils'
import { path as p } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { log } from '@stacksjs/cli'
import { collect } from '@stacksjs/collections'
import * as cmd from './commands'

// setup global error handlers
process.on('uncaughtException', (error: Error) => {
  console.error('An error occurred:', error.message)
  // handleError(error)
  process.exit(1)
})

process.on('uncaughtException', (error: Error) => {
  console.error('An error occurred:', error.message)
  handleError(error)
  process.exit(1)
})

// process.on('unhandledRejection', errorHandler)

// function errorHandler(error: Error) {
//   console.error('An error occurred:', error.message)
//   log.error(error.message)
//   process.exit(1)
// }

async function main() {
  // const buddy = cli('buddy')
  const buddy = new CAC('buddy')

  // the following commands are not dependent on the project being initialized
  cmd.setup(buddy)
  cmd.key(buddy)

  // before running any commands, ensure the project is already initialized
  await ensureProjectIsInitialized()

  cmd.build(buddy)
  cmd.changelog(buddy)
  cmd.clean(buddy)
  cmd.cloud(buddy)
  // cmd.commit(buddy)
  cmd.configure(buddy)
  cmd.dev(buddy)
  cmd.domains(buddy)
  cmd.deploy(buddy)
  cmd.dns(buddy)
  cmd.fresh(buddy)
  cmd.generate(buddy)
  cmd.http(buddy)
  cmd.install(buddy)
  cmd.lint(buddy)
  cmd.list(buddy)
  // cmd.make(buddy)
  // cmd.migrate(buddy)
  cmd.release(buddy)
  // cmd.seed(buddy)
  cmd.setup(buddy)
  // cmd.example(buddy)
  // cmd.test(buddy)
  // cmd.version(buddy)
  // cmd.prepublish(buddy)
  cmd.upgrade(buddy)

  const quotes = collect([
    'The best way to get started is to quit talking and begin doing.',
    'The pessimist sees difficulty in every opportunity. The optimist sees opportunity in every difficulty.',
    'Don’t let yesterday take up too much of today.',
    'You learn more from failure than from success. Don’t let it stop you. Failure builds character.',
    'It’s not whether you get knocked down, it’s whether you get up.',
    'If you are working on something that you really care about, you don’t have to be pushed. The vision pulls you.',
    'People who are crazy enough to think they can change the world, are the ones who do.',
    'Failure will never overtake me if my determination to succeed is strong enough.',
    'Entrepreneurs are great at dealing with uncertainty and also very good at minimizing risk. That’s the classic entrepreneur.',
    'We may encounter many defeats but we must not be defeated.',
    'Knowing is not enough; we must apply. Wishing is not enough; we must do.',
    'Imagine your life is perfect in every respect; what would it look like?',
    'We generate fears while we sit. We overcome them by action.',
    'Whether you think you can or think you can’t, you’re right.',
    'Security is mostly a superstition. Life is either a daring adventure or nothing.',
  ])

  buddy
    .command('inspire', 'Inspire yourself with a random quote')
    .alias('insp')
    .action(() => {
      log.info(quotes.random())
      log.success('Have a great dayss!')
    })

  buddy.on('inspire:*', () => {
    console.log('Invalid command:', buddy.args.join(' '))
    console.log('See `--help` for a list of available commands')
    throw new Error('Invalid command')
  })

  // dynamically import and register commands from ./app/Commands/*
  // const commandsDir = p.appPath('Commands')
  // const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.ts'))

  // for (const file of commandFiles) {
  //   const commandPath = `${commandsDir}/${file}`
  //   const dynamicImport = await import(commandPath)

  //   // Correctly use the default export function
  //   if (typeof dynamicImport.default === 'function')
  //     dynamicImport.default(buddy)
  //   else
  //     console.error(`Expected a default export function in ${file}, but got:`, dynamicImport.default)
  // }

  // const listenerImport = await import(p.listenersPath('Console.ts'))
  // if (typeof listenerImport.default === 'function')
  //   listenerImport.default(buddy)

  // buddy.on('inspire:two', () => {
  //   // eslint-disable-next-line no-console
  //   console.log('inspiring with two quotes')
  //   // Do something
  // })

  // buddy.on('changelog:*', () => {
  //   // eslint-disable-next-line no-console
  //   console.log('changelog with two quotes')
  //   process.exit(1)
  //   // Do something
  // })

  // console.log('buddy', buddy)
  // console.log('buddy running')
  buddy.help()
  buddy.parse()
  // console.log('process.argv', process.argv)
  // console.log('b.rawArgs', buddy.rawArgs)
  // await buddy.runMatchedCommand()
}

await main()
