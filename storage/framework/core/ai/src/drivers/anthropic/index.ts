/**
 * Anthropic Claude API Driver
 *
 * Direct API integration with Anthropic's Claude models.
 * Supports chat completions and streaming.
 */

import type { AIDriver, AIDriverConfig, AIMessage, AIResult, ChatCompletionOptions, ClaudeAPIResponse, ClaudeStreamEvent } from '../../types'

export interface AnthropicDriverConfig extends AIDriverConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  anthropicVersion?: string
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_VERSION = '2023-06-01'
const BASE_URL = 'https://api.anthropic.com/v1'

let globalConfig: AnthropicDriverConfig | null = null

/**
 * Configure Anthropic globally
 */
export function configure(config: AnthropicDriverConfig): void {
  globalConfig = config
}

function getConfig(config?: Partial<AnthropicDriverConfig>): AnthropicDriverConfig {
  const merged = { ...globalConfig, ...config }
  if (!merged.apiKey) {
    merged.apiKey = process.env.ANTHROPIC_API_KEY || ''
  }
  return merged as AnthropicDriverConfig
}

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

      const response = await fetch(`${BASE_URL}/messages`, {
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

    async *stream(command: string, systemPrompt: string, history: AIMessage[]): AsyncGenerator<string> {
      if (!apiKey) {
        throw new Error('Anthropic API key not set. Configure your API key in settings.')
      }

      const response = await fetch(`${BASE_URL}/messages`, {
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
          stream: true,
          messages: [...history, { role: 'user', content: command }],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude API error: ${error}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data) as ClaudeStreamEvent
              if (event.type === 'content_block_delta' && event.delta?.text) {
                yield event.delta.text
              }
            }
            catch {
              // Skip invalid JSON
            }
          }
        }
      }
    },
  }
}

/**
 * Chat completion with full options
 */
export async function chat(
  messages: AIMessage[],
  options: ChatCompletionOptions & { system?: string } = {},
): Promise<AIResult> {
  const config = getConfig()
  const {
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature,
    topP,
    stop,
    system,
  } = options

  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': config.anthropicVersion || DEFAULT_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stop_sequences: stop ? (Array.isArray(stop) ? stop : [stop]) : undefined,
      system,
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const data = (await response.json()) as any

  return {
    content: data.content[0].text,
    model: data.model,
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    finishReason: data.stop_reason,
  }
}

/**
 * Stream chat completion
 */
export async function* streamChat(
  messages: AIMessage[],
  options: ChatCompletionOptions & { system?: string } = {},
): AsyncGenerator<string> {
  const config = getConfig()
  const {
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature,
    topP,
    stop,
    system,
  } = options

  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': config.anthropicVersion || DEFAULT_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stop_sequences: stop ? (Array.isArray(stop) ? stop : [stop]) : undefined,
      system,
      stream: true,
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data) as ClaudeStreamEvent
          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield event.delta.text
          }
        }
        catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

/**
 * Simple prompt helper
 */
export async function prompt(
  text: string,
  options: ChatCompletionOptions & { system?: string } = {},
): Promise<string> {
  const result = await chat([{ role: 'user', content: text }], options)
  return result.content
}

/**
 * Count tokens (approximate)
 * Note: This is a rough estimate. For accurate counts, use the tokenizer.
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4)
}

export const anthropicDriver: { create: typeof createAnthropicDriver } = {
  create: createAnthropicDriver,
}

export const anthropic = {
  configure,
  chat,
  streamChat,
  prompt,
  estimateTokens,
  createDriver: createAnthropicDriver,
}

export default anthropic
