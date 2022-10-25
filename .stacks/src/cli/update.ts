import type { CLI } from '@stacksjs/types'
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
    .action(async (options: any) => {
      await updateStacks(options)
    })

  stacks
    .command('update:node', 'Update Node to version defined in ./node-version')
    .action(async () => {
      await updateStacks('node')
    })
}

export { update }
