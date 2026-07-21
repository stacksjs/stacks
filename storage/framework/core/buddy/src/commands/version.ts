import type { CLI } from '@stacksjs/types'
import { bold, dim, green, intro, log, onUnknownSubcommand } from "@stacksjs/cli"
import { versionLine } from '../version-info'

export function version(buddy: CLI): void {
  const descriptions = {
    version: 'Retrieving Stacks build version',
  }

  buddy.command('version', descriptions.version).action(async () => {
    log.debug('Running `buddy version` ...')
    await intro('buddy version')

    log.info(green(bold('Stacks: ')) + dim(` ${versionLine}`))
    log.info(green(bold('Bun: ')) + dim(`    ${Bun.version}`))

    // redis (or other cache/s), mysql (or other database/s),
  })

  onUnknownSubcommand(buddy, "version")
}
