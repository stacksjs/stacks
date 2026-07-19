import type { BuildOptions, CLI } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, multiselect, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { hasTTY, isCI } from '@stacksjs/env'
import { ExitCode } from '@stacksjs/types'

// Lazy-load @stacksjs/actions — importing it at module level forces every
// `buddy <anything>` invocation to resolve the actions barrel before
// `--help` can render. Pulling it in only when a build subcommand
// actually fires keeps `buddy --help` snappy.
let _runAction: typeof import('@stacksjs/actions').runAction | undefined
async function runAction(...args: Parameters<typeof import('@stacksjs/actions').runAction>): ReturnType<typeof import('@stacksjs/actions').runAction> {
  if (!_runAction) _runAction = (await import('@stacksjs/actions')).runAction
  return _runAction(...args)
}

export function build(buddy: CLI): void {
  const descriptions = {
    build: 'Build any of your libraries (packages) for production use',
    components: 'Build your component library',
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
    frontendStatic: 'Build the prerendered marketing/public static site (storage/framework/frontend-dist)',
    select: 'What are you trying to build?',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('build [type]', descriptions.build)
    .option('-c, --components', descriptions.components)
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

      if (hasNoOptions(options)) {
        // Bare `buddy build`: ask interactively when a TTY is available.
        if (!isCI && hasTTY && process.stdin.isTTY) {
          const answers = await multiselect({
            message: descriptions.select,
            choices: [
              { label: 'Frontend (views)', value: 'views' },
              { label: 'Components', value: 'components' },
              { label: 'Web Components', value: 'webComponents' },
              { label: 'Functions', value: 'functions' },
              { label: 'Documentation', value: 'docs' },
              { label: 'Stacks framework', value: 'stacks' },
              { label: 'Buddy CLI', value: 'buddy' },
              { label: 'Server (Docker image)', value: 'server' },
            ],
          })

          const selected = new Set(answers)
          if (selected.has('views')) options.views = true
          if (selected.has('components')) options.components = true
          if (selected.has('webComponents')) options.webComponents = true
          if (selected.has('functions')) options.functions = true
          if (selected.has('docs')) options.docs = true
          if (selected.has('stacks')) options.stacks = true
          if (selected.has('buddy')) options.buddy = true
          if (selected.has('server')) options.server = true
        }

        // Non-interactive shells (CI, pipes) and empty prompt selections fall
        // back to the app default: the frontend. Building the framework stays
        // opt-in via `buddy build --stacks` / `buddy build:stacks`.
        if (hasNoOptions(options)) {
          options.views = true
          log.info('No build target specified, defaulting to the frontend (views). See `buddy build --help` for all targets.')
        }
      }

      let succeeded = true

      if (options.docs)
        succeeded = (await runBuildAction(Action.BuildDocs, 'documentation')) && succeeded
      if (options.components)
        succeeded = (await runBuildAction(Action.BuildComponentLibs, 'component libraries')) && succeeded
      if (options.webComponents)
        succeeded = (await runBuildAction(Action.BuildWebComponentLib, 'web component library')) && succeeded
      if (options.functions)
        succeeded = (await runBuildAction(Action.BuildFunctionLib, 'function library')) && succeeded
      if (options.views)
        succeeded = (await runBuildAction(Action.BuildViews, 'frontend')) && succeeded
      if (options.stacks)
        succeeded = (await runBuildAction(Action.BuildStacks, 'Stacks framework')) && succeeded
      if (options.buddy)
        succeeded = (await runBuildAction(Action.BuildCli, 'Buddy CLI')) && succeeded
      if (options.server)
        succeeded = (await runBuildAction(Action.BuildServer, 'server')) && succeeded

      if (!succeeded)
        process.exit(ExitCode.FatalError)

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
      log.debug('Running `buddy build:functions` ...', options)
      await runAction(Action.BuildFunctionLib, options)
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
    .command('build:frontend', descriptions.pages)
    .alias('build:pages')
    .alias('build:views')
    .alias('prod:frontend')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:frontend` ...', options)
      await runAction(Action.BuildViews, options)
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
    .command('build:frontend-static', descriptions.frontendStatic)
    .alias('build:public')
    .alias('prod:frontend-static')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:frontend-static` ...', options)
      await runAction(Action.BuildFrontendStatic, options)
    })

  buddy
    .command('build:core', 'Automagically build the Stacks core.')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:core` ...', options)

      const startTime = await intro('buddy build:core')
      const result = await runAction(Action.BuildCore, options)

      if (result.isErr) {
        log.error('Failed to build the Stacks core.', result.error)
        process.exit(ExitCode.FatalError)
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

      if (result.isErr) {
        await outro(
          'While running the build:desktop command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
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

      if (result.isErr) {
        log.error('Failed to build Stacks.', result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Stacks built successfully', { startTime, useSeconds: true })
    })

  onUnknownSubcommand(buddy, "build")
}

function hasNoOptions(options: BuildOptions) {
  return (
    !options.components
    && !options.webComponents
    && !options.elements
    && !options.functions
    && !options.views
    && !options.docs
    && !options.stacks
    && !options.buddy
    && !options.server
  )
}

/**
 * Runs a build action and reports failures instead of letting them exit 0.
 * Returns true when the build succeeded.
 */
async function runBuildAction(action: Action, target: string): Promise<boolean> {
  const result = await runAction(action)

  if (result.isErr) {
    log.error(`Failed to build ${target}.`, result.error)
    return false
  }

  return true
}
