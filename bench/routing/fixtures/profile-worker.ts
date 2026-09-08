import { captureCpuWindow } from '../profile-window'

const output = process.env.BENCH_PROFILE_OUTPUT
if (!output || !process.send)
  throw new Error('The CPU profiling worker requires an output path and IPC parent')

const start = Promise.withResolvers<void>()
const stop = Promise.withResolvers<void>()
process.on('message', (message) => {
  if (message === 'start') start.resolve()
  if (message === 'stop') stop.resolve()
})

// This is the same public framework fixture used by the throughput matrix.
// No profiling branch or replacement handler enters framework source.
await import('../servers/stacks')
process.send('ready')
const result = await captureCpuWindow(start.promise, stop.promise, () => process.send!('started'))
await Bun.write(output, `${JSON.stringify(result)}\n`)
process.send('captured')
// Keep serving until the parent verifies response parity and terminates us.
