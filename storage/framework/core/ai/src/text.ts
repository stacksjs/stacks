import { client, InvokeModelCommand } from './utils/client-bedrock-runtime'

interface AiOptions {
  maxTokenCount?: number
  temperature?: number
  topP?: number
}

export interface SummarizeOptions extends AiOptions {}
export interface AskOptions extends AiOptions {}

export async function summarize(text: string, options: SummarizeOptions = {}): Promise<string> {
  const { maxTokenCount = 512, temperature = 0, topP = 0.9 } = options

  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-text-express-v1',
    contentType: 'application/json',
    accept: '*/*',
    body: JSON.stringify({
      inputText: `Summarize the following text: ${text}`,
      textGenerationConfig: {
        maxTokenCount,
        stopSequences: [],
        temperature,
        topP,
      },
    }),
  })

  try {
    const response = await client.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))
    return responseBody.results[0].outputText
  }
  catch (error) {
    console.error('Error summarizing text:', error)
    throw error
  }
}

export async function ask(question: string, options: AskOptions = {}): Promise<string> {
  const { maxTokenCount = 512, temperature = 0, topP = 0.9 } = options

  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-text-express-v1',
    contentType: 'application/json',
    accept: '*/*',
    body: JSON.stringify({
      inputText: question,
      textGenerationConfig: {
        maxTokenCount,
        stopSequences: [],
        temperature,
        topP,
      },
    }),
  })

  try {
    const response = await client.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    return responseBody.results[0].outputText
  }
  catch (error) {
    console.error('Error asking question:', error)
    throw error
  }
}
