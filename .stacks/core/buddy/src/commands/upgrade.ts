import { Action, CLI, UpgradeOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { prompts } from '@stacksjs/cli'
import { runAction } from '@stacksjs/actions'

async function upgrade(buddy: CLI) {
  const descriptions = {
    command: 'Upgrade dependencies, framework, package manager, and/or Node',
    framework: 'Upgrade the Stacks framework',
    dependencies: 'Upgrade your dependencies',
    packageManager: 'Upgrade your package manager, i.e. pnpm',
    node: 'Upgrade Node to the version defined in ./node-version',
    all: 'Upgrade Node, package manager, project dependencies, and framework',
    force: 'Overwrite possible local updates with remote framework updates',
    select: 'What are you trying to upgrade?',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
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
    .option('--debug', descriptions.debug, { default: false })
    .example('buddy update -a --verbose')
    .action(async (options: UpgradeOptions) => {
      if (hasNoOptions(options)) {
        const answers: string[] = await prompts.multiselect({
          type: 'multiselect',
          name: 'update',
          message: descriptions.select,
          choices: [
            { title: 'Dependencies', value: 'dependencies' },
            { title: 'Framework', value: 'framework' },
            { title: 'Node', value: 'node' },
            { title: 'pnpm', value: 'package-manager' },
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

      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:framework', descriptions.framework)
    .option('-f, --framework', descriptions.framework, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .example('buddy upgrade:framework --verbose')
    .action(async (options: UpgradeOptions) => {
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:dependencies', descriptions.dependencies)
    .option('-d, --dependencies', descriptions.dependencies, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .alias('upgrade:deps')
    .example('buddy upgrade:dependencies --verbose')
    .action(async (options: UpgradeOptions) => {
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:package-manager', descriptions.packageManager)
    .option('-p, --package-manager', descriptions.packageManager, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .alias('upgrade:pm')
    .example('buddy upgrade:package-manager 7.16.1 --verbose')
    .example('buddy upgrade:package-manager latest')
    .action(async (options: UpgradeOptions) => {
      options.version = 'latest'

      if (buddy.args[0])
        options.version = buddy.args[0]

      await runAction(Action.Upgrade, options)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('upgrade:node', descriptions.node)
    .option('-n, --node', descriptions.node, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: UpgradeOptions) => {
      await runAction(Action.Upgrade, options)
    })

  buddy
    .command('upgrade:all', descriptions.all)
    .option('-a, --all', descriptions.all, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: UpgradeOptions) => {
      await runAction(Action.Upgrade, options)
    })
}

function hasNoOptions(options: UpgradeOptions) {
  return !options.framework && !options.dependencies && !options.packageManager && !options.node && !options.all
}

export { upgrade }
