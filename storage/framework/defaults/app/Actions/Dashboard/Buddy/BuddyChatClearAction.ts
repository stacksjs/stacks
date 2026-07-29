import { Action } from '@stacksjs/actions'
import { buddyState } from '@stacksjs/ai'

export default new Action({
  name: 'BuddyChatClearAction',
  description: 'Clears the in-process Buddy chat history.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    buddyState.clearHistory()
    return { success: true }
  },
})
