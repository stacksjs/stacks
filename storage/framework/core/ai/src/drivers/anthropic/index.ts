/**
 * Anthropic Claude API Driver
 *
 * Direct API integration with Anthropic's Claude models.
 * Supports chat completions and streaming.
 */

import type { AIDriver, AIDriverConfig, AIMessage, AIResult, ChatCompletionOptions, ClaudeAPIResponse, ClaudeStreamEvent } from '../../types'
import { fetchWithRetry } from '../../utils/retry'
import { recordUsage } from '../../utils/usage'
import { normalizeMessagesForProvider } from '../../utils/vision'

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

      // Retry-aware fetch (stacksjs/stacks#1878 A-5). Honors 429
      // Retry-After + exponential backoff on 5xx (overloaded
      // capacity is the common Anthropic blocker).
      const response = await fetchWithRetry(`${BASE_URL}/messages`, {
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
      if (!data.content || data.content.length === 0) {
        throw new Error('Claude API returned empty content')
      }
      return data.content[0]!.text
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

      // Mid-stream error visibility (stacksjs/stacks#1878 A-2).
      // Anthropic surfaces stream errors as `event: error` /
      // `data: { type: 'error', error: { type, message } }`.
      // The pre-fix code dropped these silently — the consumer
      // saw a truncated response and assumed success. Now: throw
      // so the caller knows the stream was cut short.
      const handlePayload = function* (data: string) {
        if (data === '[DONE]') return
        let event: ClaudeStreamEvent & { type: string, error?: { type?: string, message?: string } }
        try {
          event = JSON.parse(data) as any
        }
        catch {
          return
        }
        if (event.type === 'error') {
          const msg = event.error?.message ?? JSON.stringify(event.error ?? event)
          throw new Error(`[anthropic/stream] mid-stream error: ${msg}`)
        }
        if (event.type === 'content_block_delta' && event.delta?.text) {
          yield event.delta.text
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            yield * handlePayload(line.slice(6))
          }
        }
      }

      // Process any remaining data in the buffer
      if (buffer.startsWith('data: ')) {
        yield * handlePayload(buffer.slice(6))
      }
    },
  }
}

/**
 * Chat completion with full options. Supports tools + structured
 * output via `responseFormat` (stacksjs/stacks#1878 A-1).
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
    tools,
    toolChoice,
    responseFormat,
  } = options

  // Build the request body. Tools and tool_choice map directly to
  // Claude's Messages API. responseFormat is mapped to the
  // tools-as-json pattern (Claude 3.5+ doesn't have a first-class
  // JSON-mode parameter; the standard idiom is "define a tool whose
  // input is the JSON shape and force the model to call it").
  // Normalize content arrays into Anthropic's wire format
  // (stacksjs/stacks#1878 A-3). Apps that authored their messages
  // with OpenAI-style `image_url` blocks (or use cross-driver
  // helpers) get the right shape on the wire.
  const normalizedMessages = normalizeMessagesForProvider(messages, 'anthropic')

  // Track wall-clock duration for usage reporters (#1878 A-6).
  const startedAt = Date.now()

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    stop_sequences: stop ? (Array.isArray(stop) ? stop : [stop]) : undefined,
    system,
    messages: normalizedMessages,
  }

  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters ?? { type: 'object', properties: {} },
    }))
    if (toolChoice !== undefined)
      body.tool_choice = mapAnthropicToolChoice(toolChoice)
  }

  // responseFormat → tools-as-json shape. If callers provide both
  // explicit tools AND responseFormat, the structured-output tool
  // is appended and forced via tool_choice. Caller's explicit
  // tool_choice wins.
  if (responseFormat && responseFormat.type !== 'text') {
    const outputTool = buildAnthropicJsonTool(responseFormat)
    const existing = Array.isArray(body.tools) ? body.tools as unknown[] : []
    body.tools = [...existing, outputTool]
    if (toolChoice === undefined) {
      body.tool_choice = { type: 'tool', name: outputTool.name }
    }
  }

  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': config.anthropicVersion || DEFAULT_VERSION,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const data = (await response.json()) as any

  if (!data.content || data.content.length === 0) {
    throw new Error('Claude API returned empty content')
  }

  // Extract the content. For tool-use-as-json, the response is a
  // tool_use block whose `input` field holds the structured object;
  // we JSON.stringify it for the `content` string field so callers
  // can JSON.parse back out. For freeform, the first text block.
  const block = data.content.find((b: { type: string }) => b.type === 'tool_use')
    ?? data.content.find((b: { type: string }) => b.type === 'text')
    ?? data.content[0]
  const content = block?.type === 'tool_use'
    ? JSON.stringify(block.input)
    : (block?.text ?? '')

  const result: AIResult = {
    content,
    model: data.model,
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    finishReason: data.stop_reason,
  }

  // Fire registered usage reporters (#1878 A-6).
  recordUsage({
    provider: 'anthropic',
    model: data.model,
    promptTokens: result.usage!.promptTokens,
    completionTokens: result.usage!.completionTokens,
    totalTokens: result.usage!.totalTokens,
    durationMs: Date.now() - startedAt,
    timestamp: Date.now(),
  })

  return result
}

/**
 * Map the cross-driver `toolChoice` shape to Anthropic's
 * Messages-API representation.
 */
function mapAnthropicToolChoice(choice: NonNullable<ChatCompletionOptions['toolChoice']>): Record<string, unknown> {
  if (choice === 'auto') return { type: 'auto' }
  if (choice === 'required') return { type: 'any' }
  if (choice === 'none') return { type: 'auto', disable_parallel_tool_use: true }
  return { type: 'tool', name: choice.name }
}

/**
 * Build a synthetic tool that captures the requested JSON shape,
 * used to coerce structured output via the tool-use idiom.
 */
function buildAnthropicJsonTool(format: NonNullable<ChatCompletionOptions['responseFormat']>): { name: string, description: string, input_schema: Record<string, unknown> } {
  if (format.type === 'json_schema') {
    return {
      name: format.json_schema.name,
      description: `Returns the result as JSON matching the '${format.json_schema.name}' schema.`,
      input_schema: format.json_schema.schema,
    }
  }
  // json_object — no schema, just "object with any keys"
  return {
    name: 'structured_output',
    description: 'Returns the result as a JSON object.',
    input_schema: { type: 'object', additionalProperties: true },
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
      messages: normalizeMessagesForProvider(messages, 'anthropic'),
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
