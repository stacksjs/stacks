import { cac } from 'cac'
import { version as packageVersion } from '../../package.json'
import { startDevelopmentServer } from '../start-development-server'
import { startBuildProcess } from '../start-build-process'
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
      .option('-p, --pages', 'Start the Pages development server')
      .option('-d, --docs', 'Start the Documentation development server')
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
      .option('-f, --functions', 'Build your function library')
      .option('-p, --pages', 'Build your pages')
      .option('-d, --docs', 'Build your documentation')
      .action(async (options) => {
        await startBuildProcess(options)
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
