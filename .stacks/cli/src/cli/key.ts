import type { CAC } from 'cac'
import { generate as generateAppKey } from '../actions/key'

async function keyCommands(artisan: CAC) {
  artisan
    .command('key:generate', 'Generate & set the application key.')
    .action(async () => {
      await generateAppKey()
    })
}

export { keyCommands }
