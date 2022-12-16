import type { CLI, KeyOptions } from '@stacksjs/types'
import { generate as generateAppKey } from '@stacksjs/actions/key'

async function key(buddy: CLI) {
  const descriptions = {
    command: 'Generate & set the application key.',
    debug: 'Enable debug mode',
  }

  buddy
    .command('key:generate', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: KeyOptions) => {
      await generateAppKey(options)
    })
}

export { key }
