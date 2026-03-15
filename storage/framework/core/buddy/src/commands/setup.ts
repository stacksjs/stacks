import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CLI, CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction, setupSSL } from '@stacksjs/actions'
import { log, runCommand } from '@stacksjs/cli'
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

  buddy.on('setup:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(ExitCode.FatalError)
  })
}

async function isPantryInstalled(): Promise<boolean> {
  const result = await runCommand('pantry --version', {
    silent: true,
    timeoutMs: PANTRY_CHECK_TIMEOUT_MS,
  })

  if (result.isOk)
    return true

  return false
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
  if (!(await isPantryInstalled()))
    await installPantry()
}

export async function ensurePantryDependencies(cwd: string): Promise<void> {
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

function hasAppKey(cwd: string): boolean {
  const envPath = join(cwd, '.env')

  if (!existsSync(envPath))
    return false

  return /^APP_KEY=.+$/m.test(readFileSync(envPath, 'utf-8'))
}

export async function ensureAppKey(cwd: string): Promise<void> {
  if (hasAppKey(cwd)) {
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

async function initializeProject(options: SetupOptions): Promise<void> {
  const cwd = options.cwd || p.projectPath()

  await ensurePantryDependencies(cwd)

  await ensureEnvIsSet(options)

  if (!options.skipKeygen) {
    await ensureAppKey(cwd)
  }

  if (!options.skipAws) {
    log.info('Ensuring AWS is connected...')

    const awsResult = await runCommand('./buddy configure:aws', {
      cwd,
      timeoutMs: AWS_CONFIG_TIMEOUT_MS,
    })

    if (awsResult.isErr) {
      handleError(awsResult.error)
      process.exit(ExitCode.FatalError)
    }

    log.success('Configured AWS')
  }

  // TODO: ensure the IDE is setup by making sure .vscode etc exists, and if not, copy them over

  log.success('Project is setup')
  log.info('Happy coding! 💙')
}

/**
 * Maps DB_CONNECTION values to pantry package domains
 */
const DB_CONNECTION_PACKAGES: Record<string, string> = {
  postgres: 'postgresql.org',
  mysql: 'mysql.com',
  sqlite: 'sqlite.org',
}

/**
 * Reads DB_CONNECTION from .env or .env.example and returns the corresponding
 * pantry package domain, if any.
 */
function detectDbPackage(cwd: string): string | undefined {
  const envPath = join(cwd, '.env')
  const envExamplePath = join(cwd, '.env.example')

  const filePath = existsSync(envPath) ? envPath : existsSync(envExamplePath) ? envExamplePath : undefined

  if (!filePath)
    return undefined

  const content = readFileSync(filePath, 'utf-8')
  const match = content.match(/^DB_CONNECTION=(.+)$/m)

  if (!match)
    return undefined

  const value = match[1].trim().replace(/['"]/g, '')

  return DB_CONNECTION_PACKAGES[value]
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
    const alreadyHasDb = Object.keys(configDeps).some(key => key === dbPackage || key.startsWith(`${dbPackage}/`))

    if (!alreadyHasDb) {
      log.info(`Detected DB_CONNECTION requires ${dbPackage}, adding to dependencies`)
      configDeps[dbPackage] = '*'
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
