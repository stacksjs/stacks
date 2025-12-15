import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { buddyState, getAvailableDrivers } from './BuddyService'

/**
 * Get the current Buddy state including repo info, driver, and GitHub connection
 */
export default new Action({
  name: 'BuddyStateAction',
  description: 'Get the current Buddy state',
  method: 'GET',
  async handle(_request: RequestInstance) {
    const state = buddyState.getState()
    return {
      repo: state.repo,
      currentDriver: state.currentDriver,
      historyLength: state.conversationHistory.length,
      availableDrivers: getAvailableDrivers(),
      github: state.github ? {
        username: state.github.username,
        name: state.github.name,
        email: state.github.email,
      } : null,
    }
  },
})
