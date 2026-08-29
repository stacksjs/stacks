// triggered via `$your-cli inspire` and `buddy inspire`
import process from 'node:process'
import { defineCommand, log, quotes } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

// Every file in this directory is a command - there is nothing to register.
// `defineCommand` types the CLI it hands you; the declarative form
// (`defineCommand({ name, options, handle })`) additionally infers the
// handler's options from the flags it declares.
interface InspireOptions {
  two: boolean
}

export default defineCommand((cli) => {
  cli
    .command('inspire', 'Inspire yourself with a random quote')
    .option('--two, -t', 'Inspire yourself with two random quotes', {
      default: false,
    })
    .alias('insp')
    .action((options: InspireOptions) => {
      try {
        if (options.two) {
          const randomQuotes = quotes.random(2)
          randomQuotes.toArray().forEach((quote, index) => {
            console.log(`${index + 1}. ${quote}`)
          })
        }
        else {
          const quote = quotes.random(1).first()
          console.log(`\n"${quote}"\n`)
        }

        console.log('Have a great day!')
      }
      catch (error) {
        console.error('Error:', error)
      }
      process.exit(ExitCode.Success)
    })

  cli.command('inspire:two', 'Inspire yourself with two random quotes').action(() => {
    console.log('')
    quotes.random(2).toArray().forEach((quote, index) => {
      console.log(`${index + 1}. "${quote}"`)
    })
    console.log('')
    console.log('Have a great day!')
    process.exit(ExitCode.Success)
  })

  cli.on('inspire:*', () => {
    log.error('Invalid command: %s\nSee --help for a list of available commands.', cli.args.join(' '))
    process.exit(1)
  })
})
