import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { summarize } from '@stacksjs/ai'
import { log } from '@stacksjs/logging'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'AiSummaryAction',
  description: 'Summary AI',
  method: 'POST',
  apiResponse: true,

  validations: {
    text: {
      rule: schema.string().min(3).required(),
      message: 'The text must be at least 3 characters long.',
    },
  },

  async handle(request: RequestInstance) {
    await request.validate()
    const text = String(request.get('text') || '').trim()

    try {
      return response.json({
        data: await summarize(text),
      })
    }
    catch (error) {
      log.error('[ai] Summary request failed', { error })
      return response.json({ message: 'The AI provider could not summarize the text.' }, 502)
    }
  },
})
