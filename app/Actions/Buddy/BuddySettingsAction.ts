import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { apiKeys } from '@stacksjs/ai'

/**
 * Get the current settings status (which API keys are configured)
 */
export default new Action({
  name: 'BuddySettingsAction',
  description: 'Get the current Buddy settings status',
  method: 'GET',
  async handle(_request: RequestInstance) {
    return response.json({
      configured: {
        anthropic: !!apiKeys.anthropic,
        openai: !!apiKeys.openai,
        claudeCliHost: !!apiKeys.claudeCliHost,
      },
    })
  },
})
