import { type CLI } from '@stacksjs/types'
import { bold, dim, green, intro, log } from '@stacksjs/cli'
import { storage } from '@stacksjs/storage'

export function version(buddy: CLI) {
  const descriptions = {
    version: 'Retrieving Stacks build version',
  }

  buddy
    .command('version', descriptions.version)
    .action(async () => {
      await intro('buddy version')

      const pkg = await storage.readPackageJson('./package.json')
      const bunVersion = 'wip'
      const stacksVersion = pkg.version

      log.info(green(bold('Stacks: ')) + dim(` ${stacksVersion}`))
      log.info(green(bold('Bun: ')) + dim(`   ${bunVersion}`))

      // redis (or other cache/s), mysql (or other database/s),
    })
}
