/**
 * Anthropic Claude API Driver
 *
 * Direct API integration with Anthropic's Claude models.
 */

import type { AIDriver, AIDriverConfig, AIMessage, ClaudeAPIResponse } from '../../types'

export interface AnthropicDriverConfig extends AIDriverConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  anthropicVersion?: string
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_VERSION = '2023-06-01'

export function createAnthropicDriver(config: AnthropicDriverConfig): AIDriver {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    anthropicVersion = DEFAULT_VERSION,
  } = config

  return {
    name: 'Claude API',

    async process(command: string, systemPrompt: string, history: AIMessage[]): Promise<string> {
      if (!apiKey) {
        throw new Error('Anthropic API key not set. Configure your API key in settings.')
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': anthropicVersion,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [...history, { role: 'user', content: command }],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude API error: ${error}`)
      }

      const data = (await response.json()) as ClaudeAPIResponse
      return data.content[0].text
    },
  }
}

export const anthropicDriver = {
  create: createAnthropicDriver,
}
