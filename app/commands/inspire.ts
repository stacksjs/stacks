// triggered via `$your-commands $command`
//
// export default defineCommand({
//   name: 'inspire',
//   description: 'Inspire yourself with a random quote',
//   options: [ // or ['--two, -t', 'Show two quotes', { default: false }]
//     {
//       name: '--two, -t',
//       description: 'Show two quotes',
//       default: false,
//     },
//   ],
//   action: async (options: CliOptions) => {
//     const startTime = await intro('buddy inspire', options)
//     const result = runAction(Action.Inspire)
//
//     if (result.isErr()) {
//       outro('While running the inspire command, there was an issue', { startTime }, result.error)
//       process.exit(ExitCode.FatalError)
//     }
//
//     const quote = result.value
//
//     outro(`Your custom quote is ${quote}`, { startTime })
//     process.exit(ExitCode.Success)
//   },
// })
