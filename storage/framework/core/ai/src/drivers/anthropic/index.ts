/**
 * Anthropic Claude API Driver
 *
 * Direct API integration with Anthropic's Claude models.
 * Supports chat completions and streaming.
 */

import type { AIDriver, AIDriverConfig, AIMessage, AIResult, AIStreamEvent, AIToolCall, ChatCompletionOptions, ClaudeAPIResponse, ClaudeStreamEvent } from '../../types'
import { fetchWithRetry } from '../../utils/retry'
import { sseJson, streamText } from '../../utils/stream'
import { parseToolArguments } from '../../utils/tools'
import { recordUsage } from '../../utils/usage'
import { normalizeMessagesForProvider } from '../../utils/vision'
import { DEFAULT_ANTHROPIC_MODEL } from '../../models'

export interface AnthropicDriverConfig extends AIDriverConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  anthropicVersion?: string
}

const DEFAULT_MODEL = DEFAULT_ANTHROPIC_MODEL
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
          event = JSON.parse(data)
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
 * The Messages API request for a chat completion, streamed or not, and the
 * name of the internal structured-output tool when `responseFormat` asks for
 * one. Shared so a stream offers the model exactly what `chat()` would: the
 * stream used to send no tools at all, so it could never see a tool call.
 */
function messagesRequest(
  messages: AIMessage[],
  options: ChatCompletionOptions & { system?: string },
): { body: Record<string, unknown>, outputTool?: string } {
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

  // Normalize content arrays into Anthropic's wire format
  // (stacksjs/stacks#1878 A-3). Apps that authored their messages
  // with OpenAI-style `image_url` blocks (or use cross-driver
  // helpers) get the right shape on the wire.
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    stop_sequences: stop ? (Array.isArray(stop) ? stop : [stop]) : undefined,
    system,
    messages: normalizeMessagesForProvider(messages, 'anthropic'),
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

  // responseFormat → tools-as-json shape (Claude has no first-class JSON
  // mode; the idiom is a tool whose input is the JSON, which the model is
  // made to call). If callers provide both explicit tools AND
  // responseFormat, the structured-output tool is appended and forced via
  // tool_choice. Caller's explicit tool_choice wins.
  if (responseFormat && responseFormat.type !== 'text') {
    const outputTool = buildAnthropicJsonTool(responseFormat)
    const existing = Array.isArray(body.tools) ? body.tools as unknown[] : []
    body.tools = [...existing, outputTool]
    if (toolChoice === undefined) {
      body.tool_choice = { type: 'tool', name: outputTool.name }
    }
    return { body, outputTool: outputTool.name }
  }

  return { body }
}

function postMessages(body: Record<string, unknown>): Promise<Response> {
  const config = getConfig()
  return fetchWithRetry(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': config.anthropicVersion || DEFAULT_VERSION,
    },
    body: JSON.stringify(body),
  })
}

/**
 * Chat completion with full options. Supports tools + structured
 * output via `responseFormat` (stacksjs/stacks#1878 A-1).
 */
export async function chat(
  messages: AIMessage[],
  options: ChatCompletionOptions & { system?: string } = {},
): Promise<AIResult> {
  // Track wall-clock duration for usage reporters (#1878 A-6).
  const startedAt = Date.now()
  const { body, outputTool } = messagesRequest(messages, options)
  const response = await postMessages(body)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const data = (await response.json())

  if (!data.content || data.content.length === 0) {
    throw new Error('Claude API returned empty content')
  }

  // The structured-output tool is internal: its input is the answer, so it
  // becomes `content`. Every other tool_use block is a call the application
  // has to run, reported in `toolCalls` - this used to stringify the first
  // tool_use's input into `content`, dropping its name and id and any other
  // call, so a tool could not be answered.
  const blocks = data.content as Array<{ type: string, text?: string, id?: string, name?: string, input?: Record<string, unknown> }>
  const structured = outputTool ? blocks.find(b => b.type === 'tool_use' && b.name === outputTool) : undefined
  const toolCalls: AIToolCall[] = blocks
    .filter(b => b.type === 'tool_use' && b !== structured)
    .map(b => ({ id: b.id ?? '', name: b.name ?? '', arguments: b.input ?? {} }))
  const content = structured
    ? JSON.stringify(structured.input)
    : blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('')

  const result: AIResult = {
    content,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
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
  // `none` forbids a call. This mapped to `auto`, which still allowed one.
  if (choice === 'none') return { type: 'none' }
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

/** The Messages API's streamed events, as far as a chat completion reads them. */
type MessagesStreamEvent =
  | { type: 'message_start', message: { model: string, usage?: { input_tokens?: number, output_tokens?: number } } }
  | { type: 'content_block_start', index: number, content_block: { type: string, id?: string, name?: string } }
  | { type: 'content_block_delta', index: number, delta: { type: 'text_delta', text: string } | { type: 'input_json_delta', partial_json: string } | { type: string } }
  | { type: 'content_block_stop', index: number }
  | { type: 'message_delta', delta: { stop_reason?: string }, usage?: { output_tokens?: number } }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error', error: { type: string, message: string } }

/**
 * A streamed chat completion, as events: text as it is written, each tool
 * call once its arguments have streamed, then the whole result.
 *
 * A `tool_use` block streams its input as `input_json_delta` fragments, so a
 * call is reported at its `content_block_stop`, whole. The structured-output
 * tool is internal, as in `chat()`: its JSON streams as text. An `error`
 * event (an overload mid-stream) throws rather than ending the stream as if
 * the model had finished.
 */
export async function* streamChatEvents(
  messages: AIMessage[],
  options: ChatCompletionOptions & { system?: string } = {},
): AsyncGenerator<AIStreamEvent> {
  const startedAt = Date.now()
  const { body, outputTool } = messagesRequest(messages, options)
  const response = await postMessages({ ...body, stream: true })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }
  if (!response.body) throw new Error('No response body')

  const toolBlocks = new Map<number, { id: string, name: string, json: string, structured: boolean }>()
  const toolCalls: AIToolCall[] = []
  let content = ''
  let model = String(body.model)
  let promptTokens = 0
  let completionTokens = 0
  let finishReason: string | undefined

  for await (const event of sseJson(response.body, 'Claude API') as AsyncGenerator<MessagesStreamEvent>) {
    switch (event.type) {
      case 'message_start':
        model = event.message.model || model
        promptTokens = event.message.usage?.input_tokens ?? 0
        completionTokens = event.message.usage?.output_tokens ?? 0
        break
      case 'content_block_start':
        if (event.content_block.type === 'tool_use') {
          const name = event.content_block.name ?? ''
          toolBlocks.set(event.index, { id: event.content_block.id ?? '', name, json: '', structured: name === outputTool })
        }
        break
      case 'content_block_delta': {
        const delta = event.delta
        if ('text' in delta && delta.type === 'text_delta') {
          content += delta.text
          yield { type: 'text', text: delta.text }
        }
        else if ('partial_json' in delta && delta.type === 'input_json_delta') {
          const block = toolBlocks.get(event.index)
          if (!block)
            break
          block.json += delta.partial_json
          if (block.structured && delta.partial_json) {
            content += delta.partial_json
            yield { type: 'text', text: delta.partial_json }
          }
        }
        break
      }
      case 'content_block_stop': {
        const block = toolBlocks.get(event.index)
        if (block && !block.structured) {
          const call: AIToolCall = { id: block.id, name: block.name, arguments: parseToolArguments(block.json, block.name) }
          toolCalls.push(call)
          yield { type: 'tool_call', call }
        }
        break
      }
      case 'message_delta':
        finishReason = event.delta.stop_reason ?? finishReason
        completionTokens = event.usage?.output_tokens ?? completionTokens
        break
      case 'error':
        throw new Error(`Claude API error: ${event.error.type}: ${event.error.message}`)
    }
  }

  const result: AIResult = {
    content,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    model,
    usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
    ...(finishReason ? { finishReason } : {}),
  }

  recordUsage({
    provider: 'anthropic',
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    durationMs: Date.now() - startedAt,
    timestamp: Date.now(),
  })

  yield { type: 'done', result }
}

/**
 * Stream chat completion: the text as it is written. Tool calls, usage and
 * the stop reason are in the result the generator returns; iterate
 * {@link streamChatEvents} to act on a tool call as soon as it arrives.
 */
export function streamChat(
  messages: AIMessage[],
  options: ChatCompletionOptions & { system?: string } = {},
): AsyncGenerator<string, AIResult, undefined> {
  return streamText(streamChatEvents(messages, options))
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
  streamChatEvents,
  prompt,
  estimateTokens,
  createDriver: createAnthropicDriver,
}

export default anthropic
