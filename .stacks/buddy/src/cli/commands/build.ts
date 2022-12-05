import type { BuildOptions, CLI } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { prompts } from '@stacksjs/cli'
import { invoke as startBuildProcess } from '@stacksjs/actions/buddy/build'

const descriptions = {
  components: 'Build your component library',
  vueComponents: 'Build your Vue component library',
  webComponents: 'Build your framework agnostic web component library',
  elements: 'An alias to the -w flag',
  functions: 'Build your function library',
  pages: 'Build your SSG pages',
  docs: 'Build your documentation site',
  stacks: 'Build Stacks framework',
  debug: 'Enable debug mode',
}

async function build(stacks: CLI) {
  stacks
    .command('build', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
    .option('-c, --components', descriptions.components)
    .option('-v, --vue-components', descriptions.vueComponents) // these are automatically built with your -c option as well
    .option('-w, --web-components', descriptions.webComponents) // these are automatically built with your -c option as well
    .option('-e, --elements', descriptions.elements)
    .option('-f, --functions', descriptions.functions)
    .option('-p, --pages', descriptions.pages)
    .option('-d, --docs', descriptions.docs)
    .option('-s, --stacks', descriptions.stacks, { default: false })
    .option('--debug', descriptions.debug, { default: false })
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

      process.exit(ExitCode.Success)
    })

  stacks
    .command('build:components', 'Automagically build component libraries for production use & npm/CDN distribution')
    .option('-c, --components', descriptions.components, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: BuildOptions) => {
      await startBuildProcess(options)
    })

  stacks
    .command('build:functions', 'Automagically build function library for npm/CDN distribution')
    .option('-f, --functions', descriptions.functions, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: BuildOptions) => {
      await startBuildProcess(options)
    })

  stacks
    .command('build:vue-components', 'Automagically build Vue component library for npm/CDN distribution')
    .option('-v, --vue-components', descriptions.vueComponents, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .alias('build:vue')
    .action(async (options: BuildOptions) => {
      await startBuildProcess(options)
    })

  stacks
    .command('build:web-components', 'Automagically build Web Component library for npm/CDN distribution')
    .option('-w, --web-components', descriptions.webComponents, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .alias('build:elements')
    .alias('build:wc')
    .action(async (options: BuildOptions) => {
      await startBuildProcess(options)
    })

  stacks
    .command('build:docs', 'Automagically build your documentation site.')
    .option('-d, --docs', descriptions.docs, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: BuildOptions) => {
      await startBuildProcess(options)
    })

  stacks
    .command('build:stacks', 'Build the core Stacks framework.')
    .option('-s, --stacks', descriptions.stacks, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: BuildOptions) => {
      await startBuildProcess(options)
    })
}

function hasNoOptions(options: BuildOptions) {
  return !options.components && !options.vueComponents && !options.webComponents && !options.elements && !options.functions && !options.pages && !options.docs && !options.stacks
}

export { build }
