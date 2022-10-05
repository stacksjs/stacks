import type { CAC } from 'cac'
import { generate as generateAppKey } from '../scripts/key'

async function keyCommands(artisan: CAC) {
  artisan
    .command('key:generate', 'Generates & sets the application key.')
    .action(async () => {
      await generateAppKey(process.cwd())
    })
}

export { keyCommands }
