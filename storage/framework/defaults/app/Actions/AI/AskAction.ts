import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'AskAction',
  description: 'Ask AI a question',
  method: 'POST',

  async handle(request: RequestInstance) {
    const body = await request.json()
    const { question, context } = body as { question?: string, context?: string }

    if (!question) {
      return {
        success: false,
        error: 'Question is required',
      }
    }

    // TODO: Implement actual AI integration
    return {
      success: true,
      question,
      context,
      answer: `This is a placeholder response for: "${question}"`,
    }
  },
})
