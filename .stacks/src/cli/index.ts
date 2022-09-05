import { cac } from 'cac'
import { version as packageVersion } from '../../package.json'
import { startDevelopmentServer } from '../scripts/dev'
import { startBuildProcess } from '../scripts/build'
import { reinstallNpmDependencies } from '../scripts/fresh'
import { lint, lintFix } from '../scripts/lint'
import { updateNpmDependencies } from '../scripts/update'
import { component as makeComponent, fx as makeFunction, language as makeLanguage } from '../scripts/make'
import { ExitCode } from './exit-code'

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
      .version(packageVersion)
      .command('dev', 'Start the development server for any of the following packages')
      .option('-c, --components', 'Start the Components development server')
      .option('-f, --functions', 'Start the Functions development server')
      // .option('-p, --pages', 'Start the Pages development server')
      // .option('-d, --docs', 'Start the Documentation development server')
      .action(async (options) => {
        await startDevelopmentServer(options)
      })

    cli
      .version(packageVersion)
      .command('dev:components', 'Start the development server for your component library')
      .action(async () => {
        await startDevelopmentServer('components')
      })

    cli
      .version(packageVersion)
      .command('build', 'Automagically build any of your libraries/packages for production use. Select any of the following packages')
      .option('-c, --components', 'Build your component library')
      .option('-w, --web-components', 'Build your web component library') // these are automatically built with your -c option as well
      .option('-e, --elements', 'An alias to the -w flag')
      .option('-f, --functions', 'Build your function library')
      // .option('-p, --pages', 'Build your pages')
      // .option('-d, --docs', 'Build your documentation')
      .action(async (options) => {
        await startBuildProcess(options)
      })

    cli
      .version(packageVersion)
      .command('build:components', 'Automagically build your component libraries for production use & npm/CDN distribution.')
      .action(async () => {
        await startBuildProcess('components')
      })

    cli
      .version(packageVersion)
      .command('build:functions', 'Automagically build your function library for production use & npm/CDN distribution.')
      .action(async () => {
        await startBuildProcess('functions')
      })

    cli
      .version(packageVersion)
      .command('build:elements', 'Automagically build web component library for production use & npm/CDN distribution.')
      .action(async () => {
        await startBuildProcess('web-components')
      })

    cli
      .version(packageVersion)
      .command('build:artisan-cli', 'Automagically build the Artisan CLI.')
      .action(async () => {
        await startBuildProcess('artisan-cli')
      })

    cli
      .version(packageVersion)
      .command('fresh', 'Reinstalls your npm dependencies.')
      .action(async () => {
        await reinstallNpmDependencies()
      })

    cli
      .version(packageVersion)
      .command('update', 'Updates your npm dependencies to their latest version based on the specified range.')
      .action(async () => {
        await updateNpmDependencies()
      })

    cli
      .version(packageVersion)
      .command('lint', 'Automagically lints your codebase.')
      .action(async () => {
        await lint()
      })

    cli
      .version(packageVersion)
      .command('lint:fix', 'Automagically fixes lint errors.')
      .action(async () => {
        await lintFix()
      })

    cli
      .version(packageVersion)
      .command('make:component', 'Scaffolds a component.')
      .action(async () => {
        await makeComponent(cli.args[0])
      })

    cli
      .version(packageVersion)
      .command('make:function', 'Scaffolds a function.')
      .action(async () => {
        await makeFunction(cli.args[0])
      })

    cli
      .version(packageVersion)
      .command('make:lang', 'Scaffolds a language file.')
      .action(async () => {
        await makeLanguage(cli.args[0])
      })

    // cli
    //   .version(packageVersion)
    //   .command('help', 'Review the available commands')
    //   .outputHelp()

    cli
      .version(packageVersion)
      .command('version', 'Review the current version')
      .outputVersion()

    // const result = cli.parse()
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
