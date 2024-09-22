import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'

type Request = {
  text: string
}

export default new Action({
  name: 'AiSummaryAction',
  description: 'Summary AI',

  validations: {
    text: {
      rule: schema.string().minLength(3),
      message: 'The text must be at least 3 characters long.',
    },
  },

  async handle(request: Request) {
    try {
      const text = request.text
      console.log(`Text received: ${text}`)

      const bedrockRuntime = new BedrockRuntimeClient({ region: 'us-east-1' })
      const command = new InvokeModelCommand({
        modelId: 'amazon.titan-text-express-v1',
        contentType: 'application/json',
        accept: '*/*',
        body: JSON.stringify({
          inputText: `Summarize the following text: ${text}`,
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
