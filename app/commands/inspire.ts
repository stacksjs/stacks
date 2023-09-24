// triggered via `$your-command inspire`
import process from 'node:process'
import { cli, log } from '@stacksjs/cli'
import { collect } from '@stacksjs/collections'

// for enhanced type safety
interface InspireOptions {
  two: boolean
}

const quotes = collect([
  'The best way to get started is to quit talking and begin doing.',
  'The pessimist sees difficulty in every opportunity. The optimist sees opportunity in every difficulty.',
  'Don’t let yesterday take up too much of today.',
  'You learn more from failure than from success. Don’t let it stop you. Failure builds character.',
  'It’s not whether you get knocked down, it’s whether you get up.',
  'If you are working on something that you really care about, you don’t have to be pushed. The vision pulls you.',
  'People who are crazy enough to think they can change the world, are the ones who do.',
  'Failure will never overtake me if my determination to succeed is strong enough.',
  'Entrepreneurs are great at dealing with uncertainty and also very good at minimizing risk. That’s the classic entrepreneur.',
  'We may encounter many defeats but we must not be defeated.',
  'Knowing is not enough; we must apply. Wishing is not enough; we must do.',
  'Imagine your life is perfect in every respect; what would it look like?',
  'We generate fears while we sit. We overcome them by action.',
  'Whether you think you can or think you can’t, you’re right.',
  'Security is mostly a superstition. Life is either a daring adventure or nothing.',
])

cli()
  .command('inspire', 'Inspire yourself with a random quote')
  .option('--two, -t', 'Show two quotes', { default: false })
  .alias('insp')
  .action((options: InspireOptions) => {
    if (options.two)
      quotes.random(2).forEach(quote => log.info(quote))
    else
      log.info(quotes.random())

    log.info('')
    log.success('Have a great day!')
    process.exit(ExitCode.Success)
  })
