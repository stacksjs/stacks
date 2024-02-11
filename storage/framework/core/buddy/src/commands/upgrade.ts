import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, outro, prompt } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import type { CLI, UpgradeOptions } from '@stacksjs/types'
import { Action } from '@stacksjs/enums'
import { isString } from '@stacksjs/validation'

export function upgrade(buddy: CLI) {
  const descriptions = {
    command: 'Upgrade dependencies, framework, package manager, JS/TS runtime',
    framework: 'Upgrade the Stacks framework',
    dependencies: 'Upgrade your dependencies (pkgx.yaml & package.json)',
    bun: 'Upgrade Bun to the latest version',
    all: 'Upgrade Node, package manager, project dependencies, and framework',
    force: 'Overwrite possible local updates with remote framework updates',
    select: 'What are you trying to upgrade?',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('upgrade', descriptions.command)
    .option('-c, --framework', descriptions.framework, { default: false })
    .option('-d, --dependencies', descriptions.dependencies, { default: false })
    .option('-b, --bun', descriptions.bun, { default: false })
    .option('-a, --all', descriptions.all, { default: false })
    .option('-f, --force', descriptions.force, { default: false })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('update')
    .example('buddy upgrade -a --verbose')
    .action(async (options: UpgradeOptions) => {
      const perf = await intro('buddy upgrade')

      if (hasNoOptions(options)) {
        let answers = await prompt.require()
          .multiselect(descriptions.select, {
            options: [
              { value: 'dependencies', label: 'Dependencies' },
              { value: 'framework', label: 'Framework' },
              { value: 'node', label: 'Node.js' },
              { value: 'package-manager', label: 'Package Manager' },
            ],
          })

        if (answers !== null)
          process.exit(ExitCode.InvalidArgument)

        if (isString(answers))
          answers = [answers]

        // creates an object out of array and sets answers to true
        options = answers.reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      }

      const result = await runAction(Action.Upgrade, options)

      if (result.isErr()) {
        await outro('While running the buddy:upgrade command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit()
      }

      await outro('Upgrade complete.', { startTime: perf, useSeconds: true })
      process.exit()
    })

  buddy
    .command('upgrade:framework', descriptions.framework)
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:framework --verbose')
    .action(async (options: UpgradeOptions) => {
      // const perf = await intro('buddy update:framework')
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:dependencies', descriptions.dependencies)
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('upgrade:deps')
    .example('buddy upgrade:dependencies --verbose')
    .action(async (options: UpgradeOptions) => {
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:bun', descriptions.bun)
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: UpgradeOptions) => {
      const perf = await intro('buddy upgrade:bun')
      const result = await runAction(Action.UpgradeBun, options)

      if (result.isErr()) {
        await outro('While running the buddy upgrade:bun command, there was an issue', { startTime: perf, useSeconds: true }, result.error) // FIXME: should not have to cast
        process.exit()
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:all', descriptions.all)
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: UpgradeOptions) => {
      await runAction(Action.Upgrade, options)
    })

  buddy.on('upgrade:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

function hasNoOptions(options: UpgradeOptions) {
  return !options.framework && !options.dependencies && !options.packageManager && !options.node && !options.all
}
