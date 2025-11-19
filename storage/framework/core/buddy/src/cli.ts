import type { CLI } from '@stacksjs/cli'
import process from 'node:process'
import { cli, log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

// Get the command being run to determine what to load
const args = process.argv.slice(2)
const requestedCommand = args[0] || 'help'
const needsFullSetup = !['dev', 'build', 'test', 'lint', '--version', '-v', '--help', '-h', 'help'].includes(requestedCommand)

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

  // Skip expensive setup for commands that don't need it
  if (needsFullSetup) {
    const { runAction } = await import('@stacksjs/actions')
    const { Action } = await import('@stacksjs/enums')
    const { ensureProjectIsInitialized } = await import('@stacksjs/utils')
    const { fs } = await import('@stacksjs/storage')

    // Load required commands for setup
    const { setup } = await import('./commands/setup.ts')
    const { key } = await import('./commands/key.ts')

    setup(buddy)
    key(buddy)

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

    // Load all commands only if we need them
    const cmd = await import('./commands/index.ts')

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
    cmd.schedule(buddy)
    cmd.test(buddy)
    cmd.tinker(buddy)
    cmd.version(buddy)
    cmd.prepublish(buddy)
    cmd.upgrade(buddy)

    // dynamic imports
    await dynamicImports(buddy)
  }
  else {
    // For simple commands like --version, just register that one command
    const { version } = await import('./commands/version.ts')
    version(buddy)
  }

  buddy.help()
  buddy.parse()
}

await main()

async function dynamicImports(buddy: CLI) {
  // dynamically import and register commands from ./app/Commands/*
  const { fs } = await import('@stacksjs/storage')
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
