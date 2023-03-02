import type { CLI } from '@stacksjs/types'
import { log, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

async function migrate(buddy: CLI) {
  const descriptions = {
    seed: 'Seed Database',
  }

  buddy
    .command('seed', descriptions.seed)
    .action(async () => {
      log.success('Seeded database successfully.')
    })
}

export { migrate }
