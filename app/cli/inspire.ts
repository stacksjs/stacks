// triggered via `stx inspire`
import { ExitCode } from 'stacks/core/types/src'
import { defineCommand, intro, outro } from 'stacks/core/cli/src'

export default defineCommand({
  name: 'inspire',
  description: 'Inspire yourself with a random quote',
  options: [ // or ['--two', 'Show two quotes', { default: false }]
    {
      name: '--two',
      description: 'Show two quotes',
      default: false,
    },
  ],
  action: async () => {
    const perf = await intro('buddy inspire')

    if (result.isErr()) {
      outro('While running the inspire command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      process.exit()
    }

    outro('Your quote is: ...', { startTime: perf, useSeconds: true })
    process.exit(ExitCode.Success)
  },
})
