import type { CLI, PrepublishOptions } from '@stacksjs/types'
import { Action } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'

const descriptions = {
  command: 'Run your prepublish script',
  debug: 'Enable debug mode',
}

async function prepublish(stacks: CLI) {
  stacks
    .command('prepublish', descriptions.command)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: PrepublishOptions) => {
      await runAction(Action.Prepublish, options)
    })
}

export { prepublish }
