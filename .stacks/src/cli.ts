import { cac } from 'cac'
import { version as packageVersion } from '../package.json'
import { startDevelopmentServer } from './scripts/dev'
import { startBuildProcess } from './scripts/build'
import { reinstallNpmDependencies } from './scripts/fresh'
import { lint, lintFix } from './scripts/lint'
import { updateNpmDependencies } from './scripts/update'
import { component as makeComponent, fx as makeFunction, language as makeLanguage, stack as makeStack } from './scripts/make'
import { generateTestCoverageReport, runTestSuite, typecheck } from './scripts/test'
import { ExitCode } from './cli/exit-code'
import { release } from './scripts/release'
import { commit } from './scripts/commit'
import { generateTypes } from './scripts/generate'

/**
 * The main entry point of the CLI
 *
 * @param args - The command-line arguments (e.g. ["dev", "dev -c", "dev:components"])
 */
async function main() {
  try {
    const cli = cac('artisan')

    // Setup global error handlers
    process.on('uncaughtException', errorHandler)
    process.on('unhandledRejection', errorHandler)

    cli
      .command('dev', 'Start the development server for any of the following packages')
      .option('-c, --components', 'Start the Components development server')
      .option('-f, --functions', 'Start the Functions development server')
      .option('-d, --docs', 'Start the Documentation development server')
      // .option('-p, --pages', 'Start the Pages development server')
      .action(async (options) => {
        await startDevelopmentServer(options)
      })

    cli
      .command('dev:components', 'Start the development server for your component library')
      .action(async () => {
        await startDevelopmentServer('components')
      })

    cli
      .command('dev:docs', 'Start the development server for your documentation')
      .action(async () => {
        await startDevelopmentServer('docs')
      })

    cli
      .command('build', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
      .option('-c, --components', 'Build your component library')
      .option('-w, --web-components', 'Build your web component library') // these are automatically built with your -c option as well
      .option('-e, --elements', 'An alias to the -w flag')
      .option('-f, --functions', 'Build your function library')
      .option('-d, --docs', 'Build your documentation site')
      .option('-n, --npm', 'Build all npm publishable code')
      // .option('-p, --pages', 'Build your pages')
      // .option('-d, --docs', 'Build your documentation')
      .action(async (options) => {
        await startBuildProcess(options)
      })

    cli
      .command('build:components', 'Automagically build your component libraries for production use & npm/CDN distribution.')
      .action(async () => {
        await startBuildProcess('components')
      })

    cli
      .command('build:functions', 'Automagically build your function library for production use & npm/CDN distribution.')
      .action(async () => {
        await startBuildProcess('functions')
      })

    cli
      .command('build:elements', 'Automagically build web component library for production use & npm/CDN distribution.')
      .action(async () => {
        await startBuildProcess('web-components')
      })

    cli
      .command('build:docs', 'Automagically build your documentation site.')
      .action(async () => {
        await startBuildProcess('docs')
      })

    cli
      .command('build:stacks', 'Build the core Stacks framework.')
      .action(async () => {
        await startBuildProcess('stacks')
      })

    cli
      .command('fresh', 'Reinstalls your npm dependencies.')
      .action(async () => {
        await reinstallNpmDependencies()
      })

    cli
      .command('update', 'Updates your npm dependencies to their latest version based on the specified range.')
      .action(async () => {
        await updateNpmDependencies()
      })

    cli
      .command('lint', 'Automagically lints your codebase.')
      .action(async () => {
        await lint()
      })

    cli
      .command('lint:fix', 'Automagically fixes lint errors.')
      .action(async () => {
        await lintFix()
      })

    cli
      .command('make:component', 'Scaffolds a component.')
      .action(async () => {
        await makeComponent(cli.args[0])
      })

    cli
      .command('make:function', 'Scaffolds a function.')
      .action(async () => {
        await makeFunction(cli.args[0])
      })

    cli
      .command('make:lang', 'Scaffolds a language file.')
      .action(async () => {
        await makeLanguage(cli.args[0])
      })

    cli
      .command('make:stack', 'Scaffolds a new stack.')
      .action(async () => {
        await makeStack(cli.args[0])
      })

    cli
      .command('test', 'Runs your test suite.')
      .action(async () => {
        await runTestSuite()
      })

    cli
      .command('test:types', 'Typechecks your codebase.')
      .action(async () => {
        await typecheck()
      })

    cli
      .command('test:coverage', 'Generates a test coverage report.')
      .action(async () => {
        await generateTestCoverageReport()
      })

    cli
      .command('release', 'Releases a new version of your libraries/packages.')
      .action(async () => {
        await release()
      })

    cli
      .command('commit', 'Commit your stashed changes.')
      .action(async () => {
        await commit()
      })

    cli
      .command('generate:types', 'Generates the types of your library/libraries.')
      .action(async () => {
        await generateTypes()
      })

    cli
      .version(packageVersion)
      .command('version', 'Review the current version')
      .outputVersion()

    cli.parse()
  }
  catch (error) {
    errorHandler(error as Error)
  }
}

function errorHandler(error: Error): void {
  let message = error.message || String(error)

  if (process.env.DEBUG || process.env.NODE_ENV === 'development')
    message = error.stack || message

  console.error(message)
  process.exit(ExitCode.FatalError)
}

main()
