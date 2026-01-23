import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { buddyState } from '@stacksjs/ai'

/**
 * Disconnect the GitHub account
 */
export default new Action({
  name: 'BuddyGitHubDisconnectAction',
  description: 'Disconnect the GitHub account',
  method: 'POST',
  async handle(_request: RequestInstance) {
    const state = buddyState.getState()
    const previousUser = state.github?.username
    buddyState.setGitHub(null)
    console.log(`GitHub disconnected: ${previousUser || 'unknown'}`)
    return response.json({ success: true })
  },
})
