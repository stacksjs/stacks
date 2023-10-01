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
    verbose: 'Enable verbose output',
  }

  buddy
    .command('ensure', descriptions.ensure)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('bun install', options)
    })

  buddy
    .command('setup', descriptions.setup)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      if (await ensureTeaIsInstalled())
        await optimizeTeaDeps()
      else
        await installTea()

      await initializeProject(options)
    })

  buddy.on('setup:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(ExitCode.FatalError)
  })
}

async function ensureTeaIsInstalled(): Promise<boolean> {
  const result = await runCommand('tea --version', { silent: true })

  if (result.isOk())
    return true

  return false
}

async function installTea(): Promise<void> {
  const result = await runCommand('./scripts/setup.sh')

  if (result.isOk())
    return

  handleError(result.error)
  process.exit(ExitCode.FatalError)
}

async function initializeProject(options: CliOptions): Promise<void> {
  log.info('')
  log.info('⏳ Installing npm dependencies...')
  log.info('')
  await new Promise(resolve => setTimeout(resolve, 1500))

  const result = await runCommand('bun install', {
    cwd: options.cwd || p.projectPath(),
  })

  if (result.isErr()) {
    handleError(result.error)
    process.exit(ExitCode.FatalError)
  }

  log.info('')
  log.info('✅ Installed npm dependencies')
  log.info('')
  await new Promise(resolve => setTimeout(resolve, 300))

  log.info('')
  log.info('⏳ Ensuring .env exists...')
  log.info('')
  await new Promise(resolve => setTimeout(resolve, 800))

  const envResult = await runCommand('cp .env.example .env', {
    cwd: options.cwd || p.projectPath(),
  })

  if (envResult.isErr()) {
    handleError(envResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.info('')
  log.info('✅ .env exists')
  log.info('')

  log.info('')
  log.info('⏳ Generating application key...')
  log.info('')
  await new Promise(resolve => setTimeout(resolve, 1200))

  const keyResult = await runCommand('buddy key:generate', {
    cwd: options.cwd || p.projectPath(),
  })

  if (keyResult.isErr()) {
    handleError(keyResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.info('')
  log.info('✅ Generated application key')
  log.info('')
  await new Promise(resolve => setTimeout(resolve, 300))

  log.info('')
  log.info('⏳ Ensuring AWS is connected...')
  log.info('')
  await new Promise(resolve => setTimeout(resolve, 1200))

  const awsResult = await runCommand('buddy configure:aws', {
    cwd: options.cwd || p.projectPath(),
  })

  if (awsResult.isErr()) {
    handleError(awsResult.error)
    process.exit(ExitCode.FatalError)
  }

  log.info('')
  log.info('✅ Configured AWS')
  log.info('')
  await new Promise(resolve => setTimeout(resolve, 300))

  log.info('')
  log.info('✅ Project is setup')
  log.info('')
  await new Promise(resolve => setTimeout(resolve, 300))

  log.info('')
  log.info('🎉 Happy coding!')
  log.info('')
}

export async function optimizeTeaDeps(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 300))
}
