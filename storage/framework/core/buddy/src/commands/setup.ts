import process from 'node:process'
import { path as p } from '@stacksjs/path'
import { Action } from '@stacksjs/enums'
import { handleError } from '@stacksjs/error-handling'
import { storage } from '@stacksjs/storage'
import { log, runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import type { CLI, CliOptions } from '@stacksjs/types'

export function setup(buddy: CLI) {
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
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      log.debug('Running `buddy setup` ...', options)

      if (!await isPkgxInstalled())
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
  return new Promise((resolve) => {
    // Mapping of config files to their respective packages
    // Now supports multiple files per package
    const configToPackageMap: Readonly<{ [packageName: string]: string[] }> = {
      redis: ['cache.ts', 'session.ts'], // Example: both cache.ts and session.ts need redis

      // sqlite: ['sample.ts'], // Example: sqlite will be removed when this is uncommented since sample.ts does not exist

      // You can add other mappings here
    }

    // Function to check if at least one file exists
    const atLeastOneFileExists = (fileNames: string[]) => fileNames.some(fileName => fs.existsSync(`./config/${fileName}`))

    log.info('[INFO] Checking config files...')

    // Check each package and install if any associated config file exists
    Object.entries(configToPackageMap).forEach(([packageName, configFiles]) => {
      if (atLeastOneFileExists(configFiles)) {
        log.info(`[INFO] Required '${packageName}' for '${configFiles.join(', ')}' config files...`)
      }
      else {
        log.info(`[INFO] No config files for '${packageName}' exist. Removing from dependencies in pkgx.yaml...`)

        const pkgxPath = './pkgx.yaml'
        const pkgxContent = fs.readFileSync(pkgxPath, 'utf8')
        const lines = pkgxContent.split('\n')
        const newLines = lines.filter(line => !line.includes(`${packageName}.`))
        fs.writeFileSync(pkgxPath, newLines.join('\n'))
        log.success(`[SUCCESS] Removed '${packageName}'...`)
      }
    })

    resolve()
  })
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
  else { log.success('.env existed') }
}
