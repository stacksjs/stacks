/**
 * OpenAI API Driver
 *
 * Direct API integration with OpenAI's GPT models.
 */

import type { AIDriver, AIDriverConfig, AIMessage, OpenAIAPIResponse } from '../../types'

export interface OpenAIDriverConfig extends AIDriverConfig {
  apiKey: string
  model?: string
  maxTokens?: number
}

const DEFAULT_MODEL = 'gpt-4o'
const DEFAULT_MAX_TOKENS = 4096

export function createOpenAIDriver(config: OpenAIDriverConfig): AIDriver {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = config

  return {
    name: 'OpenAI',

    async process(command: string, systemPrompt: string, history: AIMessage[]): Promise<string> {
      if (!apiKey) {
        throw new Error('OpenAI API key not set. Configure your API key in settings.')
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: command },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${error}`)
      }

      const data = (await response.json()) as OpenAIAPIResponse
      return data.choices[0].message.content
    },
  }
}

export const openaiDriver: { create: typeof createOpenAIDriver } = {
  create: createOpenAIDriver,
}
