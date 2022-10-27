import type { BuildOption, BuildOptions, CLI } from '@stacksjs/types'
import { startBuildProcess } from './actions/build'

async function build(stacks: CLI) {
  stacks
    .command('build', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
    .option('-c, --components', 'Build your component library')
    .option('-v, --vue-components', 'Build your Vue component library') // these are automatically built with your -c option as well
    .option('-w, --web-components', 'Build your framework agnostic web component library') // these are automatically built with your -c option as well
    .option('-e, --elements', 'An alias to the -w flag')
    .option('-f, --functions', 'Build your function library')
    .option('-p, --pages', 'Build your SSG pages')
    .option('-d, --docs', 'Build your documentation site')
    .option('-s, --stacks', 'Build Stacks framework', { default: false })
    .option('--debug', 'Add additional debug logs', { default: false })
    .action(async (options: BuildOptions & BuildOption) => {
      await startBuildProcess(options)
    })

  stacks
    .command('build:components', 'Automagically build your component libraries for production use & npm/CDN distribution.')
    .action(async () => {
      const type: BuildOption = 'components'
      await startBuildProcess(type)
    })

  stacks
    .command('build:functions', 'Automagically build your function library for production use & npm/CDN distribution.')
    .action(async () => {
      await startBuildProcess('functions')
    })

  stacks
    .command('build:web-components', 'Automagically build web component library for production use & npm/CDN distribution.')
    .alias('build:elements')
    .alias('build:wc')
    .action(async () => {
      await startBuildProcess('web-components')
    })

  stacks
    .command('build:docs', 'Automagically build your documentation site.')
    .action(async () => {
      await startBuildProcess('docs')
    })

  stacks
    .command('build:stacks', 'Build the core Stacks framework.')
    .action(async () => {
      await startBuildProcess('stacks')
    })
}

export { build }
