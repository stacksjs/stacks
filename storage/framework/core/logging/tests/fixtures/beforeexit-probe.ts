import process from 'node:process'

const { log, registerTransport } = await import('../../src/index')

// A transport whose `flush()` does real event-loop work. Nothing synthetic
// about it: clarity's file transport writes, and the LogHQ and BugHQ reporters
// POST, so this is the ordinary shape once anything is configured.
let flushed = false
registerTransport({
  name: 'beforeexit-probe',
  log: () => {},
  flush: async () => {
    await new Promise(resolve => setTimeout(resolve, 1))
    flushed = true
  },
})

// Reported from `exit` because the drain happens after main has finished,
// which is the whole point of the hook under test.
process.on('exit', () => {
  console.log(JSON.stringify({ flushed }))
})

await log.info('a line, so the logger initializes and installs the hook')

// Deliberately no `process.exit`. This is the natural-exit path the hook
// exists for, and the one that used to spin forever.
