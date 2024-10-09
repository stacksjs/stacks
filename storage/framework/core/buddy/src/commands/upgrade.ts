import type { CLI, UpgradeOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro, prompts } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'

export function upgrade(buddy: CLI): void {
  const descriptions = {
    command: 'Upgrade dependencies, framework, package manager, JS/TS runtime',
    framework: 'Upgrade the Stacks framework',
    dependencies: 'Upgrade your dependencies (pkgx.yaml & package.json)',
    bun: 'Upgrade Bun to the latest version',
    shell: 'Upgrade the to the latest shell integration (currently only supports Oh My Zsh)',
    binary:
      'Upgrade the `stacks` binary to the latest version. Please note, the binary is moved to the `~/.stacks/bin` directory',
    all: 'Upgrade Node, package manager, project dependencies, and framework',
    force: 'Overwrite possible local updates with remote framework updates',
    select: 'What are you trying to upgrade?',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('upgrade', descriptions.command)
    .option('-d, --dependencies', descriptions.dependencies, { default: false })
    .option('-b, --bun', descriptions.bun, { default: false })
    .option('-a, --all', descriptions.all, { default: false })
    .option('-f, --force', descriptions.force, { default: false })
    .option('--framework', descriptions.framework, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-s, --shell', descriptions.shell, { default: false })
    .option('-b, --binary', descriptions.binary, { default: false })
    // .option('--canary', descriptions.canary, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('update')
    .example('buddy upgrade -a --verbose')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade` ...', options)

      const perf = await intro('buddy upgrade')

      if (hasNoOptions(options)) {
        const answers = await prompts({
          type: 'multiselect',
          name: 'value',
          message: descriptions.select,
          choices: [
            { value: 'dependencies', title: 'Dependencies' },
            { value: 'framework', title: 'Framework' },
            { value: 'bun', title: 'Bun' },
            { value: 'shell', title: 'Shell' },
            { value: 'binary', title: 'Binary' },
          ],
        })

        let answersValue = answers.value

        if (answersValue !== null)
          process.exit(ExitCode.InvalidArgument)

        if (isString(answersValue))
          answersValue = [answersValue]

        // creates an object out of array and sets answers to true
        options = answersValue.reduce((a: any, v: any) => {
          a[v] = true
          return a
        }, {})
      }

      const result = await runAction(Action.Upgrade, options)

      if (result.isErr()) {
        await outro(
          'While running the buddy:upgrade command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('Upgrade complete.', { startTime: perf, useSeconds: true })
      process.exit()
    })

  buddy
    .command('upgrade:framework', descriptions.framework)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:framework --verbose')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:framework` ...', options)

      // const perf = await intro('buddy update:framework')
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:dependencies', descriptions.dependencies)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('upgrade:deps')
    .example('buddy upgrade:dependencies --verbose')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:dependencies` ...', options)
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:bun', descriptions.bun)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:bun` ...', options)
      const perf = await intro('buddy upgrade:bun')
      const result = await runAction(Action.UpgradeBun, options)

      if (result.isErr()) {
        await outro(
          'While running the buddy upgrade:bun command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        ) // FIXME: should not have to cast
        process.exit()
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:all', descriptions.all)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:all` ...', options)
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:shell', descriptions.shell)
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:shell')
    .action(async (options: UpgradeOptions) => {
      log.debug('Running `buddy upgrade:shell` ...', options)

      const perf = await intro('buddy upgrade:shell')
      const result = await runAction(Action.UpgradeShell, options)

      if (result.isErr()) {
        await outro(
          'While running the buddy upgrade:shell command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        ) // FIXME: should not have to cast
        process.exit()
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:binary', descriptions.binary)
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:binary')
    .action(async (options: UpgradeOptions) => {
      if (process.getuid && process.getuid() !== 0) {
        log.warn('To upgrade the binary, you need to run this command with sudo, or as root.')
        process.exit(0) // Exit with an error code
      }

      log.debug('Running `buddy upgrade:binary` ...', options)

      const perf = await intro('buddy upgrade:binary')
      const result = await runAction(Action.UpgradeBinary, options)

      if (result.isErr()) {
        await outro(
          'While running the buddy upgrade:binary command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        ) // FIXME: should not have to cast
        process.exit()
      }

      process.exit(ExitCode.Success)
    })

  buddy.on('upgrade:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

function hasNoOptions(options: UpgradeOptions) {
  return (
    !options.framework && !options.dependencies && !options.bun && !options.shell && !options.binary && !options.all
  )
}
