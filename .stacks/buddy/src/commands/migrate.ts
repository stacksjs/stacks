import type { CLI } from '@stacksjs/types'
import { log, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

async function migrate(buddy: CLI) {
  const descriptions = {
    init: 'Initialize Migration',
    lintFix: 'Automagically fixes all lint errors',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
  }

  buddy
    .command('migrate:init', descriptions.init)
    .action(async () => {
      const path = `${projectPath()}/.stacks/database/schema.prisma`

      await runCommand(`npx prisma migrate init --schema=${path}`)

      log.success('Migration initialized successfully')
    })
}

export { migrate }
