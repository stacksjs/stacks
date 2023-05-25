// triggered via `buddy inspire`
// overwrites the default `buddy inspire` command

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
//     const startTime = await intro(Action.Inspire, options)
//     const result = runAction('inspire')
//
//     if (result.isErr()) {
//       outro('While running the inspire command, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
//       process.exit(ExitCode.FatalError)
//     }
//
//    const quote = result.value
//
//     outro(`Your custom quote is ${quote}`, { startTime, useSeconds: true })
//     process.exit(ExitCode.Success)
//   },
// })
