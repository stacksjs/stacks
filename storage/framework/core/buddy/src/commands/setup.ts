import type { CLI, CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { log, runCommand } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { handleError } from '@stacksjs/error-handling'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

export function setup(buddy: CLI): void {
  const descriptions = {
    setup: 'This command ensures your project is setup correctly',
    ohMyZsh: 'Enable Oh My Zsh',
    aws: 'Ensures AWS is connected to the project',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('setup', descriptions.setup)
    .alias('ensure')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      log.debug('Running `buddy setup` ...', options)

      if (!(await isPkgxInstalled()))
        await installPkgx()

      // ensure the minimal amount of deps are written to ./pkgx.yaml
      await optimizePkgxDeps()

      // TODO: optimizeConfigDir()
      // TODO: optimizeAddDir()

      await initializeProject(options)
    })

  buddy
    .command('setup:oh-my-zsh', descriptions.ohMyZsh) // if triggered multiple times, it will update the plugin
    .alias('upgrade:oh-my-zsh')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (_options?: CliOptions) => {
      log.debug('Running `buddy setup:oh-my-zsh` ...', _options)
      const result = await runAction(Action.UpgradeShell)

      if (result.isErr()) {
        log.error(result.error)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy.on('setup:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(ExitCode.FatalError)
  })
}

async function isPkgxInstalled(): Promise<boolean> {
  const result = await runCommand('pkgx --version', { silent: true })

  if (result.isOk())
    return true

  return false
}

async function installPkgx(): Promise<void> {
  const result = await runCommand(p.frameworkPath('scripts/pkgx-install'))

  if (result.isOk())
    return

  handleError(result.error)
  process.exit(ExitCode.FatalError)
}

async function initializeProject(options: CliOptions): Promise<void> {
  log.info('Installing dependencies...')

  const result = await runCommand('bun install', {
    cwd: options.cwd || p.projectPath(),
  })

  if (result.isErr()) {
    handleError(result.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Installed node_modules')

  ensureEnvIsSet(options)

  const keyResult = await runCommand('buddy key:generate', {
    cwd: options.cwd || p.projectPath(),
  })

  if (keyResult.isErr()) {
    handleError(keyResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.info('Ensuring AWS is connected...')

  const awsResult = await runCommand('buddy configure:aws', {
    cwd: options.cwd || p.projectPath(),
  })

  if (awsResult.isErr()) {
    handleError(awsResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Configured AWS')

  // TODO: ensure the IDE is setup by making sure .vscode etc exists, and if not, copy them over

  log.success('Project is setup')
  log.info('Happy coding! 💙')
}

export async function optimizePkgxDeps(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 300))
}

export async function ensureEnvIsSet(options: CliOptions): Promise<void> {
  log.info('Ensuring .env exists...')

  if (storage.doesNotExist(p.projectPath('.env'))) {
    const envResult = await runCommand('cp .env.example .env', {
      cwd: options.cwd || p.projectPath(),
    })

    if (envResult.isErr()) {
      handleError(envResult.error)
      process.exit(ExitCode.FatalError)
    }

    log.success('.env created')
  }
  else {
    log.success('.env existed')
  }
}
