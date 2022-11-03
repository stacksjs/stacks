import type { CLI, UpdateOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { prompts } from '@stacksjs/cli'
import { invoke as updateStacks } from '../actions/update'

const descriptions = {
  command: 'Update dependencies, framework, package manager, and/or Node',
  framework: 'Update the Stacks framework',
  dependencies: 'Update your dependencies',
  packageManager: 'Update your package manager, i.e. pnpm',
  node: 'Update Node to the version defined in ./node-version',
  all: 'Update Node, package manager, project dependencies, and framework',
  force: 'Overwrite possible local updates with remote framework updates',
  debug: 'Enable debug mode',
  select: 'What are you trying to update?',
}

async function update(stacks: CLI) {
  stacks
    .command('update', descriptions.command)
    .option('-c, --framework', descriptions.framework, { default: false })
    .option('-d, --dependencies', descriptions.dependencies, { default: false })
    .option('-p, --package-manager', descriptions.packageManager, { default: false })
    .option('-n, --node', descriptions.node, { default: false })
    .option('-a, --all', descriptions.all, { default: false })
    .option('-f, --force', descriptions.force, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .example('stacks update -a --debug')
    .action(async (options: UpdateOptions) => {
      if (hasNoOptions(options)) {
        const answers = await prompts.multiselect({
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

        // creates an object out of array and sets answers to true
        options = answers.reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      }

      await updateStacks(options)
    })

  stacks
    .command('update:framework', descriptions.framework)
    .option('-f, --framework', descriptions.framework, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .example('stacks update:framework --debug')
    .action(async (options: UpdateOptions) => {
      await updateStacks(options)
    })

  stacks
    .command('update:dependencies', descriptions.dependencies)
    .option('-d, --dependencies', descriptions.dependencies, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .alias('update:deps')
    .example('stacks update:dependencies --debug')
    .action(async (options: UpdateOptions) => {
      await updateStacks(options)
    })

  stacks
    .command('update:package-manager', descriptions.packageManager)
    .option('-p, --package-manager', descriptions.packageManager, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .alias('update:pm')
    .example('stacks update:package-manager 7.14.0 --debug')
    .example('stacks update:package-manager latest')
    .action(async (options: UpdateOptions) => {
      options.version = 'latest'

      if (stacks.args[0])
        options.version = stacks.args[0]

      await updateStacks(options)

      process.exit(ExitCode.Success)
    })

  stacks
    .command('update:node', descriptions.node)
    .option('-n, --node', descriptions.node, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks(options)
    })

  stacks
    .command('update:all', descriptions.all)
    .option('-a, --all', descriptions.all, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks(options)
    })
}

function hasNoOptions(options: UpdateOptions) {
  return !options.framework && !options.dependencies && !options.packageManager && !options.node && !options.all
}

export { update }
