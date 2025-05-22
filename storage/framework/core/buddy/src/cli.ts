import type { CAC } from '@stacksjs/cli'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { cli, log } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { path as p } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import { ensureProjectIsInitialized } from '@stacksjs/utils'
import * as cmd from './commands'

// setup global error handlers
process.on('uncaughtException', (error: Error) => {
  log.debug('Buddy uncaughtException')
  log.error(error)
  process.exit(1)
})

process.on('unhandledRejection', (error: Error) => {
  log.debug('Buddy unhandledRejection')
  log.error(error)
  process.exit(1)
})

async function main() {
  const buddy = cli('buddy')

  // the following commands are not dependent on the project being initialized
  cmd.setup(buddy)
  cmd.key(buddy)

  // before running any commands, ensure the project is already initialized
  const isAppKeySet = await ensureProjectIsInitialized()
  if (isAppKeySet) {
    log.debug('Project is initialized')
  }
  else {
    log.info('Your `APP_KEY` is not yet set')
    log.info('Generating application key...')
    const result = await runAction(Action.KeyGenerate)

    if (result.isErr()) {
      log.error('Failed to set random application key.', result.error)
      process.exit()
    }
  }

  cmd.auth(buddy)
  cmd.build(buddy)
  cmd.changelog(buddy)
  cmd.clean(buddy)
  cmd.cloud(buddy)
  cmd.commit(buddy)
  cmd.configure(buddy)
  cmd.dev(buddy)
  cmd.domains(buddy)
  cmd.deploy(buddy)
  cmd.dns(buddy)
  cmd.ports(buddy)
  cmd.projects(buddy)
  cmd.fresh(buddy)
  cmd.generate(buddy)
  cmd.http(buddy)
  cmd.install(buddy)
  cmd.lint(buddy)
  cmd.list(buddy)
  cmd.make(buddy)
  cmd.migrate(buddy)
  cmd.outdated(buddy)
  cmd.queue(buddy)
  cmd.release(buddy)
  cmd.route(buddy)
  cmd.saas(buddy)
  cmd.search(buddy)
  cmd.env(buddy)
  cmd.seed(buddy)
  cmd.setup(buddy)
  cmd.schedule(buddy)
  cmd.test(buddy)
  cmd.tinker(buddy)
  cmd.version(buddy)
  cmd.prepublish(buddy)
  cmd.upgrade(buddy)

  // dynamic imports
  await dynamicImports(buddy)

  buddy.help()
  buddy.parse()
}

await main()

async function dynamicImports(buddy: CAC) {
  // dynamically import and register commands from ./app/Commands/*
  const commandsDir = p.appPath('Commands')
  const commandFiles = fs.readdirSync(commandsDir).filter((file: string) => file.endsWith('.ts'))

  for (const file of commandFiles) {
    const commandPath = `${commandsDir}/${file}`
    const dynamicImport = await import(commandPath)

    // Correctly use the default export function
    if (typeof dynamicImport.default === 'function')
      dynamicImport.default(buddy)
    else console.error(`Expected a default export function in ${file}, but got:`, dynamicImport.default)
  }

  const listenerImport = await import(p.listenersPath('Console.ts'))
  if (typeof listenerImport.default === 'function')
    listenerImport.default(buddy)
}
