import type { CLI, CliOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { onUnknownSubcommand } from "@stacksjs/cli"
import { runTypeGeneration } from './generate'

export function types(buddy: CLI): void {
  const descriptions = {
    generate: 'Generate the types of & for your library/libraries',
    fix: 'Fix the generated types of & for your library/libraries (not yet implemented)',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  // The same implementation `generate:types` runs, not a second one. These two
  // spellings were two commands doing different amounts of work, and the CLI
  // resolved whichever registered first - so `types:generate` regenerated types
  // and left `database/types.d.ts` stale (stacksjs/stacks#1923). An alias could
  // not fix it: `onUnknownSubcommand` claims the whole `types:` namespace before
  // an alias on another command is consulted.
  buddy
    .command('types:generate', descriptions.generate)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-w, --watch', 'Re-run on changes to models/ and config/', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions & { watch?: boolean }) => {
      log.debug('Running `buddy types:generate` ...', options)
      await runTypeGeneration(options)
    })

  buddy
    .command('types:fix', descriptions.fix)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      // await fixTypes()
    })

  onUnknownSubcommand(buddy, "types")
}
