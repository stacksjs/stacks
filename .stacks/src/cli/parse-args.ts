import cac from 'cac'
import { version } from '../../package.json'
import { ExitCode } from './exit-code'

/**
 * The parsed command-line arguments
 */
export interface ParsedArgs {
  help?: boolean
  version?: boolean
  quiet?: boolean
}

/**
 * Parses the command-line arguments
 */
export function parseArgs(): ParsedArgs {
  try {
    const cli = cac('artisan')

    cli
      .version(version)
      .command('dev', 'Run dev script for any of these packages')
      .option('-q, --quiet', 'Quiet mode')
      .action((options) => {
        // todo: next, here we need to add options
        console.log('dev options', options)
      })

    cli
      .version(version)
      .command('dev:components')
      .option('-q, --quiet', 'Quiet mode')
      .action((options) => {
        console.log('dev:components options', options)
      })

    cli
      .version(version)
      .command('dev:functions')
      .option('-q, --quiet', 'Quiet mode')
      .action((options) => {
        console.log('dev:functions options', options)
      })

    const result = cli.parse()
    const args = result.options

    const parsedArgs: ParsedArgs = {
      help: args.help as boolean,
      version: args.version as boolean,
      quiet: args.quiet as boolean,
      // options: {
      //     commit: args.commit,
      //     tag: args.tag,
      //     push: args.push,
      //     all: args.all,
      //     confirm: !args.yes,
      //     noVerify: !args.verify,
      //     files: [...args['--'] || [], ...result.args],
      //     ignoreScripts: args.ignoreScripts,
      //     execute: args.execute,
      // },
    }

    return parsedArgs
  }
  catch (error) {
    // There was an error parsing the command-line args
    return errorHandler(error as Error)
  }
}

function errorHandler(error: Error): never {
  console.error(error.message)
  return process.exit(ExitCode.InvalidArgument)
}
