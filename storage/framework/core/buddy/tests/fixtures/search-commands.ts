/** Parse the real command registry; only the provider dispatch is replaced. */
import process from 'node:process'

const actions = await import('@stacksjs/actions')
Bun.plugin({
  setup(build) {
    build.module('@stacksjs/actions', () => ({
      exports: {
        ...actions,
        runAction: async (action: string, options: Record<string, unknown>) => {
          console.log(JSON.stringify({ call: 'runAction', action, options }))
          process.exit(0)
        },
      },
      loader: 'object',
    }))
  },
})

const { cli } = await import('@stacksjs/cli')
const { search } = await import('../../src/commands/search')
const buddy = cli('buddy')
search(buddy)
await buddy.parse(['bun', 'buddy', ...process.argv.slice(2)])
