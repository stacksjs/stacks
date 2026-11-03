// Preloaded by action-exit-codes.test.ts: every action fails, without running
// a real build, so a command's exit status is all that is left to observe.
import { plugin } from 'bun'

plugin({
  name: 'failing-actions',
  setup(build) {
    build.module('@stacksjs/actions', () => ({
      loader: 'object',
      exports: {
        runAction: async (action: string) => {
          console.log(`ran ${action}`)
          return { isErr: true, isOk: false, error: new Error(`${action} failed`) }
        },
      },
    }))
  },
})
