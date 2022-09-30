import type { CAC } from 'cac'
import consola from 'consola'
import { stacks as update } from '../scripts/update'

async function updateCommands(artisan: CAC) {
  artisan
    .command('update', 'Updates dependencies & framework.')
    .option('-f, --framework', 'Update the Stacks framework', { default: true })
    .option('-d, --dependencies', 'Update the Stacks framework', { default: true })
    .action(async (options: any) => {
      consola.info('Updating Stacks & its dependencies...')
      await update(options)
      consola.success('Updated Stacks & its dependencies.')
    })
}

export { updateCommands }
