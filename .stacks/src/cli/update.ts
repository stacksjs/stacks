import type { CLI, UpdateOptions } from '@stacksjs/types'
import { Prompts } from '@stacksjs/cli'
import { stacks as updateStacks } from './actions/update'

const { prompts } = Prompts

async function update(stacks: CLI) {
  stacks
    .command('update', 'Update dependencies, framework, package manager, and/or Node')
    .option('-c, --framework', 'Update the Stacks framework', { default: false })
    .option('-d, --dependencies', 'Update your dependencies', { default: false })
    .option('-p, --package-manager', 'Update your package manager, i.e. pnpm', { default: false })
    .option('-n, --node', 'Update Node to the version defined in ./node-version', { default: false })
    .option('-f, --force', 'Overwrite possible local updates with remote framework updates', { default: false })
    .option('-a, --all', 'Update Node, package manager, project dependencies, and framework', { default: false })
    .option('--debug', 'Add additional debug logs', { default: false })
    .example('stacks update -a --debug')
    .action(async (options: UpdateOptions) => {
      if (!options.framework && !options.dependencies && !options.packageManager && !options.node && !options.all) {
        const answers = await prompts.multiselect({
          type: 'multiselect',
          name: 'update',
          message: 'What are you trying to update?',
          choices: [
            { title: 'Dependencies', value: 'dependencies' },
            { title: 'Framework', value: 'framework' },
            { title: 'Node', value: 'node' },
            { title: 'pnpm', value: 'package-manager' },
          ],
          initial: 0,
        })

        // when answers are provided via the multi-select,
        // then an array is returned with the answer values
        if (Array.isArray(answers))
          options = answers.reduce((a, v) => ({ ...a, [v]: true }), {}) // creates an object out of array and sets answers to true
      }

      await updateStacks(options)
    })

  stacks
    .command('update:framework', 'Update the Stacks framework')
    .option('--debug', 'Add additional debug logs', { default: false })
    .example('stacks update:framework --debug')
    .action(async (options: UpdateOptions) => {
      await updateStacks({ framework: true, ...options })
    })

  stacks
    .command('update:dependencies', 'Update your dependencies')
    .option('--debug', 'Add additional debug logs', { default: false })
    .alias('deps')
    .example('stacks update:dependencies --debug')
    .action(async (options: UpdateOptions) => {
      await updateStacks({ dependencies: true, ...options })
    })

  stacks
    .command('update:package-manager', 'Update your package manager, i.e. pnpm')
    .option('--debug', 'Add additional debug logs', { default: false })
    .example('stacks update:package-manager 7.14.0 --debug')
    .example('stacks update:package-manager latest')
    .alias('update:pm')
    .action(async (options: UpdateOptions) => {
      options.version = 'latest'

      if (stacks.args[0])
        options.version = stacks.args[0]

      await updateStacks({ packageManager: true, ...options })
      return stacks.outputHelp()
    })

  stacks
    .command('update:node', 'Update Node to version defined in ./node-version')
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks({ node: true, ...options })
    })

  stacks
    .command('update:all', 'Update Node, package manager, project dependencies, and framework')
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks({ all: true, ...options })
    })
}

export { update }
