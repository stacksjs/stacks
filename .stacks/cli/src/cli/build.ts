import type { CAC } from 'cac'
import { startBuildProcess } from '../actions/build'

async function buildCommands(artisan: CAC) {
  artisan
    .command('build', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
    .option('-c, --components', 'Build your component library')
    .option('-w, --web-components', 'Build your framework agnostic web component library') // these are automatically built with your -c option as well
    .option('-e, --elements', 'An alias to the -w flag')
    .option('-f, --functions', 'Build your function library')
    .option('-d, --docs', 'Build your documentation site')
    .option('--debug', 'Add additional debug logs', { default: false })
    // .option('-p, --pages', 'Build your pages')
    .action(async (options: any) => {
      await startBuildProcess(options)
    })

  artisan
    .command('build:components', 'Automagically build your component libraries for production use & npm/CDN distribution.')
    .action(async () => {
      await startBuildProcess('components')
    })

  artisan
    .command('build:functions', 'Automagically build your function library for production use & npm/CDN distribution.')
    .action(async () => {
      await startBuildProcess('functions')
    })

  artisan
    .command('build:web-components', 'Automagically build web component library for production use & npm/CDN distribution.')
    .action(async () => {
      await startBuildProcess('web-components')
    })

  artisan
    .command('build:docs', 'Automagically build your documentation site.')
    .action(async () => {
      await startBuildProcess('docs')
    })

  artisan
    .command('build:stacks', 'Build the core Stacks framework.')
    .action(async () => {
      await startBuildProcess('stacks')
    })
}

export { buildCommands }
