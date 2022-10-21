import type { CAC } from 'cac'
import { startDevelopmentServer } from './actions/dev'

async function dev(artisan: CAC) {
  artisan
    .command('dev', 'Start the development server for any of the following packages')
    .option('-c, --components', 'Start the Components development server')
    .option('-f, --functions', 'Start the Functions development server')
    .option('-d, --docs', 'Start the Documentation development server')
    // .option('-p, --pages', 'Start the Pages development server')
    .action(async (options: any) => {
      await startDevelopmentServer(options)
    })

  artisan
    .command('dev:components', 'Start the development server for your component library')
    .action(async () => {
      await startDevelopmentServer('components')
    })

  artisan
    .command('dev:docs', 'Start the development server for your documentation')
    .action(async () => {
      await startDevelopmentServer('docs')
    })
}

export { dev }
