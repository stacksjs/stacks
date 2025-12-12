import type { CLI } from '@stacksjs/cli'
import process from 'node:process'
import { cli, log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

// Get the command being run to determine what to load
const args = process.argv.slice(2)
const requestedCommand = args[0] || 'help'
// Minimal commands that don't need full project setup
const isMinimalCommand = ['--version', '-v', '--help', '-h', 'help', 'version'].includes(requestedCommand)
const needsFullSetup = !isMinimalCommand

// Setup global error handlers (skip for minimal commands for performance)
if (needsFullSetup) {
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
}

async function main() {
  const buddy = cli('buddy')

  // Enable theme support
  // buddy.themes() // TODO: Re-enable after clapp npm package is updated with themes() method

  // Load and apply buddy.config.ts only if it exists (performance optimization)
  const configPath = './buddy.config.ts'
  try {
    // Use Bun's fast file check
    await Bun.file(configPath).text()
    const { applyBuddyConfig } = await import('./config.ts')
    await applyBuddyConfig(buddy)
  }
  catch {
    // Config file doesn't exist, skip loading (saves ~5-10ms)
  }

  // Skip expensive setup for commands that don't need it
  if (needsFullSetup) {
    const { runAction } = await import('@stacksjs/actions')
    const { Action } = await import('@stacksjs/enums')
    const { ensureProjectIsInitialized } = await import('@stacksjs/utils')

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

      if (result.isErr) {
        log.error('Failed to set random application key.', result.error)
        process.exit()
      }
    }

    // Use lazy loading for better cold start performance
    const { loadCommands, getCommandsToLoad } = await import('./lazy-commands.ts')
    const commandsToLoad = getCommandsToLoad(args)
    await loadCommands(commandsToLoad, buddy)

    // dynamic imports
    await dynamicImports(buddy)
  }
  else {
    // For minimal commands, only load what's needed for better cold start
    const { loadCommand } = await import('./lazy-commands.ts')
    await loadCommand('version', buddy)
  }

  buddy.help()

  // Handle interactive mode when no command is specified
  if (args.length === 0 && process.stdin.isTTY && !buddy.isNoInteraction) {
    await showInteractiveMenu(buddy)
  }
  else {
    buddy.parse()
  }

  // Apply theme if specified
  // Note: Theme support will be available after @stacksjs/clapp is updated with theme exports
  // if (buddy.theme) {
  //   const { applyTheme, getAvailableThemes } = await import('@stacksjs/clapp')
  //   const availableThemes = getAvailableThemes()
  //   if (availableThemes.includes(buddy.theme)) {
  //     applyTheme(buddy.theme as any)
  //   }
  //   else {
  //     log.warn(`Unknown theme: ${buddy.theme}. Available themes: ${availableThemes.join(', ')}`)
  //   }
  // }
}

async function showInteractiveMenu(buddy: CLI) {
  const { bold, green, intro } = await import('@stacksjs/cli')
  const { select } = await import('@stacksjs/cli')

  await intro('buddy')

  console.log(bold(green('What would you like to do?')))
  console.log('')

  const choice = await select({
    message: 'Select a command:',
    choices: [
      { value: 'dev', label: 'Start development server' },
      { value: 'build', label: 'Build for production' },
      { value: 'test', label: 'Run tests' },
      { value: 'list', label: 'List all commands' },
      { value: 'doctor', label: 'Run health checks' },
      { value: 'about', label: 'Show system information' },
      { value: 'help', label: 'Show help' },
      { value: 'exit', label: 'Exit' },
    ],
    initial: 0,
  })

  console.log('')

  if (choice === 'exit') {
    process.exit(0)
  }
  else if (choice === 'help') {
    buddy.outputHelp()
  }
  else {
    // Run the selected command
    process.argv = ['bun', 'buddy', choice]
    buddy.parse()
  }
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
