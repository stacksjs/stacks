import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { buddyState, getAvailableDrivers } from './BuddyService'
import { response } from '@stacksjs/router'

/**
 * Get the current Buddy state including repo info, driver, and GitHub connection
 */
export default new Action({
  name: 'BuddyStateAction',
  description: 'Get the current Buddy state',
  method: 'GET',
  async handle(_request: RequestInstance) {
    const state = buddyState.getState()
    return response.json({
      repo: state.repo,
      currentDriver: state.currentDriver,
      availableDrivers: getAvailableDrivers(),
      github: state.github
        ? {
            username: state.github.username,
            name: state.github.name,
            connected: true,
          }
        : { connected: false },
      conversationLength: state.conversationHistory.length,
    })
  },
})
