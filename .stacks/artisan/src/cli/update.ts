import type { CAC } from 'cac'
import consola from 'consola'
import { resolve } from 'pathe'
import { copyFiles } from '../../../src/scripts/copy-files'
// import { component as makeComponent } from '../scripts/make'
import { updateStack } from '../scripts/update'

async function updateCommands(artisan: CAC) {
  artisan
    .command('update', 'Updates the dependencies & framework.')
    .action(async () => {
      consola.info('Updating your Stack\'s dependencies...')
      await updateStack()
      consola.success('Updated your Stack\'s dependencies.')

      consola.info('Updating the Stacks Framework...')
      const from = resolve('../../../../node_modules/@stacksjs/framework')
      // eslint-disable-next-line no-console
      console.log('from', from)
      const to = resolve('../../../../.stacks')
      // eslint-disable-next-line no-console
      console.log('to', to)
      await copyFiles(from, to)
      consola.success('Updated the Stacks Framework.')
    })
}

export { updateCommands }
