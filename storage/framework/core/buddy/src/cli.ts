import type { CLI } from '@stacksjs/cli'
import process from 'node:process'
import { cli, log } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { registerGlobalOptions } from './global-options'
import { shouldSkipAppKeyCheck } from './project-setup'
import { resultFailed } from './result'

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
const skipAppKeyCheck = shouldSkipAppKeyCheck(requestedCommand, { isHelpFlag, isHelpMode })
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
      process.stderr.write(`\n[buddy] ${label}: ${(error as { stack?: string } | null)?.stack ?? String(error)}\n`)
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
    // Keep the runtime directories under storage/ wired up. Cheap (a handful of
    // lstat calls), idempotent, and never throws — see ensureRuntimeDirectories.
    p.ensureRuntimeDirectories()

    const { loadCommands, getCommandsToLoad, markLoaded } = await import('./lazy-commands.ts')

    // Load required commands for setup and key generation, then tell the
    // registry we've handled them so the bulk loader doesn't double-register.
    const { setup } = await import('./commands/setup.ts')
    setup(buddy)
    markLoaded(buddy, 'setup')

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

        if (resultFailed(result)) {
          log.error('Failed to set random application key.', result.error)
          process.exit(1)
        }
      }
    }

    // Use lazy loading for better cold start performance
    const commandsToLoad = getCommandsToLoad(args)
    await loadCommands(commandsToLoad, buddy)

    // Load user commands from app/Commands/
    await dynamicImports(buddy)
  }
  else {
    // For minimal commands, only load what's needed for better cold start
    const { loadCommand } = await import('./lazy-commands.ts')
    await loadCommand('version', buddy)
  }

  buddy.help()

  // Handle interactive mode when no command is specified
  if (args.length === 0 && process.stdin.isTTY && !(buddy).isNoInteraction) {
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
  //     applyTheme(buddy.theme)
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

/**
 * Attach aliases to a command the CLI already knows about.
 *
 * The implementation moved to `@stacksjs/cli` along with the rest of command
 * loading, so buddy, an application's own binary, and the dashboard all share
 * one loader. Re-exported here to keep the historical import path.
 */
export { applyAliases } from '@stacksjs/cli'

/**
 * Register the application's own commands.
 *
 * Every `.ts` file under `app/Commands/` is a command - no registration step,
 * no generated file. `app/Commands.ts` remains supported and purely additive:
 * it orders the listing, adds aliases, and can disable a command. A file it
 * does not mention still loads, which is what `buddy make:command` has always
 * promised.
 */
async function dynamicImports(buddy: CLI) {
  const { loadCommands } = await import('@stacksjs/cli')

  await loadCommands(buddy, {
    commandsDir: p.appPath('Commands'),
    registryPath: p.appPath('Commands.ts'),
    onError: (message, error) => log.error(`${message}:`, error),
    onDebug: message => log.debug(message),
  })

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
