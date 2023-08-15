/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

import process from 'node:process'
import { type BuildOptions, type CLI } from '@stacksjs/types'
import { Action, ExitCode } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'
import { intro, log, outro, prompt } from '@stacksjs/cli'
import { runAction } from '@stacksjs/actions'

export function build(buddy: CLI) {
  const descriptions = {
    components: 'Build your component library',
    vueComponents: 'Build your Vue component library',
    webComponents: 'Build your framework agnostic web component library',
    elements: 'An alias to the -w flag',
    functions: 'Build your function library',
    pages: 'Build your SSG views',
    docs: 'Build your documentation site',
    stacks: 'Build Stacks framework',
    select: 'What are you trying to build?',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('build', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
    .option('-c, --components', descriptions.components)
    .option('-v, --vue-components', descriptions.vueComponents) // these are automatically built with your -c option as well
    .option('-w, --web-components', descriptions.webComponents) // these are automatically built with your -c option as well
    .option('-e, --elements', descriptions.elements)
    .option('-f, --functions', descriptions.functions)
    .option('-p, --views', descriptions.pages)
    .option('-d, --docs', descriptions.docs)
    .option('-s, --stacks', descriptions.stacks, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      if (hasNoOptions(options)) {
        let answers = await prompt.require()
          .multiselect(descriptions.select, {
            options: [
              { label: 'Components', value: 'components' },
              // { label: 'Vue Components', value: 'vue-components' },
              // { label: 'Web Components', value: 'web-components' },
              { label: 'Functions', value: 'functions' },
              { label: 'Pages', value: 'pages' },
              { label: 'Documentation', value: 'docs' },
            ],
          })

        if (answers !== null)
          process.exit(ExitCode.InvalidArgument)

        if (isString(answers))
          answers = [answers]

        // creates an object out of array and sets answers to true
        options = answers.reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      }

      runAction(Action.BuildStacks, options)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('build:components', 'Automagically build component libraries for production use & npm/CDN distribution')
    .option('-c, --components', descriptions.components, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action((options: BuildOptions) => {
      runAction(Action.BuildComponentLibs, options)
    })

  buddy
    .command('build:cli', 'Automagically build the CLI')
    .option('-c, --components', descriptions.components, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action((options: BuildOptions) => {
      runAction(Action.BuildCli, options)
    })

  buddy
    .command('build:functions', 'Automagically build function library for npm/CDN distribution')
    .option('-f, --functions', descriptions.functions, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action((options: BuildOptions) => {
      runAction(Action.BuildFunctionLib, options)
    })

  buddy
    .command('build:vue-components', 'Automagically build Vue component library for npm/CDN distribution')
    .option('-v, --vue-components', descriptions.vueComponents, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('build:vue')
    .action((options: BuildOptions) => {
      runAction(Action.BuildVueComponentLib, options)
    })

  buddy
    .command('build:web-components', 'Automagically build Web Component library for npm/CDN distribution')
    .option('-w, --web-components', descriptions.webComponents, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('build:elements')
    .alias('build:wc')
    .action((options: BuildOptions) => {
      runAction(Action.BuildWebComponentLib, options)
    })

  buddy
    .command('build:docs', 'Automagically build your documentation site.')
    .option('-d, --docs', descriptions.docs, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action((options: BuildOptions) => {
      runAction(Action.BuildDocs, options)
    })

  buddy
    .command('build:core', 'Automagically build the Stacks core.')
    .option('--verbose', descriptions.verbose, { default: true })
    .action(async (options: BuildOptions) => {
      const startTime = await intro('buddy build:core')
      const result = runAction(Action.BuildCore, options)

      if (result.isErr()) {
        log.error('Failed to build the Stacks core.', result.error)
        process.exit()
      }

      await outro('Stacks core built successfully', { startTime, useSeconds: true })
    })

  buddy
    .command('build:stacks', 'Build the Stacks framework.')
    .option('-s, --stacks', descriptions.stacks, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      const startTime = await intro('buddy build:stacks')
      const result = runAction(Action.BuildStacks, options)

      if (result.isErr()) {
        log.error('Failed to build Stacks.', result.error as Error)
        process.exit()
      }

      await outro('Stacks built successfully', { startTime, useSeconds: true })
    })
}

function hasNoOptions(options: BuildOptions) {
  return !options.components && !options.vueComponents && !options.webComponents && !options.elements && !options.functions && !options.pages && !options.docs && !options.stacks
}
