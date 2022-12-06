import type { CLI, KeyOptions } from '@stacksjs/types'
import { generate as generateAppKey } from '../../actions/key'

async function key(stacks: CLI) {
  const descriptions = {
    command: 'Generate & set the application key.',
    debug: 'Enable debug mode',
  }

  stacks
    .command('key:generate', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: KeyOptions) => {
      await generateAppKey(options)
    })
}

export { key }
