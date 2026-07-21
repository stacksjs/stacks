import type { CLI } from '@stacksjs/cli'
import process from 'node:process'
import { cli, log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { registerGlobalOptions } from './global-options'

// Enforce the minimum supported Bun version before anything else runs, so an
// outdated runtime fails fast with a clear message instead of an obscure error
// deep inside a command. Fail open when the version cannot be determined: the
// guard must never brick an exotic setup.
try {
  const { isSupportedBunVersion, minimumBunVersion } = await import('@stacksjs/utils')
  const currentBunVersion = typeof Bun !== 'undefined' ? Bun.version : process.versions.bun

  if (currentBunVersion && !isSupportedBunVersion(currentBunVersion)) {
    console.error(`[buddy] Bun v${minimumBunVersion} or later is required (current: v${currentBunVersion}). Run: bun upgrade`)
    process.exit(1)
  }
}
catch {
  // Version could not be determined or compared; let the CLI continue and
  // surface real errors if the runtime is genuinely too old.
}

// Get the command being run to determine what to load
const args = process.argv.slice(2)
const requestedCommand = args[0] || 'help'
const isHelpFlag = args.includes('--help') || args.includes('-h')
// Pure version queries: print version and exit, no command surface needed.
const isVersionOnly = ['--version', '-V', 'version'].includes(requestedCommand)
// Help mode: `./buddy`, `./buddy help`, `./buddy --help`, or `./buddy <cmd> --help`.
// We still need the full command registry so help output lists every command,
// but we can skip the APP_KEY check and other project-setup work.
const isHelpMode = requestedCommand === 'help' || (isHelpFlag && args.length <= 2)
const skipAppKeyCheck = [
  'build',
  'lint',
  'lint:fix',
  'test',
  'test:types',
  'test:unit',
  'test:feature',
  'typecheck',
  'types:fix',
  'types:generate',
  'clean',
  'fresh',
  'about',
  'doctor',
  'list',
  'setup',
  'setup:ssl',
  'setup:oh-my-zsh',
  'deploy',
  'serve',
  // `new` / `create` scaffold a brand-new project from any cwd, so the host
  // project's APP_KEY check would either spuriously fail (no .env in cwd) or,
  // worse, write a key into an unrelated directory.
  'new',
  'create',
  'migrate',
  'seed',
  'generate',
  'make',
  'key:generate',
  'scaffold:crud',
].some(cmd => requestedCommand === cmd || requestedCommand.startsWith(`${cmd}:`)) || isHelpFlag || isHelpMode
const needsFullSetup = !isVersionOnly

// Setup global error handlers (skip for minimal commands for performance)
if (needsFullSetup) {
  // Write the stack synchronously to stderr BEFORE exiting. `log.error` alone
  // can be lost when stdout/stderr is block-buffered (piped, e.g. in CI) and
  // the process exits immediately after — which made a thrown deploy
  // prerequisite look like a silent `exit 1` with zero output. The direct
  // `process.stderr.write` flushes; `log.error` still provides the styled line.
  const reportFatal = (label: string, error: unknown): never => {
    log.debug(`Buddy ${label}`)
    try {
      process.stderr.write(`\n[buddy] ${label}: ${(error as any)?.stack ?? String(error)}\n`)
    }
    catch {}
    log.error(error as Error)
    return process.exit(1)
  }

  process.on('uncaughtException', error => reportFatal('uncaughtException', error))
  process.on('unhandledRejection', error => reportFatal('unhandledRejection', error))
}

async function main() {
  const buddy = cli('buddy')
  // `upgrade` intentionally reuses `-V, --version <version>` for the target
  // framework release. Registering Buddy's process-wide version flag there
  // makes clapp consume the option globally and reject the documented
  // space-separated target value.
  registerGlobalOptions(buddy, {
    version: requestedCommand !== 'upgrade' && requestedCommand !== 'update',
  })

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
    const { loadCommands, getCommandsToLoad, markLoaded } = await import('./lazy-commands.ts')

    // Load required commands for setup and key generation, then tell the
    // registry we've handled them so the bulk loader doesn't double-register.
    const { setup } = await import('./commands/setup.ts')
    setup(buddy as any)
    markLoaded(buddy as any, 'setup')

    // Before running any commands, ensure the project is already initialized
    // Skip APP_KEY check for commands that don't need it (build, lint, test, etc.)
    if (!skipAppKeyCheck) {
      const { runAction } = await import('@stacksjs/actions')
      const { Action } = await import('@stacksjs/enums')
      const { ensureProjectIsInitialized } = await import('@stacksjs/utils')

      const isAppKeySet = await ensureProjectIsInitialized()
      if (!isAppKeySet) {
        log.info('Your `APP_KEY` is not yet set')
        log.info('Generating application key...')
        const result = await runAction(Action.KeyGenerate)

        if (result.isErr) {
          log.error('Failed to set random application key.', result.error)
          process.exit(1)
        }
      }
    }

    // Use lazy loading for better cold start performance
    const commandsToLoad = getCommandsToLoad(args)
    await loadCommands(commandsToLoad, buddy as any)

    // Load user commands from app/Commands/
    await dynamicImports(buddy)
  }
  else {
    // For minimal commands, only load what's needed for better cold start
    const { loadCommand } = await import('./lazy-commands.ts')
    await loadCommand('version', buddy as any)
  }

  buddy.help()

  // Handle interactive mode when no command is specified
  if (args.length === 0 && process.stdin.isTTY && !(buddy as any).isNoInteraction) {
    await showInteractiveMenu(buddy)
  }
  else {
    await parseOrExit(buddy)
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
    await parseOrExit(buddy)
  }
}

/**
 * clapp throws ClappError for usage problems (unknown option, missing
 * argument). Left unhandled, the rejection lands in the process-level
 * handler and prints a full stack trace for a simple typo. Render usage
 * errors as a one-line message plus the command's usage line instead.
 * The duck-typed check works against every clapp version that carries
 * exitCode/isUsageError (the isClappError() export only exists in newer
 * releases).
 */
async function parseOrExit(buddy: CLI): Promise<void> {
  try {
    await buddy.parse()
  }
  catch (error: any) {
    const isUsageError = error?.name === 'ClappError' || error?.isUsageError === true
    if (!isUsageError)
      throw error

    process.stderr.write(`${error.message}\n`)
    if (error.usage)
      process.stderr.write(`${error.usage}\n`)
    process.exit(typeof error.exitCode === 'number' ? error.exitCode : 2)
  }
}

await main()

async function dynamicImports(buddy: CLI) {
  const { fs } = await import('@stacksjs/storage')
  const commandsDir = p.appPath('Commands')

  // Try to load command registry from Commands.ts
  try {
    const registryPath = p.appPath('Commands.ts')
    const registryImport = await import(registryPath)
    const registry = registryImport.default || {}

    // Load commands from registry
    for (const [signature, config] of Object.entries(registry)) {
      // Skip if config is a string (simple registration) - will be loaded below
      // Or handle config object
      const commandConfig = typeof config === 'string'
        ? { file: config, enabled: true }
        : config as { file: string, enabled?: boolean, aliases?: string[] }

      // Skip disabled commands
      if (commandConfig.enabled === false) {
        continue
      }

      const commandPath = `${commandsDir}/${commandConfig.file}.ts`

      // Check if file exists
      if (!fs.existsSync(commandPath)) {
        log.debug(`Command file not found: ${commandPath} (registered as '${signature}')`)
        continue
      }

      try {
        const dynamicImport = await import(commandPath)

        if (typeof dynamicImport.default === 'function') {
          dynamicImport.default(buddy)

          // Register aliases if specified
          if (commandConfig.aliases && Array.isArray(commandConfig.aliases)) {
            for (const alias of commandConfig.aliases) {
              ;(buddy as any).alias(signature, alias)
            }
          }
        }
        else {
          log.error(`Expected a default export function in ${commandConfig.file}.ts, but got:`, dynamicImport.default)
        }
      }
      catch (error) {
        log.error(`Failed to load command ${commandConfig.file}:`, error)
      }
    }
  }
  catch {
    // If Commands.ts doesn't exist, fall back to auto-discovery
    if (!fs.existsSync(commandsDir)) {
      log.debug('app/Commands directory not found, skipping user commands')
      return
    }

    log.debug('Commands.ts not found, using auto-discovery')

    const commandFiles = fs.readdirSync(commandsDir).filter((file: string) => file.endsWith('.ts'))

    for (const file of commandFiles) {
      const commandPath = `${commandsDir}/${file}`

      try {
        const dynamicImport = await import(commandPath)

        if (typeof dynamicImport.default === 'function')
          dynamicImport.default(buddy)
        else
          log.debug(`Skipping ${file} — no default export function`)
      }
      catch (error) {
        log.error(`Failed to load command ${file}:`, error)
      }
    }
  }

  // Load console listeners
  try {
    const listenerImport = await import(p.listenersPath('Console.ts'))
    if (typeof listenerImport.default === 'function')
      listenerImport.default(buddy)
  }
  catch {
    // Console.ts listener is optional
  }
}
