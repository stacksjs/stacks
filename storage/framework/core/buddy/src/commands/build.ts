import type { BuildOptions, CLI } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro, prompts } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function build(buddy: CLI): void {
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
    cli: 'Automagically build the CLI',
    server: 'Build the Stacks cloud server (Docker image)',
    select: 'What are you trying to build?',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('build [type]', descriptions.build)
    .option('-c, --components', descriptions.components)
    .option('-v, --vue-components', descriptions.vueComponents) // also automatically built via the -c flag
    .option('-w, --web-components', descriptions.webComponents) // also automatically built via the -c flag
    .option('-e, --elements', descriptions.elements) // alias for --web-components
    .option('-f, --functions', descriptions.functions)
    .option('-p, --views', descriptions.pages)
    .option('--pages', descriptions.pages) // alias for --views
    .option('-d, --docs', descriptions.docs)
    .option('-b, --buddy', descriptions.buddy, { default: false })
    .option('-s, --stacks', descriptions.framework, { default: false })
    .option('--project [project]', descriptions.project, { default: false })
    .option('--server', descriptions.server, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (server: string | undefined, options: BuildOptions) => {
      log.debug('Running `buddy build` ...', options)

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
        case 'server':
          options.server = true
          break
        default:
          break
      }

      console.log('server', server, options)

      // TODO: uncomment this when prompt is available
      if (hasNoOptions(options)) {
        console.log('has no')
        const answers = await prompts({
          type: 'multiselect',
          name: 'build',
          message: descriptions.select,
          choices: [
            { title: 'Components', value: 'components' },
            // { label: 'Vue Components', value: 'vue-components' },
            { title: 'Web Components', value: 'web-components' },
            { title: 'Functions', value: 'functions' },
            { title: 'Views', value: 'views' },
            { title: 'Documentation', value: 'docs' },
          ],
        })

        console.log('answers', answers)
        if (answers !== null)
          process.exit(ExitCode.InvalidArgument)
      }
      else {
        console.log('has op')
      }

      if (options.docs)
        await runAction(Action.BuildDocs)
      if (options.components)
        await runAction(Action.BuildComponentLibs)
      if (options.vueComponents)
        await runAction(Action.BuildVueComponentLib)
      if (options.webComponents)
        await runAction(Action.BuildWebComponentLib)
      if (options.functions)
        await runAction(Action.BuildFunctionLib)
      if (options.views)
        await runAction(Action.BuildViews)
      if (options.stacks)
        await runAction(Action.BuildStacks)
      if (options.buddy)
        await runAction(Action.BuildCli)
      if (options.server)
        await runAction(Action.BuildServer)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('build:components', 'Automagically build component libraries for production use & npm/CDN distribution')
    .alias('prod:components')
    .option('-c, --components', descriptions.components, { default: true })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:components` ...', options)
      await runAction(Action.BuildComponentLibs, options)
    })

  buddy
    .command('build:cli', descriptions.cli)
    .alias('prod:cli')
    .option('-b, --buddy', descriptions.buddy, { default: true })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:cli` ...', options)
      await runAction(Action.BuildCli, options)
    })

  buddy
    .command('build:server', descriptions.server)
    .alias('prod:server')
    .alias('build:docker')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:server` ...', options)
      await runAction(Action.BuildServer, options)
    })

  buddy
    .command('build:functions', 'Automagically build function library for npm/CDN distribution')
    .option('-f, --functions', descriptions.functions, { default: true })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy `build:functions` ...', options)
      await runAction(Action.BuildFunctionLib, options)
    })

  buddy
    .command('build:vue-components', 'Automagically build Vue component library for npm/CDN distribution')
    .alias('build:vue')
    .alias('prod:vue-components')
    .alias('prod:vue')
    .option('-v, --vue-components', descriptions.vueComponents, {
      default: true,
    })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .alias('build:vue')
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:vue-components` ...', options)
      await runAction(Action.BuildVueComponentLib, options)
    })

  buddy
    .command('build:web-components', 'Automagically build Web Component library for npm/CDN distribution')
    .alias('build:wc')
    .alias('prod:web-components')
    .alias('prod:wc')
    .option('-w, --web-components', descriptions.webComponents, {
      default: true,
    })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:web-components` ...', options)
      await runAction(Action.BuildWebComponentLib, options)
    })

  buddy
    .command('build:docs', 'Automagically build your documentation site.')
    .alias('prod:docs')
    .alias('build:documentation')
    .alias('prod:documentation')
    .option('-d, --docs', descriptions.docs, { default: true })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:docs` ...', options)
      await runAction(Action.BuildDocs, options)
    })

  buddy
    .command('build:core', 'Automagically build the Stacks core.')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:core` ...', options)

      const startTime = await intro('buddy build:core')
      const result = await runAction(Action.BuildCore, options)

      if (result.isErr()) {
        log.error('Failed to build the Stacks core.', result.error)
        process.exit()
      }

      await outro('Core packages built successfully', {
        startTime,
        useSeconds: true,
      })
    })

  buddy
    .command('build:desktop', descriptions.desktop)
    .alias('prod:desktop')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:desktop` ...', options)

      const perf = await intro('buddy build:desktop')
      const result = await runAction(Action.BuildDesktop, options)

      if (result.isErr()) {
        await outro(
          'While running the build:desktop command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      console.log('')
      await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('build:stacks', 'Build the Stacks framework.')
    .option('-s, --stacks', descriptions.framework, { default: true })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:stacks` ...', options)

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
  return (
    !options.components
    && !options.vueComponents
    && !options.webComponents
    && !options.elements
    && !options.functions
    && !options.views
    && !options.docs
    && !options.stacks
    && !options.buddy
  )
}
