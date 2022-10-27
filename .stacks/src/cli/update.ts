import type { CLI, UpdateOptions } from '@stacksjs/types'
import { stacks as updateStacks } from './actions/update'

async function update(stacks: CLI) {
  stacks
    .command('update', 'Updates dependencies & framework.')
    .option('-c, --framework', 'Update the Stacks framework', { default: true })
    .option('-d, --dependencies', 'Update your dependencies', { default: true })
    .option('-p, --package-manager', 'Update your package manager, i.e. pnpm', { default: true })
    .option('-n, --node', 'Update Node to version defined in ./node-version', { default: true })
    .option('-f, --force', 'Overwrite possible local updates with remote framework updates', { default: false })
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks(undefined, options)
    })

  stacks
    .command('update:framework', 'Update the Stacks framework')
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks('framework', options)
    })

  stacks
    .command('update:dependencies', 'Update your dependencies')
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks('dependencies', options)
    })

  stacks
    .command('update:package-manager', 'Update your package manager, i.e. pnpm')
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks('package-manager', options)
    })

  stacks
    .command('update:node', 'Update Node to version defined in ./node-version')
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: UpdateOptions) => {
      await updateStacks('node', options)
    })
}

export { update }
