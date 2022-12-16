import type { CLI } from '@stacksjs/types'
import { types as generateTypes } from '@stacksjs/actions/generate'

async function types(buddy: CLI) {
  const descriptions = {
    generate: 'Generate the types of & for your library/libraries',
    fix: 'wip',
    debug: 'Enable debug mode',
  }

  buddy
    .command('types:generate', descriptions.generate)
    .option('--debug', descriptions.debug, { default: false })
    .action(async () => {
      await generateTypes()
    })

  buddy
    .command('types:fix', descriptions.fix)
    .option('--debug', descriptions.debug, { default: false })
    .action(async () => {
      // await fixTypes()
    })
}

export { types }
