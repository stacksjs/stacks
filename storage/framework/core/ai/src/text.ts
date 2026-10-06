import type { AIResult } from './types'
import { ai } from '@stacksjs/config'
import { chat, configure } from './drivers/bedrock'

interface AiOptions {
  maxTokenCount?: number
  temperature?: number
  topP?: number
  /**
   * Override the Bedrock model for this call. Defaults to
   * `ai.drivers.bedrock.model` in config/ai.ts, then `BEDROCK_MODEL_ID`, then
   * `amazon.nova-lite-v1:0`. Any text model Bedrock serves works, since the
   * request goes through the Converse API.
   */
  modelId?: string
}

export interface SummarizeOptions extends AiOptions {}
export interface AskOptions extends AiOptions {}

/**
 * Both helpers used to hand-build Amazon Titan's request body and default to
 * `amazon.titan-text-express-v1`, which Bedrock has retired ("This model
 * version has reached the end of its life"), so neither returned anything.
 * They also read the model override from a `globalThis.config` only tinker
 * sets. They go through the Bedrock driver now, configured from config/ai.ts.
 */
async function complete(prompt: string, options: AiOptions, failure: string): Promise<string> {
  const { maxTokenCount = 512, temperature = 0, topP = 0.9, modelId } = options
  const driver = ai.drivers?.bedrock
  configure({ model: driver?.model, region: driver?.region })

  let result: AIResult
  try {
    result = await chat([{ role: 'user', content: prompt }], {
      model: modelId,
      maxTokens: maxTokenCount,
      temperature,
      topP,
    })
  }
  catch (error) {
    throw new Error(`${failure}: ${(error as Error).message}`)
  }
  return result.content
}

export function summarize(text: string, options: SummarizeOptions = {}): Promise<string> {
  return complete(`Summarize the following text: ${text}`, options, 'Error summarizing text')
}

export function ask(question: string, options: AskOptions = {}): Promise<string> {
  return complete(question, options, 'Error asking question')
}
