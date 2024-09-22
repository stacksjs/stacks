import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'

type Request = {
  question: string
}

export default new Action({
  name: 'AiAskAction',
  description: 'Ask AI',

  validations: {
    question: {
      rule: schema.string().minLength(3).maxLength(255),
      message: 'The question must be between 3 and 255 characters long.',
    },
  },

  async handle(request: Request) {
    try {
      // Extract the 'text' property from the request body
      const question = request.question
      console.log(`Question received: ${question}`)

      const bedrockRuntime = new BedrockRuntimeClient({ region: 'us-east-1' })
      const command = new InvokeModelCommand({
        modelId: 'amazon.titan-text-express-v1',
        contentType: 'application/json',
        accept: '*/*',
        body: JSON.stringify({
          inputText: question,
          textGenerationConfig: {
            maxTokenCount: 512,
            stopSequences: [],
            temperature: 0,
            topP: 0.9,
          },
        }),
      })

      const response = await bedrockRuntime.send(command)

      return {
        statusCode: 200,
        body: new TextDecoder().decode(response.body),
      }
    } catch (error) {
      console.error('Error:', error)

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'An error occurred while processing your request.' }),
      }
    }
  },
})
