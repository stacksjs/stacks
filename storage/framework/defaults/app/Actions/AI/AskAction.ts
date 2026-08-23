import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { ask } from '@stacksjs/ai'
import { log } from '@stacksjs/logging'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'AiAskAction',
  description: 'Ask AI',
  method: 'POST',
  apiResponse: true,

  validations: {
    question: {
      rule: schema.string().min(3).max(255).required(),
      message: 'The question must be between 3 and 255 characters long.',
    },
  },

  async handle(request: RequestInstance) {
    await request.validate()
    const question = String(request.get('question') || '').trim()

    try {
      return response.json({
        data: await ask(question),
      })
    }
    catch (error) {
      log.error('[ai] Ask request failed', { error })
      return response.json({ message: 'The AI provider could not answer the question.' }, 502)
    }
  },
})
