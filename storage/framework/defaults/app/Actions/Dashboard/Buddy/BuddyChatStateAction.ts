import type { ConfiguredAIOptions } from '@stacksjs/ai'
import { Action } from '@stacksjs/actions/runtime'
import { buddyState } from '@stacksjs/ai'
import { config } from '@stacksjs/config'
import { buddyProviderStatus, publicBuddyHistory } from './buddy-chat'

export default new Action({
  name: 'BuddyChatStateAction',
  description: 'Returns the provider readiness and in-process Buddy chat history.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const aiConfig = (config.ai || {}) as ConfiguredAIOptions
    const state = buddyState.getState()

    return {
      ...buddyProviderStatus(aiConfig),
      history: publicBuddyHistory(state.conversationHistory),
      repository: state.repo
        ? {
            name: state.repo.name,
            branch: state.repo.branch,
            path: state.repo.path,
          }
        : null,
    }
  },
})
