import process from 'node:process'
import { path as p } from '@stacksjs/path'
import { handleError } from '@stacksjs/error-handling'
import { log, runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import type { CLI, CliOptions } from '@stacksjs/types'

export function setup(buddy: CLI) {
  const descriptions = {
    ensure: 'This command ensures your project is setup correctly',
    setup: 'This command sets up your project for the first time',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('setup', descriptions.setup)
    .alias('ensure')
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      if (await ensurePkgxIsInstalled())
        await optimizePkgxDeps()
      else
        await installPkgx()

      await initializeProject(options)
    })

  buddy.on('setup:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(ExitCode.FatalError)
  })
}

async function ensurePkgxIsInstalled(): Promise<boolean> {
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
  await new Promise(resolve => setTimeout(resolve, 1500))

  const result = await runCommand('bun install', {
    cwd: options.cwd || p.projectPath(),
  })

  if (result.isErr()) {
    handleError(result.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Installed node_modules')
  log.info('Ensuring .env exists...')

  const envResult = await runCommand('cp .env.example .env', {
    cwd: options.cwd || p.projectPath(),
  })

  if (envResult.isErr()) {
    handleError(envResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('.env exists')
  log.info('Generating application key...')

  const keyResult = await runCommand('buddy key:generate', {
    cwd: options.cwd || p.projectPath(),
  })

  if (keyResult.isErr()) {
    handleError(keyResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.success('Generated application key')
  log.info('Ensuring AWS is connected...')

  // const awsResult = await runCommand('buddy configure:aws', {
  //   cwd: options.cwd || p.projectPath(),
  // })

  // if (awsResult.isErr()) {
  //   handleError(awsResult.error)
  //   process.exit(ExitCode.FatalError)
  // }

  // log.success('Configured AWS')

  // 1. ensure the IDE is setup by making sure .vscode etc exists, and if not, copy them over
  // 2. ensure the project

  log.success('Project is setup')
  log.info('Happy coding! 💙')
}

export async function optimizePkgxDeps(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 300))
}
