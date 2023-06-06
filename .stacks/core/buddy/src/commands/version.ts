import type { CLI } from '@stacksjs/types'
import { bold, dim, green, intro } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import * as storage from '@stacksjs/storage'

async function version(buddy: CLI) {
  const descriptions = {
    version: 'Retrieving Stacks build version',
  }

  buddy
    .command('version', descriptions.version)
    .action(async () => {
      await intro('buddy version')

      const pkg = await storage.readPackageJson('./package.json')
      const nodeVersion = pkg.engines.node.replace('>=v', '')
      const pnpmVersion = pkg.engines.pnpm.replace('>=', '')
      const stacksVersion = pkg.version

      log.info(green(bold('Stacks: ')) + dim(` ${stacksVersion}`))
      log.info(green(bold('node: ')) + dim(`   ${nodeVersion}`))
      log.info(green(bold('pnpm: ')) + dim(`   ${pnpmVersion}`))
      // redis (or other cache/s), mysql (or other database/s),
    })
}

export { version }
