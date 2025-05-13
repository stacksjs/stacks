import { Action } from '@stacksjs/actions'
import { summarize } from '@stacksjs/ai'
import { schema } from '@stacksjs/validation'

// TODO: this should have been auto-generated
interface Request {
  text: string
}

export default new Action({
  name: 'AiSummaryAction',
  description: 'Summary AI',
  method: 'POST',

  validations: {
    text: {
      rule: schema.string().min(3),
      message: 'The text must be at least 3 characters long.',
    },
  },

  async handle(request: Request) {
    try {
      const text = request.text

      console.log(`Text received: ${text}`)

      return {
        data: await summarize(text),
      }
    }
    catch (error) {
      console.error('Error:', error)

      return {
        error: 'An error occurred while processing your request.',
      }
    }
  },
})
