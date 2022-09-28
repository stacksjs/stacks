import type { CAC } from 'cac'
import { component as makeComponent } from '../scripts/make'

async function updateCommands(artisan: CAC) {
  artisan
    .command('update', 'Updates the dependencies & framework core')
    .option('-d, --dependencies', 'Updates the dependencies')
    .option('-f, --framework', 'Updates the framework core')
    .option('-a, --all', 'Updates the dependencies & framework core')
    .action(async (options: any) => {
      await makeComponent(options)
    })
}

export { updateCommands }
