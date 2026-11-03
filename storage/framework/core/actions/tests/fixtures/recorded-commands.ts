// Preloaded by prepublish.test.ts: @stacksjs/cli as it is, except that
// runCommand records what it was asked to run instead of running it, and fails
// when PREPUBLISH_FAIL names a match.
import process from 'node:process'
import { plugin } from 'bun'

const realCli = Bun.resolveSync('@stacksjs/cli', import.meta.dir)

plugin({
  name: 'recorded-commands',
  setup(build) {
    build.module('@stacksjs/cli', async () => ({
      loader: 'object',
      exports: {
        ...await import(realCli),
        runCommand: async (command: string | string[]) => {
          const text = Array.isArray(command) ? command.join(' ') : command
          console.log(`ran ${text}`)
          const fail = process.env.PREPUBLISH_FAIL
          return fail && text.includes(fail)
            ? { isErr: true, isOk: false, error: new Error(`${text} failed`) }
            : { isErr: false, isOk: true, value: {} }
        },
      },
    }))
  },
})
