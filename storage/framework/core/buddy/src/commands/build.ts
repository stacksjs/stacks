import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro, prompt } from '@stacksjs/cli'
import type { BuildOptions, CLI } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { Action } from '@stacksjs/enums'
import { isString } from '@stacksjs/validation'

export function build(buddy: CLI) {
  const descriptions = {
    build: 'Build any of your libraries (packages) for production use',
    components: 'Build your component library',
    vueComponents: 'Build your Vue component library',
    webComponents: 'Build your framework agnostic web component library',
    elements: 'An alias to the -w flag',
    buddy: 'Build the Buddy binary',
    functions: 'Build your function library',
    desktop: 'Build the Desktop Application',
    pages: 'Build your frontend',
    docs: 'Build your documentation',
    framework: 'Build Stacks framework',
    select: 'What are you trying to build?',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('build [type]', descriptions.build)
    .option('-c, --components', descriptions.components)
    .option('-v, --vue-components', descriptions.vueComponents) // these are automatically built with your -c option as well
    .option('-w, --web-components', descriptions.webComponents) // these are automatically built with your -c option as well
    .option('-e, --elements', descriptions.elements)
    .option('-f, --functions', descriptions.functions)
    .option('-p, --views', descriptions.pages)
    .option('-d, --docs', descriptions.docs)
    .option('-b, --buddy', descriptions.buddy, { default: false })
    .option('-s, --stacks', descriptions.framework, { default: false })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (server: string | undefined, options: BuildOptions) => {
      switch (server) {
        case 'components':
          options.components = true
          break
        case 'vue':
          options.vueComponents = true
          break
        case 'web-components':
          options.webComponents = true
          break
        case 'functions':
          options.functions = true
          break
        case 'views':
          options.views = true
          break
        case 'docs':
          options.docs = true
          break
        case 'buddy':
          options.buddy = true
          break
        case 'cli':
          options.buddy = true
          break
        case 'stacks':
          options.stacks = true
          break
        default:
          break
      }

      if (hasNoOptions(options)) {
        let answers = await prompt.require()
          .multiselect(descriptions.select, {
            options: [
              { label: 'Components', value: 'components' },
              // { label: 'Vue Components', value: 'vue-components' },
              { label: 'Web Components', value: 'web-components' },
              { label: 'Functions', value: 'functions' },
              { label: 'Views', value: 'views' },
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

      await runAction(Action.BuildStacks, options)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('build:components', 'Automagically build component libraries for production use & npm/CDN distribution')
    .option('-c, --components', descriptions.components, { default: true })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      await runAction(Action.BuildComponentLibs, options)
    })

  buddy
    .command('build:cli', 'Automagically build the CLI')
    .option('-b, --buddy', descriptions.buddy, { default: true })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      await runAction(Action.BuildCli, options)
    })

  buddy
    .command('build:functions', 'Automagically build function library for npm/CDN distribution')
    .option('-f, --functions', descriptions.functions, { default: true })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      await runAction(Action.BuildFunctionLib, options)
    })

  buddy
    .command('build:vue-components', 'Automagically build Vue component library for npm/CDN distribution')
    .option('-v, --vue-components', descriptions.vueComponents, { default: true })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('build:vue')
    .action(async (options: BuildOptions) => {
      await runAction(Action.BuildVueComponentLib, options)
    })

  buddy
    .command('build:web-components', 'Automagically build Web Component library for npm/CDN distribution')
    .option('-w, --web-components', descriptions.webComponents, { default: true })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('build:elements')
    .alias('build:wc')
    .action(async (options: BuildOptions) => {
      await runAction(Action.BuildWebComponentLib, options)
    })

  buddy
    .command('build:docs', 'Automagically build your documentation site.')
    .option('-d, --docs', descriptions.docs, { default: true })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      await runAction(Action.BuildDocs, options)
    })

  buddy
    .command('build:core', 'Automagically build the Stacks core.')
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      const startTime = await intro('buddy build:core')
      const result = await runAction(Action.BuildCore, options)

      if (result.isErr()) {
        log.error('Failed to build the Stacks core.', result.error)
        process.exit()
      }

      await outro('Core packages built successfully', { startTime, useSeconds: true })
    })

  buddy
    .command('build:desktop', descriptions.desktop)
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      const perf = await intro('buddy build:desktop')
      const result = await runAction(Action.BuildDesktop, options)

      if (result.isErr()) {
        await outro('While running the build:desktop command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit()
      }

      // eslint-disable-next-line no-console
      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('build:stacks', 'Build the Stacks framework.')
    .option('-s, --stacks', descriptions.framework, { default: true })
    .option('-p, --project', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      const startTime = await intro('buddy build:stacks')
      const result = await runAction(Action.BuildStacks, options)

      if (result.isErr()) {
        log.error('Failed to build Stacks.', result.error)
        process.exit()
      }

      await outro('Stacks built successfully', { startTime, useSeconds: true })
    })

  buddy.on('build:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

function hasNoOptions(options: BuildOptions) {
  return !options.components && !options.vueComponents && !options.webComponents && !options.elements && !options.functions && !options.views && !options.docs && !options.stacks && !options.buddy
}
