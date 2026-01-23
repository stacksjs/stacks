import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

/**
 * Cancel the current running AI query
 *
 * This attempts to terminate any running claude CLI processes.
 */
export default new Action({
  name: 'BuddyCancelAction',
  description: 'Cancel the current AI query',
  method: 'POST',
  async handle(_request: RequestInstance) {
    try {
      const { $ } = await import('bun')

      // Find and kill claude CLI processes
      const result = await $`pkill -f "claude --print" || true`.quiet().nothrow()

      return response.json({
        success: true,
        message: 'Cancel signal sent',
      })
    }
    catch (error) {
      return response.json({
        success: false,
        error: (error as Error).message,
      })
    }
  },
})
