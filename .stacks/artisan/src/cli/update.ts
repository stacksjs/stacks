import type { CAC } from 'cac'
import { resolve } from 'pathe'
import { copyFiles } from '../../../src/scripts/copy-files'
// import { component as makeComponent } from '../scripts/make'
import { updateStack } from '../scripts/update'

async function updateCommands(artisan: CAC) {
  artisan
    .command('update', 'Updates the dependencies & framework.')
    .action(async () => {
      await updateStack()
      const from = resolve('../../../../node_modules/@stacksjs/framework')
      const to = resolve('../../../../.stacks')
      copyFiles(from, to)
    })
}

export { updateCommands }
