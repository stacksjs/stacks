import type { BuildOptions, CLI } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, multiselect, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { hasTTY, isCI } from '@stacksjs/env'
import { ExitCode } from '@stacksjs/types'
import { resultFailed } from '../result'

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
    libs: 'Build every package configured in config/library.ts',
    desktop: 'Build the Desktop Application',
    mobile: 'Build the native iOS and Android applications',
    android: 'Build the native Android application',
    ios: 'Build the native iOS application',
    dmg: 'Package the desktop build as a macOS .app inside a .dmg',
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
    .option('-l, --libs', descriptions.libs)
    .option('-k, --desktop', descriptions.desktop)
    .option('-m, --mobile', descriptions.mobile)
    .option('--android', descriptions.android)
    .option('--ios', descriptions.ios)
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

      applyBuildTarget(server, options)

      if (options.mobile) {
        options.android = true
        options.ios = true
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
              { label: 'All library packages', value: 'libs' },
              { label: 'Desktop application', value: 'desktop' },
              { label: 'Mobile applications (iOS + Android)', value: 'mobile' },
              { label: 'Android application', value: 'android' },
              { label: 'iOS application', value: 'ios' },
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
          if (selected.has('libs')) options.libs = true
          if (selected.has('desktop')) options.desktop = true
          if (selected.has('mobile')) {
            options.mobile = true
            options.android = true
            options.ios = true
          }
          if (selected.has('android')) options.android = true
          if (selected.has('ios')) options.ios = true
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
        succeeded = (await runBuildAction(Action.BuildDocs, 'documentation', options)) && succeeded
      if (options.components)
        succeeded = (await runBuildAction(Action.BuildComponentLibs, 'component libraries', options)) && succeeded
      if (options.webComponents)
        succeeded = (await runBuildAction(Action.BuildWebComponentLib, 'web component library', options)) && succeeded
      if (options.functions)
        succeeded = (await runBuildAction(Action.BuildFunctionLib, 'function library', options)) && succeeded
      if (options.libs)
        succeeded = (await runBuildAction(Action.BuildLibs, 'library packages', options)) && succeeded
      if (options.desktop)
        succeeded = (await runBuildAction(Action.BuildDesktop, 'desktop application', options)) && succeeded
      if (options.android)
        succeeded = (await runBuildAction(Action.BuildAndroid, 'Android application', options)) && succeeded
      if (options.ios)
        succeeded = (await runBuildAction(Action.BuildIos, 'iOS application', options)) && succeeded
      if (options.views)
        succeeded = (await runBuildAction(Action.BuildViews, 'frontend', options)) && succeeded
      if (options.stacks)
        succeeded = (await runBuildAction(Action.BuildStacks, 'Stacks framework', options)) && succeeded
      if (options.buddy)
        succeeded = (await runBuildAction(Action.BuildCli, 'Buddy CLI', options)) && succeeded
      if (options.server)
        succeeded = (await runBuildAction(Action.BuildServer, 'server', options)) && succeeded

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
      if (!await runBuildAction(Action.BuildComponentLibs, 'component libraries'))
        process.exit(ExitCode.FatalError)
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

      // Discarding this Result is what made `buddy build:functions` exit 0
      // while building nothing: the action file it names did not exist, and
      // the resulting error went straight into the void.
      if (!await runBuildAction(Action.BuildFunctionLib, 'function library', options))
        process.exit(ExitCode.FatalError)
    })

  buddy
    .command('build:libs', descriptions.libs)
    .alias('build:libraries')
    .alias('prod:libs')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:libs` ...', options)

      if (!await runBuildAction(Action.BuildLibs, 'library packages', options))
        process.exit(ExitCode.FatalError)
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
      if (!await runBuildAction(Action.BuildWebComponentLib, 'web component library'))
        process.exit(ExitCode.FatalError)
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

      if (resultFailed(result)) {
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

      if (resultFailed(result)) {
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
    .command('build:mobile', descriptions.mobile)
    .alias('prod:mobile')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:mobile` ...', options)

      const perf = await intro('buddy build:mobile')
      const androidSucceeded = await runBuildAction(Action.BuildAndroid, 'Android application', options)
      const iosSucceeded = await runBuildAction(Action.BuildIos, 'iOS application', options)

      if (!androidSucceeded || !iosSucceeded) {
        await outro('One or more mobile application builds failed', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      await outro('iOS and Android applications built', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('build:android', descriptions.android)
    .alias('prod:android')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:android` ...', options)

      const perf = await intro('buddy build:android')
      const result = await runAction(Action.BuildAndroid, options)
      if (resultFailed(result)) {
        await outro('While building the Android application, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('Android application built', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('build:ios', descriptions.ios)
    .alias('prod:ios')
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:ios` ...', options)

      const perf = await intro('buddy build:ios')
      const result = await runAction(Action.BuildIos, options)
      if (resultFailed(result)) {
        await outro('While building the iOS application, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      await outro('iOS application built', { startTime: perf, useSeconds: true })
    })

  buddy
    .command('build:dmg', descriptions.dmg)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      log.debug('Running `buddy build:dmg` ...', options)

      const perf = await intro('buddy build:dmg')
      const result = await runAction(Action.BuildDmg, options)

      if (resultFailed(result)) {
        await outro(
          'While running the build:dmg command, there was an issue',
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

      if (resultFailed(result)) {
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
    && !options.libs
    && !options.desktop
    && !options.mobile
    && !options.android
    && !options.ios
    && !options.views
    && !options.docs
    && !options.stacks
    && !options.buddy
    && !options.server
  )
}

export function applyBuildTarget(target: string | undefined, options: BuildOptions): void {
  switch (target) {
    case 'components':
      options.components = true
      break
    case 'web-components':
      options.webComponents = true
      break
    case 'functions':
      options.functions = true
      break
    case 'libs':
    case 'libraries':
      options.libs = true
      break
    case 'desktop':
      options.desktop = true
      break
    case 'mobile':
      options.mobile = true
      options.android = true
      options.ios = true
      break
    case 'android':
      options.android = true
      break
    case 'ios':
      options.ios = true
      break
    case 'views':
      options.views = true
      break
    case 'docs':
      options.docs = true
      break
    case 'buddy':
    case 'cli':
      options.buddy = true
      break
    case 'stacks':
      options.stacks = true
      break
    case 'server':
      options.server = true
      break
  }
}

/**
 * Runs a build action and reports failures instead of letting them exit 0.
 * Returns true when the build succeeded.
 */
async function runBuildAction(action: Action, target: string, options?: BuildOptions): Promise<boolean> {
  const result = await runAction(action, options)

  if (resultFailed(result)) {
    log.error(`Failed to build ${target}.`, result.error)
    return false
  }

  return true
}
