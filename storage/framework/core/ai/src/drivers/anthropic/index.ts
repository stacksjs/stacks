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
 * The `anthropic-version` header a request to Anthropic sends.
 *
 * Every Anthropic request in this package has to agree on this, and five of
 * them did not: `search.ts`, `image.ts` (twice), `buddy.ts` and
 * `personalization.ts` each wrote the date inline and none of them had heard of
 * `anthropicVersion`. So an application that configured a version got it on
 * chat and streaming, through this driver, and was silently ignored on RAG,
 * vision, buddy and personalization. One API answering two versions, with one
 * of them unconfigurable, is the same shape as the Facebook and Instagram
 * drivers disagreeing by three years (stacksjs/stacks#2859).
 *
 * `override` is for a caller that has its own config in hand; with none, an
 * application's `configure({ anthropicVersion })` wins, and the default is last.
 */
export function anthropicApiVersion(override?: string): string {
  return override || globalConfig?.anthropicVersion || DEFAULT_VERSION
}

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

      if (!response.body) throw new Error('No response body')

      // Mid-stream error visibility (stacksjs/stacks#1878 A-2): Anthropic
      // reports a stream failure as `{ type: 'error', error }`, which used to
      // end the stream silently as a truncated success. A payload that is not
      // JSON throws in `sseJson` rather than dropping what it carried.
      for await (const event of sseJson(response.body, 'Claude API') as AsyncGenerator<ClaudeStreamEvent & { error?: { type?: string, message?: string } }>) {
        if (event.type === 'error') {
          const msg = event.error?.message ?? JSON.stringify(event.error ?? event)
          throw new Error(`[anthropic/stream] mid-stream error: ${msg}`)
        }
        if (event.type === 'content_block_delta' && event.delta?.text)
          yield event.delta.text
      }
    },
  }
}

/**
 * The Messages API request for a chat completion, streamed or not. Shared so
 * a stream offers the model exactly what `chat()` would: the stream used to
 * send no tools at all, so it could never see a tool call.
 */
function messagesRequest(
  messages: AIMessage[],
  options: ChatCompletionOptions & { system?: string },
): Record<string, unknown> {
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
  //
  // `temperature` and `top_p` go out only when the caller set them:
  // undefined is dropped by JSON.stringify. Current models refuse
  // non-default sampling values, so the framework never sets one itself.
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    stop_sequences: stop ? (Array.isArray(stop) ? stop : [stop]) : undefined,
    system: responseFormat?.type === 'json_object' ? withJsonObjectInstruction(system) : system,
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

  // Structured output is the Messages API's own JSON mode, and the answer
  // comes back as text. It used to be a synthetic tool the model was forced
  // to call, and current models (Opus 5.5, Sonnet 5.5) refuse a forced tool
  // choice with a 400, so every request asking for JSON failed
  // (stacksjs/stacks#3380).
  if (responseFormat?.type === 'json_schema')
    body.output_config = { format: { type: 'json_schema', schema: anthropicJsonSchema(responseFormat.json_schema.schema) } }

  return body
}

function postMessages(body: Record<string, unknown>, options: Pick<ChatCompletionOptions, 'signal' | 'maxRetries'> = {}): Promise<Response> {
  const config = getConfig()
  return fetchWithRetry(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': anthropicApiVersion(config.anthropicVersion),
    },
    body: JSON.stringify(body),
    ...(options.signal ? { signal: options.signal } : {}),
  }, options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries })
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
  const body = messagesRequest(messages, options)
  const response = await postMessages(body, options)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const data = (await response.json())

  if (!data.content || data.content.length === 0) {
    throw new Error('Claude API returned empty content')
  }

  // Every tool_use block is a call the application has to run, reported in
  // `toolCalls` with its name and id. Structured output arrives as text.
  const blocks = data.content as Array<{ type: string, text?: string, id?: string, name?: string, input?: Record<string, unknown> }>
  const toolCalls: AIToolCall[] = blocks
    .filter(b => b.type === 'tool_use')
    .map(b => ({ id: b.id ?? '', name: b.name ?? '', arguments: b.input ?? {} }))
  const content = blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('')

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
    ...(options.usageMetadata ? { metadata: options.usageMetadata } : {}),
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

/** What `json_object` adds to the system prompt: the API has no schema-free JSON mode. */
const JSON_OBJECT_INSTRUCTION = 'Reply with a single JSON object and nothing else: no prose and no code fence.'

function withJsonObjectInstruction(system?: string): string {
  return system ? `${system}\n\n${JSON_OBJECT_INSTRUCTION}` : JSON_OBJECT_INSTRUCTION
}

/** Keywords the Messages API's JSON mode does not accept. */
const UNSUPPORTED_SCHEMA_KEYWORDS = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength'])

/**
 * A JSON Schema in the form `output_config.format` accepts: every object
 * closed with `additionalProperties: false` unless it says otherwise, and the
 * numeric and length constraints the API does not support left out. The
 * caller's schema is not changed. `generateObject()` still validates the
 * answer against the full schema, constraints included.
 */
export function anthropicJsonSchema(schema: unknown): Record<string, unknown> {
  return closeSchema(schema) as Record<string, unknown>
}

function closeSchema(node: unknown): unknown {
  if (Array.isArray(node))
    return node.map(closeSchema)
  if (!node || typeof node !== 'object')
    return node

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (UNSUPPORTED_SCHEMA_KEYWORDS.has(key))
      continue
    if (key === 'properties' || key === '$defs' || key === 'definitions')
      out[key] = Object.fromEntries(Object.entries((value ?? {}) as Record<string, unknown>).map(([name, sub]) => [name, closeSchema(sub)]))
    else if (key === 'items' || key === 'anyOf' || key === 'allOf' || key === 'oneOf' || key === 'not')
      out[key] = closeSchema(value)
    else
      out[key] = value
  }

  const isObject = out.type === 'object' || (Array.isArray(out.type) && out.type.includes('object')) || 'properties' in out
  if (isObject && !('additionalProperties' in out))
    out.additionalProperties = false
  return out
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
 * call is reported at its `content_block_stop`, whole. Structured output is
 * text, so its JSON streams as text. An `error`
 * event (an overload mid-stream) throws rather than ending the stream as if
 * the model had finished.
 */
export async function* streamChatEvents(
  messages: AIMessage[],
  options: ChatCompletionOptions & { system?: string } = {},
): AsyncGenerator<AIStreamEvent> {
  const startedAt = Date.now()
  const body = messagesRequest(messages, options)
  const response = await postMessages({ ...body, stream: true }, options)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }
  if (!response.body) throw new Error('No response body')

  const toolBlocks = new Map<number, { id: string, name: string, json: string }>()
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
          toolBlocks.set(event.index, { id: event.content_block.id ?? '', name: event.content_block.name ?? '', json: '' })
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
        }
        break
      }
      case 'content_block_stop': {
        const block = toolBlocks.get(event.index)
        if (block) {
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
    ...(options.usageMetadata ? { metadata: options.usageMetadata } : {}),
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
