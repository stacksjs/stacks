import { invokeModel } from './utils/client-bedrock-runtime'

interface AiOptions {
  maxTokenCount?: number
  temperature?: number
  topP?: number
  /**
   * Override the Bedrock model. Defaults to `config.ai?.bedrock?.model` →
   * `BEDROCK_MODEL_ID` env → `amazon.titan-text-express-v1` (the prior
   * hard-coded default). Letting callers swap models per-call lets ops
   * pin a different model in production than in dev without code changes.
   */
  modelId?: string
}

export interface SummarizeOptions extends AiOptions {}
export interface AskOptions extends AiOptions {}

const DEFAULT_MODEL = 'amazon.titan-text-express-v1'

function resolveModel(override?: string): string {
  if (override) return override
  const cfg = (globalThis as { config?: any }).config?.ai?.bedrock?.model
  return cfg || process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL
}

export async function summarize(text: string, options: SummarizeOptions = {}): Promise<string> {
  const { maxTokenCount = 512, temperature = 0, topP = 0.9, modelId } = options

  try {
    const response = await invokeModel({
      modelId: resolveModel(modelId),
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

    const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as any
    return responseBody.results[0].outputText
  }
  catch (error) {
    throw new Error(`Error summarizing text: ${(error as Error).message}`)
  }
}

export async function ask(question: string, options: AskOptions = {}): Promise<string> {
  const { maxTokenCount = 512, temperature = 0, topP = 0.9, modelId } = options

  try {
    const response = await invokeModel({
      modelId: resolveModel(modelId),
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

    const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as any
    return responseBody.results[0].outputText
  }
  catch (error) {
    throw new Error(`Error asking question: ${(error as Error).message}`)
  }
}
