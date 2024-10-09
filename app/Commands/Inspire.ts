import type { CLI } from '@stacksjs/types'
// triggered via `$your-cli inspire` and `buddy inspire`
import process from 'node:process'
import { log, quotes } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

// for enhanced type-safety & autocompletion,
// you may want to define the options' interface
interface InspireOptions {
  two: boolean
}

export default function (cli: CLI) {
  cli
    .command('inspire', 'Inspire yourself with a random quote')
    .option('--two, -t', 'Inspire yourself with two random quotes', {
      default: false,
    })
    .alias('insp')
    .action((options: InspireOptions) => {
      if (options.two)
        quotes.random(2).map((quote, index) => log.info(`${index + 1}. ${quote}`))
      else log.info(quotes.random())

      log.success('Have a great day!')
      process.exit(ExitCode.Success)
    })

  cli.command('inspire:two', 'Inspire yourself with two random quotes').action(() => {
    // @ts-expect-error - this is safe because we hard-coded the quotes
    quotes.random(2).map((quote, index) => log.info(`${index + 1}. ${quote}`))

    log.success('Have a great day!')
    process.exit(ExitCode.Success)
  })

  cli.on('inspire:*', () => {
    log.error('Invalid command: %s\nSee --help for a list of available commands.', cli.args.join(' '))
    process.exit(1)
  })

  return cli // TODO: this may not be needed
}
