import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, outro } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export function packageCommands(buddy: CLI): void {
  buddy
    .command('package:discover', 'Discover Stacks-compatible packages from pantry')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action(async () => {
      const perf = await intro('buddy package:discover')
      const { discoverPackages } = await import('@stacksjs/actions')
      const manifest = await discoverPackages()
      const count = Object.keys(manifest.packages).length

      if (count > 0) {
        log.success(`Discovered ${count} Stacks package${count === 1 ? '' : 's'}:`)
        for (const name of Object.keys(manifest.packages)) {
          log.info(`  - ${name}`)
        }
      }
      else {
        log.info('No Stacks-compatible packages found in pantry')
      }

      await outro('Package discovery complete', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('package:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
