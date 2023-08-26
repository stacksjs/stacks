// triggered via `$your-command inspire`

import { Command, intro, log } from '@stacksjs/cli'
import { type CliOptions } from '@stacksjs/types'

export default new Command({
  name: 'inspire',
  description: 'Inspire yourself with a random quote',
  active: true, // default is true

  options: [ // alternatively, `options: ['--two, -t', 'Show two quotes', { default: false }]`
    {
      name: '--two, -t',
      description: 'Show two quotes',
      default: false,
    },
  ],

  run: async (options?: CliOptions) => {
    log.info('Passed options are:', options)

    await intro('buddy inspire')

    return await runAction(Action.Inspire)
  },

  // optional
  onFail: (error: Error) => {
    // outro('While running the inspire command, there was an issue', { startTime }, result.error)
    log.error(error)
  },

  // optional
  onSuccess: () => {
    // const quote = result.value
    // outro(`Your custom quote is ${quote}`, { startTime })
    log.success('Success!')
  },
})

// alternatively, you may use defineCommand() to create a command
// export default defineCommand({
//   name: 'inspire',
//   description: 'Inspire yourself with a random quote',
//   options: []
//   run: async (options: CliOptions) => {}
//   onFail: (error: Error) => {}
//   onSuccess: () => {}
// })
