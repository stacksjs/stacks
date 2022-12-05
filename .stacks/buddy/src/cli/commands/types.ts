import type { CLI } from '@stacksjs/types'
import { types as generateTypes } from '@stacksjs/actions/cli/generate'

const descriptions = {
  generate: 'Generate the types of & for your library/libraries',
  fix: 'wip',
  debug: 'Enable debug mode',
}

async function types(stacks: CLI) {
  stacks
    .command('types:generate', descriptions.generate)
    .option('--debug', descriptions.debug, { default: false })
    .action(async () => {
      await generateTypes()
    })

  stacks
    .command('types:fix', descriptions.fix)
    .option('--debug', descriptions.debug, { default: false })
    .action(async () => {
      // await fixTypes()
    })
}

export { types }
