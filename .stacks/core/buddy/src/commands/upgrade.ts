import type { CLI, UpgradeOptions } from '@stacksjs/types'
import { Action, ExitCode } from '@stacksjs/types'
import { intro, outro, prompt } from '@stacksjs/cli'
import { runAction } from '@stacksjs/actions'

async function upgrade(buddy: CLI) {
  const descriptions = {
    command: 'Upgrade dependencies, framework, package manager, and/or Node.js',
    framework: 'Upgrade the Stacks framework',
    dependencies: 'Upgrade your dependencies',
    packageManager: 'Upgrade your package manager, i.e. pnpm',
    node: 'Upgrade Node to the version defined in ./node-version',
    all: 'Upgrade Node, package manager, project dependencies, and framework',
    force: 'Overwrite possible local updates with remote framework updates',
    select: 'What are you trying to upgrade?',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('upgrade', descriptions.command)
    .option('-c, --framework', descriptions.framework, { default: false })
    .option('-d, --dependencies', descriptions.dependencies, { default: false })
    .option('-p, --package-manager', descriptions.packageManager, { default: false })
    .option('-n, --node', descriptions.node, { default: false })
    .option('-a, --all', descriptions.all, { default: false })
    .option('-f, --force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('update')
    .example('buddy upgrade -a --verbose')
    .action(async (options: UpgradeOptions) => {
      const perf = await intro('buddy upgrade')

      if (hasNoOptions(options)) {
        const answers = await prompt(descriptions.select, {
          type: 'multiselect',
          required: true,
          options: [
            { value: 'dependencies', label: 'Dependencies' },
            { value: 'framework', label: 'Framework' },
            { value: 'node', label: 'Node.js' },
            { value: 'package-manager', label: 'Package Manager' },
          ],
        })

        if (answers.includes('dependencies'))
          options.dependencies = true

        if (answers.includes('framework'))
          options.framework = true

        if (answers.includes('node'))
          options.node = true

        if (answers.includes('package-manager'))
          options.packageManager = true
      }

      const result = await runAction(Action.Upgrade, { ...options, shell: true })
      console.log('result', result)

      // if (result.isErr()) {
      //   outro('While running the buddy:upgrade command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      outro('Upgrade complete.', { startTime: perf, useSeconds: true })
      process.exit()
    })

  buddy
    .command('upgrade:framework', descriptions.framework)
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy upgrade:framework --verbose')
    .action(async (options: UpgradeOptions) => {
      const perf = await intro('buddy update:framework')
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:dependencies', descriptions.dependencies)
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('upgrade:deps')
    .example('buddy upgrade:dependencies --verbose')
    .action(async (options: UpgradeOptions) => {
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:package-manager', descriptions.packageManager)
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('upgrade:pm')
    .example('buddy upgrade:package-manager 7.16.1 --verbose')
    .example('buddy upgrade:package-manager latest')
    .action(async (options: UpgradeOptions) => {
      options.version = 'latest'

      if (buddy.args[0])
        options.version = buddy.args[0]

      const perf = await intro('buddy upgrade:package-manager')
      const result = await runAction(Action.UpgradePackageManager, options)
      console.log('result', result, perf)

      // if (response.isErr()) {
      //   outro('While running the buddy upgrade:package-manager command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, response.error)
      //   process.exit()
      // }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:node', descriptions.node)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: UpgradeOptions) => {
      const perf = await intro('buddy upgrade:node')
      const result = await runAction(Action.UpgradeNode, options)
      console.log('result', result, perf)

      // if (response.isErr()) {
      //   outro('While running the buddy upgrade:node command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, response.error)
      //   process.exit()
      // }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:all', descriptions.all)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: UpgradeOptions) => {
      // await runAction(Action.Upgrade, { ...options, all: true })
    })
}

function hasNoOptions(options: UpgradeOptions) {
  return !options.framework && !options.dependencies && !options.packageManager && !options.node && !options.all
}

export { upgrade }
