import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CLI, CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction, setupSSL } from '@stacksjs/actions'
import { log, onUnknownSubcommand, runCommand } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { handleError } from '@stacksjs/error-handling'
import { path as p } from '@stacksjs/path'
import { copyFile, storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

interface SetupOptions extends CliOptions {
  skipAws?: boolean
  skipKeygen?: boolean
}

function getTimeoutMs(envVar: string, fallbackMs: number): number {
  const value = Number(process.env[envVar])

  if (Number.isFinite(value) && value > 0)
    return value

  return fallbackMs
}

const PANTRY_CHECK_TIMEOUT_MS = getTimeoutMs('PANTRY_CHECK_TIMEOUT_MS', 15_000)
const PANTRY_INSTALL_TIMEOUT_MS = getTimeoutMs('PANTRY_INSTALL_TIMEOUT_MS', 10 * 60_000)
const PANTRY_DEPENDENCIES_TIMEOUT_MS = getTimeoutMs('PANTRY_DEPENDENCIES_TIMEOUT_MS', 20 * 60_000)
const BUN_INSTALL_TIMEOUT_MS = getTimeoutMs('BUN_INSTALL_TIMEOUT_MS', 10 * 60_000)
const KEYGEN_TIMEOUT_MS = getTimeoutMs('KEYGEN_TIMEOUT_MS', 2 * 60_000)
const AWS_CONFIG_TIMEOUT_MS = getTimeoutMs('AWS_CONFIG_TIMEOUT_MS', 15 * 60_000)

export function setup(buddy: CLI): void {
  const descriptions = {
    setup: 'This command ensures your project is setup correctly',
    ssl: 'Setup SSL certificates and hosts file for HTTPS development',
    ohMyZsh: 'Enable Oh My Zsh',
    aws: 'Ensures AWS is connected to the project',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
    domain: 'Custom domain to setup (defaults to APP_URL)',
    skipHosts: 'Skip adding domain to hosts file',
    skipTrust: 'Skip trusting the certificate',
    skipAws: 'Skip AWS configuration during setup',
    skipKeygen: 'Skip generating an application key during setup',
  }

  buddy
    .command('setup', descriptions.setup)
    .alias('ensure')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--skip-aws', descriptions.skipAws, { default: false })
    .option('--skip-keygen', descriptions.skipKeygen, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: SetupOptions) => {
      log.debug('Running `buddy setup` ...', options)

      await ensurePantryInstalled()

      // ensure the minimal amount of deps are written to ./pantry.yaml
      await optimizePantryDeps()

      // TODO: optimizeConfigDir()
      // TODO: optimizeAddDir()

      await initializeProject(options)
    })

  buddy
    .command('setup:ssl', descriptions.ssl)
    .alias('ssl:setup')
    .option('-d, --domain [domain]', descriptions.domain)
    .option('--skip-hosts', descriptions.skipHosts, { default: false })
    .option('--skip-trust', descriptions.skipTrust, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions & { domain?: string, skipHosts?: boolean, skipTrust?: boolean }) => {
      log.debug('Running `buddy setup:ssl` ...', options)

      const success = await setupSSL({
        domain: options.domain,
        skipHosts: options.skipHosts,
        skipTrust: options.skipTrust,
        verbose: options.verbose,
      })

      if (!success) {
        log.warn('SSL setup completed with warnings')
        log.info('You may need to manually trust certificates or update hosts file')
      }
    })

  buddy
    .command('setup:oh-my-zsh', descriptions.ohMyZsh) // if triggered multiple times, it will update the plugin
    .alias('upgrade:oh-my-zsh')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (_options?: CliOptions) => {
      log.debug('Running `buddy setup:oh-my-zsh` ...', _options)
      const result = await runAction(Action.UpgradeShell)

      if (result.isErr) {
        log.error(result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  onUnknownSubcommand(buddy, "setup")
}

async function isPantryInstalled(): Promise<boolean> {
  try {
    const result = await runCommand('pantry --version', {
      silent: true,
      timeoutMs: PANTRY_CHECK_TIMEOUT_MS,
    })

    return result.isOk
  }
  catch {
    // runCommand/spawn throws (not a soft error result) when the `pantry`
    // executable isn't on PATH — e.g. a node_modules app on a CI runner that
    // never installed pantry. Treat that as "not installed" rather than letting
    // the throw bubble up as an unhandled rejection that silently exits the CLI.
    return false
  }
}

async function installPantry(): Promise<void> {
  const result = await runCommand(p.frameworkPath('scripts/pantry-install'), {
    timeoutMs: PANTRY_INSTALL_TIMEOUT_MS,
  })

  if (result.isOk)
    return

  handleError((result as any).error)
  process.exit(ExitCode.FatalError)
}

export async function ensurePantryInstalled(): Promise<void> {
  if (await isPantryInstalled())
    return

  // A node_modules-based app has no vendored `scripts/pantry-install`
  // (storage/framework isn't checked out). Pantry isn't required to run the
  // buddy CLI or to deploy — the CLI's deps come from node_modules, and the
  // target box provisions its own system deps over SSH — so skip rather than
  // fatally exit when there's nothing to bootstrap with.
  const installer = p.frameworkPath('scripts/pantry-install')
  if (!existsSync(installer)) {
    log.debug('Pantry is not installed and no bundled installer is present; continuing without it.')
    return
  }

  await installPantry()
}

export async function ensurePantryDependencies(cwd: string): Promise<void> {
  // Only meaningful when pantry is actually installed (vendored/dev layout). A
  // node_modules app resolves its dependencies through `bun install`, so there
  // are no pantry deps to install — skip silently rather than shelling out to a
  // missing `pantry` executable (which throws and silently kills the deploy).
  if (!(await isPantryInstalled())) {
    log.debug('Pantry not installed; skipping pantry dependency install (deps come from node_modules).')
    return
  }

  log.info('Installing Pantry dependencies...')

  const result = await runCommand('pantry install', {
    cwd,
    timeoutMs: PANTRY_DEPENDENCIES_TIMEOUT_MS,
  })

  if (result.isOk) {
    log.success('Installed Pantry dependencies')
    return
  }

  handleError((result as any).error)
  process.exit(ExitCode.FatalError)
}

export async function ensureNodeDependencies(cwd: string): Promise<void> {
  // A fresh repo-zip extraction has no node_modules at all. Every later
  // setup step (key generation, migration, AWS configuration) shells out
  // through code that resolves via node_modules, so unlike the rest of
  // setup a failed install here is fatal: nothing after it can work.
  if (existsSync(join(cwd, 'node_modules'))) {
    log.success('node_modules existed, skipping bun install')
    return
  }

  log.info('Running bun install...')

  const result = await runCommand('bun install', {
    cwd,
    timeoutMs: BUN_INSTALL_TIMEOUT_MS,
  }).catch((error: unknown) => {
    // runCommand/spawn throws (rather than resolving an Err result) when the
    // executable itself cannot be launched, e.g. no bun on PATH yet.
    handleError(error)
    process.exit(ExitCode.FatalError)
  })

  if (result.isErr) {
    handleError(result.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Installed node dependencies')
}

function hasAppKey(cwd: string): boolean {
  const envPath = join(cwd, '.env')

  if (!existsSync(envPath))
    return false

  return /^APP_KEY=.+$/m.test(readFileSync(envPath, 'utf-8'))
}

export async function ensureAppKey(cwd: string): Promise<void> {
  // A node_modules app keeps APP_KEY in its encrypted `.env.<env>`, which the
  // preloader decrypts into process.env at boot — there may be no plaintext
  // `.env` file with an APP_KEY line. Honor the already-set env value so we
  // don't needlessly (and, via the ./buddy wrapper, unreliably) regenerate it.
  if (hasAppKey(cwd) || (process.env.APP_KEY && process.env.APP_KEY.length > 0)) {
    log.success('APP_KEY existed')
    return
  }

  const keyResult = await runCommand('./buddy key:generate', {
    cwd,
    timeoutMs: KEYGEN_TIMEOUT_MS,
  })

  if (keyResult.isErr) {
    handleError(keyResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Generated application key')
}

async function runInitialMigration(cwd: string): Promise<void> {
  // Setup also runs on deploy/CI targets, where onboarding must not touch
  // the database. Only a local/dev context gets the automatic first pass.
  const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || 'local').toLowerCase()

  if (!['local', 'development', 'dev', 'test'].includes(appEnv)) {
    log.info(`Skipping initial migration in the ${appEnv} environment`)
    return
  }

  log.info('Running initial database migration...')

  try {
    // The migrate action is non-interactive (the confirmation guards live in
    // the `buddy migrate` command, not the action), so this is safe to run
    // unattended. Best-effort either way: a fresh project may have no models
    // or no reachable database yet, and neither should fail onboarding.
    const result = await runAction(Action.Migrate, { cwd })

    if (result.isErr) {
      log.warn('Initial migration did not complete - you can run it later via ./buddy migrate')
      log.debug(result.error)
      return
    }

    log.success('Database is migrated')
  }
  catch (error) {
    log.warn('Initial migration did not complete - you can run it later via ./buddy migrate')
    log.debug(error)
  }
}

async function initializeProject(options: SetupOptions): Promise<void> {
  const cwd = options.cwd || p.projectPath()

  await ensurePantryDependencies(cwd)

  // Node dependencies come right after the pantry toolchain: pantry
  // provisions bun itself, and every later step resolves via node_modules.
  await ensureNodeDependencies(cwd)

  await ensureEnvIsSet(options)

  if (!options.skipKeygen) {
    await ensureAppKey(cwd)
  }

  await runInitialMigration(cwd)

  if (!options.skipAws) {
    log.info('Ensuring AWS is connected...')

    try {
      const awsResult = await runCommand('./buddy configure:aws', {
        cwd,
        timeoutMs: AWS_CONFIG_TIMEOUT_MS,
      })

      if (awsResult.isErr) {
        // AWS is only needed for deploys, so a missing/canceled configuration
        // downgrades to a warning instead of aborting the whole setup.
        log.warn('AWS not configured - you can do this later via ./buddy configure:aws')
        log.debug(awsResult.error)
      }
      else {
        log.success('Configured AWS')
      }
    }
    catch (error) {
      log.warn('AWS not configured - you can do this later via ./buddy configure:aws')
      log.debug(error)
    }
  }

  // TODO: ensure the IDE is setup by making sure .vscode etc exists, and if not, copy them over

  log.success('Project is setup')
  log.info('Run `./buddy doctor` anytime to check your setup. Happy coding! 💙')
}

/**
 * Maps DB_CONNECTION values to pantry package domains
 */
interface DatabasePackage {
  name: string
  version: string
}

const DB_CONNECTION_PACKAGES: Record<string, DatabasePackage> = {
  // PostgreSQL data directories are not cross-major compatible. Keeping an
  // unconstrained `*` here let Pantry upgrade a live v17 cluster to v18 and
  // made the service unbootable. Pin the supported major while allowing
  // security and patch releases within it.
  postgres: { name: 'postgresql.org', version: '^17.10' },
  mysql: { name: 'mysql.com', version: '*' },
  sqlite: { name: 'sqlite.org', version: '^3.47.2' },
}

export function pantryDatabasePackage(connection: string): DatabasePackage | undefined {
  return DB_CONNECTION_PACKAGES[connection]
}

/**
 * Reads DB_CONNECTION from .env or .env.example and returns the corresponding
 * pantry package domain, if any.
 */
function detectDbPackage(cwd: string): DatabasePackage | undefined {
  const envPath = join(cwd, '.env')
  const envExamplePath = join(cwd, '.env.example')

  const filePath = existsSync(envPath) ? envPath : existsSync(envExamplePath) ? envExamplePath : undefined

  if (!filePath)
    return undefined

  const content = readFileSync(filePath, 'utf-8')
  const match = content.match(/^DB_CONNECTION=(.+)$/m)

  if (!match)
    return undefined

  const value = match[1]!.trim().replace(/['"]/g, '')

  return pantryDatabasePackage(value)
}

/**
 * Reads config/deps.ts dependencies and merges in environment-detected
 * dependencies (e.g. DB_CONNECTION), then writes deps.yaml so pantry install
 * picks up the correct packages.
 */
export async function optimizePantryDeps(): Promise<void> {
  const cwd = p.projectPath()
  const depsConfigPath = join(cwd, 'config', 'deps.ts')

  if (!existsSync(depsConfigPath)) {
    log.debug('No config/deps.ts found, skipping dependency optimization')
    return
  }

  let configDeps: Record<string, string> = {}

  try {
    const mod = await import(depsConfigPath)
    const config = mod.config || mod.default

    if (config?.dependencies) {
      configDeps = { ...config.dependencies }
    }
  }
  catch (err) {
    log.debug('Could not load config/deps.ts, skipping dependency optimization')
    return
  }

  const dbPackage = detectDbPackage(cwd)

  if (dbPackage) {
    const alreadyHasDb = Object.keys(configDeps).some(key => key === dbPackage.name || key.startsWith(`${dbPackage.name}/`))

    if (!alreadyHasDb) {
      log.info(`Detected DB_CONNECTION requires ${dbPackage.name}, adding to dependencies`)
      configDeps[dbPackage.name] = dbPackage.version
    }
  }

  const lines = [
    '# Auto-generated from config/deps.ts and .env sniffing.',
    '# This file is regenerated on each `buddy setup` run.',
    '#',
    '# To learn more, please visit:',
    '# https://stacksjs.com/docs/dependency-management',
    '',
    'dependencies:',
  ]

  for (const [pkg, version] of Object.entries(configDeps)) {
    lines.push(`  ${pkg}: ${version}`)
  }

  const depsYamlPath = join(cwd, 'deps.yaml')
  writeFileSync(depsYamlPath, `${lines.join('\n')}\n`)

  log.success('Generated deps.yaml from config/deps.ts')
}

export async function ensureEnvIsSet(options: CliOptions): Promise<void> {
  log.info('Ensuring .env exists...')

  const cwd = options.cwd || p.projectPath()
  const envPath = `${cwd}/.env`
  const envExamplePath = `${cwd}/.env.example`

  if (storage.doesNotExist(envPath)) {
    try {
      copyFile(envExamplePath, envPath)
    }
    catch (error) {
      handleError(error)
      process.exit(ExitCode.FatalError)
    }

    log.success('.env created')
  }
  else {
    log.success('.env existed')
  }
}
