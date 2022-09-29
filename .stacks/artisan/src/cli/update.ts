import type { CAC } from 'cac'
import consola from 'consola'
import { stacks as updateStack } from '../scripts/update'

async function updateCommands(artisan: CAC) {
  artisan
    .command('update', 'Updates the dependencies & framework.')
    .action(async () => {
      consola.info('Updating Stacks & its dependencies...')
      await updateStack()
      consola.success('Updated Stacks & its dependencies.')
    })
}

export { updateCommands }
