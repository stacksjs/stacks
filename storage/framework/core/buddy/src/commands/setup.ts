import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CLI, CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { log, onUnknownSubcommand, runCommand } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { handleError } from '@stacksjs/error-handling'
import { path as p } from '@stacksjs/path'
import { copyFile, storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'
import { setupPrettyDevEnvironment } from './dev'
import { resultFailed } from '../result'

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
const KEYGEN_TIMEOUT_MS = getTimeoutMs('KEYGEN_TIMEOUT_MS', 2 * 60_000)
const AWS_CONFIG_TIMEOUT_MS = getTimeoutMs('AWS_CONFIG_TIMEOUT_MS', 15 * 60_000)

export function setup(buddy: CLI): void {
  const descriptions = {
    setup: 'This command ensures your project is setup correctly',
    ssl: 'Setup SSL certificates and hosts file for HTTPS development',
    ai: 'Set the project up for an AI coding agent (Claude Code, Codex, Cursor, Copilot, Gemini)',
    copy: 'Copy the agent files instead of symlinking them, so they can be edited per project',
    force: 'Overwrite files that already exist',
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

      const success = await setupPrettyDevEnvironment({
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
    .command('setup:ai [provider]', descriptions.ai)
    .alias('ai:setup')
    .option('--copy', descriptions.copy, { default: false })
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (provider: string | undefined, options: CliOptions & { copy?: boolean, force?: boolean }) => {
      log.debug('Running `buddy setup:ai` ...', options)

      const { AI_PROVIDERS, isAiProvider, reportAiSetup, setupAiProvider } = await import('./setup-ai')

      let id = provider

      if (!id) {
        const { select } = await import('@stacksjs/cli')
        id = await select({
          message: 'Which AI coding agent do you use?',
          choices: AI_PROVIDERS.map(entry => ({ value: entry.id, label: entry.label })),
          initial: 0,
        }) as string
      }

      if (!id || !isAiProvider(id)) {
        log.error(`Unknown AI provider: ${id}. Expected one of: ${AI_PROVIDERS.map(entry => entry.id).join(', ')}`)
        process.exit(ExitCode.InvalidArgument)
      }

      const definition = AI_PROVIDERS.find(entry => entry.id === id)!
      reportAiSetup(definition, setupAiProvider(id, { copy: options.copy, force: options.force }))
    })

  buddy
    .command('setup:oh-my-zsh', descriptions.ohMyZsh) // if triggered multiple times, it will update the plugin
    .alias('upgrade:oh-my-zsh')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (_options?: CliOptions) => {
      log.debug('Running `buddy setup:oh-my-zsh` ...', _options)
      const result = await runAction(Action.UpgradeShell)

      if (resultFailed(result)) {
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
  const bundledInstaller = p.frameworkPath('scripts/pantry-install')
  const command = existsSync(bundledInstaller)
    ? [bundledInstaller]
    : ['sh', '-c', 'curl -fsSL https://pantry.dev | bash']
  const result = await runCommand(command, {
    timeoutMs: PANTRY_INSTALL_TIMEOUT_MS,
  })

  const localBin = join(homedir(), '.local', 'bin')
  if (!process.env.PATH?.split(':').includes(localBin))
    process.env.PATH = `${localBin}:${process.env.PATH || ''}`

  if (result.isOk && await isPantryInstalled())
    return

  if (resultFailed(result))
    handleError(result.error)
  else
    log.error('Pantry installed but is not available on PATH. Open a new shell and run `buddy setup` again.')
  process.exit(ExitCode.FatalError)
}

export async function ensurePantryInstalled(): Promise<void> {
  if (await isPantryInstalled())
    return

  log.info('Pantry is required. Installing it from https://pantry.dev...')
  await installPantry()
}

export async function ensurePantryDependencies(cwd: string): Promise<void> {
  await ensurePantryInstalled()

  log.info('Installing project dependencies with Pantry...')

  const result = await runCommand('pantry install', {
    cwd,
    timeoutMs: PANTRY_DEPENDENCIES_TIMEOUT_MS,
  })

  if (resultFailed(result)) {
    handleError(result.error)
    process.exit(ExitCode.FatalError)
  }

  if (existsSync(join(cwd, 'package.json')) && !existsSync(join(cwd, 'node_modules'))) {
    log.error('Pantry completed without installing the project JavaScript dependencies.')
    process.exit(ExitCode.FatalError)
  }

  log.success('Installed project dependencies with Pantry')
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

  if (resultFailed(keyResult)) {
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

    if (resultFailed(result)) {
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

  await ensureEnvIsSet(options)

  if (!options.skipKeygen) {
    await ensureAppKey(cwd)
  }

  await runInitialMigration(cwd)

  ensureIdeSettings(cwd)

  if (!options.skipAws) {
    log.info('Ensuring AWS is connected...')

    try {
      const awsResult = await runCommand('./buddy configure:aws', {
        cwd,
        timeoutMs: AWS_CONFIG_TIMEOUT_MS,
      })

      if (resultFailed(awsResult)) {
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

  log.success('Project is setup')
  log.info('Run `./buddy doctor` anytime to check your setup. Happy coding! 💙')
}

export function ensureIdeSettings(cwd: string): void {
  const source = p.frameworkPath('defaults/ide/vscode/.vscode')
  const destination = join(cwd, '.vscode')

  if (existsSync(destination)) {
    log.debug('.vscode already exists; keeping the project settings')
    return
  }

  if (!existsSync(source)) {
    log.debug('No bundled VS Code settings found; skipping IDE setup')
    return
  }

  cpSync(source, destination, { recursive: true })
  log.success('Installed project VS Code settings')
}

/**
 * Maps DB_CONNECTION values to pantry package domains
 */
interface DatabasePackage {
  name: string
  version: string
  /**
   * The pantry service that has to be running before the database can be
   * reached. SQLite is a file, so it has none.
   */
  service?: string
}

const DB_CONNECTION_PACKAGES: Record<string, DatabasePackage> = {
  // PostgreSQL data directories are not cross-major compatible. Keeping an
  // unconstrained `*` here let Pantry upgrade a live v17 cluster to v18 and
  // made the service unbootable. Pin the supported major while allowing
  // security and patch releases within it.
  postgres: { name: 'postgresql.org', version: '^17.10', service: 'postgres' },
  // Pinned to a major for the same reason Postgres is: MySQL's data directory
  // is upgraded in place and never downgraded, so an unconstrained `*` lets
  // pantry move a live cluster to the next major on an ordinary install and
  // leaves no way back. 9.x is what this framework's MySQL support was built
  // and tested against.
  mysql: { name: 'mysql.com', version: '^9.2', service: 'mysql' },
  sqlite: { name: 'sqlite.org', version: '^3.47.2' },
}

/**
 * Every spelling a database engine can appear under in a dependency map: the
 * pantry domain (`postgresql.org`) and the alias (`postgres`) both resolve to
 * the same package, and the shipped config uses the alias.
 */
function databaseAliases(connection: string, pkg: DatabasePackage): string[] {
  return [connection, pkg.name]
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
  let configServices: string[] = []
  let configDefined: Record<string, Record<string, unknown>> = {}

  try {
    const mod = await import(depsConfigPath)
    const config = mod.config || mod.default

    if (config?.dependencies) {
      configDeps = { ...config.dependencies }
    }

    // `autoStart` is a boolean in the shipped config (meaning "start whatever
    // this project needs"); only an explicit list names additional services.
    if (Array.isArray(config?.services?.autoStart)) {
      configServices = config.services.autoStart.filter((name: unknown): name is string => typeof name === 'string')
    }

    // Services the project defines for itself - its own server, its queue
    // worker - which pantry manages as launchd or systemd agents exactly as it
    // manages Postgres. Without this, every project's own processes are the
    // one part of its environment pantry knows nothing about, and each one
    // ends up with a hand-written unit or a terminal somebody has to remember.
    if (config?.services?.define && typeof config.services.define === 'object')
      configDefined = config.services.define as Record<string, Record<string, unknown>>
  }
  catch (err) {
    log.debug('Could not load config/deps.ts, skipping dependency optimization')
    return
  }

  const dbPackage = detectDbPackage(cwd)
  const autoStart = [...configServices]

  if (dbPackage) {
    // A project talks to exactly one database. Shipping the others anyway made
    // every app install a SQLite it never opens, and left the impression that
    // whichever engine appeared first was the one in use.
    const selected = new Set(Object.entries(DB_CONNECTION_PACKAGES)
      .filter(([, pkg]) => pkg.name === dbPackage.name)
      .flatMap(([connection, pkg]) => databaseAliases(connection, pkg)))

    const unused = new Set(Object.entries(DB_CONNECTION_PACKAGES)
      .flatMap(([connection, pkg]) => databaseAliases(connection, pkg))
      .filter(alias => !selected.has(alias)))

    for (const pkg of Object.keys(configDeps)) {
      const domain = pkg.split('/')[0]!

      if (unused.has(domain)) {
        log.info(`DB_CONNECTION selects ${dbPackage.name}, dropping unused ${pkg}`)
        delete configDeps[pkg]
      }
    }

    const alreadyHasDb = Object.keys(configDeps).some((key) => {
      const domain = key.split('/')[0]!
      return selected.has(domain)
    })

    if (!alreadyHasDb) {
      log.info(`Detected DB_CONNECTION requires ${dbPackage.name}, adding to dependencies`)
      configDeps[dbPackage.name] = dbPackage.version
    }

    // Without this, pantry installs the server but never boots it, so its own
    // post-install database creation fails with a connection refused and the
    // first migration lands on a database that does not exist yet.
    if (dbPackage.service && !autoStart.includes(dbPackage.service))
      autoStart.push(dbPackage.service)
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

  const defined = Object.entries(configDefined)

  if (autoStart.length > 0 || defined.length > 0) {
    lines.push('', 'services:', '  enabled: true')

    if (autoStart.length > 0) {
      lines.push('  autoStart:')

      for (const service of autoStart)
        lines.push(`    - ${service}`)
    }

    /*
     * The project's own services, in the shape pantry reads them.
     *
     * `command` is the only required key; `port`, `health` and `cwd` are
     * optional, and anything else is passed through so a pantry that learns a
     * new key does not need this generator changed to use it. Values are
     * emitted unquoted because a command line is the common case and quoting
     * it would put the quotes in the argv.
     */
    if (defined.length > 0) {
      lines.push('  define:')

      for (const [name, definition] of defined) {
        if (!definition || typeof definition !== 'object')
          continue

        lines.push(`    ${name}:`)

        for (const [key, value] of Object.entries(definition)) {
          if (value === undefined || value === null)
            continue

          lines.push(`      ${key}: ${String(value)}`)
        }
      }
    }
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

/**
 * The env file's actual settings: `KEY=value` pairs, minus blanks, comments,
 * and the public-key header (which is metadata, and is never encrypted).
 */
function envValues(contents: string): string[] {
  return contents
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('DOTENV_PUBLIC_KEY'))
    .map(line => line.slice(line.indexOf('=') + 1).trim())
    .map(value => value.replace(/^['"]/, ''))
}

/** A value that is already ciphertext, so encrypting again would be a no-op. */
function isCiphertext(value: string): boolean {
  return value.startsWith('encrypted:') || value.startsWith('enc:')
}

/**
 * Is every value in this env file already ciphertext?
 *
 * A file with nothing in it counts: there is no secret in it to protect.
 */
export function isEnvFileEncrypted(contents: string): boolean {
  return envValues(contents).every(isCiphertext)
}

/**
 * The header a freshly created `.env.<environment>` starts with.
 *
 * Deliberately no values. A first deploy that copied `.env` into
 * `.env.production` would ship the developer's laptop — a localhost APP_URL, a
 * dev database, a test Stripe key — to a real server under a name that says
 * production, and the encryption would then hide the mistake from review.
 */
function deployEnvTemplate(environment: string): string {
  return [
    `# Secrets for the ${environment} environment.`,
    '#',
    '# Values here are encrypted with the public key below and decrypted at',
    '# deploy time with the matching private key in .env.keys, which is NOT',
    "# committed. This file is — that is the point: the ciphertext is reviewable",
    '# and diffable, and losing a laptop does not leak production.',
    '#',
    '# Add one with:',
    `#   buddy env:set STRIPE_SECRET_KEY sk_live_… --env ${environment}`,
    '#',
    '# Left empty on purpose. Nothing was copied out of your .env: that file',
    '# describes a laptop, and a server is not one.',
    '',
  ].join('\n')
}

/**
 * Guarantee the deploy has an encrypted env file for the environment it is
 * shipping to.
 *
 * A stacks app keeps production secrets in `.env.<environment>`, encrypted, and
 * the deploy decrypts them locally before shipping — systemd's `EnvironmentFile`
 * is a plain `KEY=value` parser that could never do it, so this is the only path
 * a secret can take to a server without lying around in plaintext on the way.
 *
 * Nothing enforced that. `resolveDeployEnvValues` returns `{}` for a missing
 * file, so an app with no `.env.production` deployed perfectly happily and kept
 * every secret it had in the plaintext `.env` beside its source — which is the
 * state a project drifts into by simply never being told otherwise, and which
 * nothing surfaces later because everything works.
 *
 * Three states, all of them ending with the file in place:
 *
 *   - **Missing** — created, with a header and no values, then encrypted so the
 *     keypair exists. Empty is not a stopgap: it is the honest starting point,
 *     and it changes nothing about what the deploy ships today.
 *   - **Plaintext** — encrypted in place. A value that reached this file was
 *     meant to be a secret, and leaving it readable is the failure this whole
 *     mechanism exists to prevent. Already-encrypted values are untouched, so
 *     this is safe to run on every deploy.
 *   - **Encrypted** — left alone.
 *
 * `development` is skipped: that environment reads plain `.env` by convention,
 * and encrypting a developer's working file would cost them their editor.
 */
export async function ensureDeployEnvIsSet(cwd: string, environment: string): Promise<void> {
  if (['development', 'dev', 'local', 'test'].includes(environment))
    return

  const fileName = `.env.${environment}`
  const filePath = join(cwd, fileName)
  const created = !existsSync(filePath)

  if (created)
    writeFileSync(filePath, deployEnvTemplate(environment))

  const contents = readFileSync(filePath, 'utf-8')

  if (!created && isEnvFileEncrypted(contents)) {
    log.success(`${fileName} existed`)
    return
  }

  const { encryptEnv } = await import('@stacksjs/env')
  const result = encryptEnv({ file: fileName, cwd })

  if (!result.success) {
    // Fatal on purpose. Continuing would deploy with secrets this project has
    // said belong in an encrypted file, from wherever they happen to sit
    // instead — and the point of asking was to stop doing that.
    log.error(`Could not encrypt ${fileName}: ${result.error ?? 'unknown error'}`)
    process.exit(ExitCode.FatalError)
  }

  if (created) {
    log.success(`${fileName} created (empty, encrypted — add secrets with \`buddy env:set KEY value --env ${environment}\`)`)
    return
  }

  const encrypted = envValues(contents).filter(value => !isCiphertext(value)).length
  log.success(`${fileName} encrypted (${encrypted} value${encrypted === 1 ? '' : 's'})`)
}
