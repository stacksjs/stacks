import process from 'node:process'
import { path as p } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'
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
        // await optimizeTeaDeps()
        await ensureDependenciesAreInstalled()
      else
        await installTea()

      await initializeProject(options)
    })

  buddy.on('setup:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

async function ensureTeaIsInstalled(): Promise<boolean> {
  const result = await runCommand('tea --version', { silent: true })

  if (result.isOk())
    return true

  return false
}

async function ensureDependenciesAreInstalled(): Promise<void> {
  const result = await runCommand('dev', {
    silent: true,
    cwd: p.projectPath(),
  })

  if (result.isOk())
    return

  console.error('Failed to install dependencies')
  process.exit(1)
}

async function installTea(): Promise<void> {
  const result = await runCommand('./scripts/setup.sh')

  if (result.isOk())
    return

  console.error('Failed to install tea')
  process.exit(1)
}

async function initializeProject(options: CliOptions): Promise<void> {
  const result = await runCommands([
    'bun install', // -> await runCommand('bun install')
    'cp env.example env', // -> cp.env.example to env
    'buddy key:generate', // -> set application key
    'buddy configure:aws', // -> ensure aws is configured
  ], {
    cwd: options.cwd || p.projectPath(),
  })

  if (result.isOk())
    return

  console.error('Failed to initialize project')
  process.exit(1)
}
