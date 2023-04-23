import type { CLI } from '@stacksjs/types'
import { types as generateTypes } from '@stacksjs/actions/generate'

async function types(buddy: CLI) {
  const descriptions = {
    generate: 'Generate the types of & for your library/libraries',
    fix: 'wip',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('types:generate', descriptions.generate)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      await generateTypes()
    })

  buddy
    .command('types:fix', descriptions.fix)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      // await fixTypes()
    })
}

export { types }
