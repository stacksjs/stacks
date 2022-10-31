import type { CLI } from '@stacksjs/types'
import { generate as generateAppKey } from './actions/key'

async function key(stacks: CLI) {
  stacks
    .command('key:generate', 'Generate & set the application key.')
    .option('--debug', descriptions.debug, { default: false })
    .action(async () => {
      await generateAppKey()
    })
}

export { key }
