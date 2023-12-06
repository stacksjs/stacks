import process from 'node:process'
import type { CLI } from '@stacksjs/types'
import { generateTypes } from '@stacksjs/actions'

export function types(buddy: CLI) {
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

  buddy.on('types:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
