import type { CAC } from 'cac'
import { stacks as update } from '../scripts/update'

async function updateCommands(artisan: CAC) {
  artisan
    .command('update', 'Updates dependencies & framework.')
    .option('-c, --framework', 'Update the Stacks core/framework', { default: true })
    .option('-d, --dependencies', 'Update your dependencies', { default: true })
    .option('-f, --force', 'Overwrite possible local updates with remote framework updates', { default: false })
    .action(async (options: any) => {
      await update(options)
    })
}

export { updateCommands }
