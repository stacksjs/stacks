import type { BuildOptions, CLI } from '@stacksjs/types'
import { Prompts } from '@stacksjs/cli'
import { startBuildProcess } from './actions/build'

const { prompts } = Prompts

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
    .action(async (options: BuildOptions) => {
      if (hasNoOptions(options)) {
        const answers = await prompts.multiselect({
          type: 'multiselect',
          name: 'update',
          message: 'What are you trying to build?',
          choices: [
            { title: 'Components', value: 'components' },
            { title: 'Vue Components', value: 'vue-components' },
            { title: 'Web Components', value: 'web-components' },
            { title: 'Functions', value: 'functions' },
            { title: 'Pages', value: 'pages' },
            { title: 'Documentation', value: 'docs' },
          ],
        })

        // creates an object out of array and sets answers to true
        options = answers.reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      }

      await startBuildProcess(options)
    })

  stacks
    .command('build:components', 'Automagically build component libraries for production use & npm/CDN distribution')
    .action(async () => {
      await startBuildProcess({ components: true })
    })

  stacks
    .command('build:functions', 'Automagically build function library for npm/CDN distribution')
    .action(async () => {
      await startBuildProcess({ functions: true })
    })

  stacks
    .command('build:vue-components', 'Automagically build Vue component library for npm/CDN distribution')
    .alias('build:vue')
    .action(async () => {
      await startBuildProcess({ vueComponents: true })
    })

  stacks
    .command('build:web-components', 'Automagically build Web Component library for npm/CDN distribution')
    .alias('build:elements')
    .alias('build:wc')
    .action(async () => {
      await startBuildProcess({ webComponents: true })
    })

  stacks
    .command('build:docs', 'Automagically build your documentation site.')
    .action(async () => {
      await startBuildProcess({ docs: true })
    })

  stacks
    .command('build:stacks', 'Build the core Stacks framework.')
    .action(async () => {
      await startBuildProcess({ stacks: true })
    })
}

function hasNoOptions(options: BuildOptions) {
  return !options.components && !options.vueComponents && !options.webComponents && !options.elements && !options.functions && !options.pages && !options.docs && !options.stacks
}

export { build }
