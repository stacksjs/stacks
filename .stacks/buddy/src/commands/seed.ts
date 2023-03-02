import type { CLI } from '@stacksjs/types'
import { log, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { seed as seeder } from '@stacksjs/database'

async function seed(buddy: CLI) {
  const descriptions = {
    seed: 'Seed Database',
  }

  buddy
    .command('seed', descriptions.seed)
    .action(async () => {
      const path = `${projectPath()}/.stacks/database/schema.prisma`

      await seeder(path)
      log.success('Seeded database successfully.')
    })
}

export { seed }
