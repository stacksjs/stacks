import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { bold, dim, green, intro, log } from '@stacksjs/cli'
import { storage } from '@stacksjs/storage'

export function version(buddy: CLI): void {
  const descriptions = {
    version: 'Retrieving Stacks build version',
  }

  buddy.command('version', descriptions.version).action(async () => {
    log.debug('Running `buddy version` ...')
    await intro('buddy version')

    const pkg = await storage.readPackageJson('./package.json')
    const bunVersion = 'wip'
    const stacksVersion = pkg.version

    log.info(green(bold('@stacksjs/ ')) + dim(` ${stacksVersion}`))
    log.info(green(bold('Bun: ')) + dim(`   ${bunVersion}`))

    // redis (or other cache/s), mysql (or other database/s),
  })

  buddy.on('version:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
