/**
 * OpenAI API Driver
 *
 * Direct API integration with OpenAI's GPT models.
 * Supports chat completions, streaming, and embeddings.
 */

import type { AIDriver, AIDriverConfig, AIMessage, AIResult, AIStreamEvent, AIToolCall, ChatCompletionOptions, EmbeddingsResponse, OpenAIAPIResponse } from '../../types'
import { fetchWithRetry } from '../../utils/retry'
import { sseJson, streamText } from '../../utils/stream'
import { parseToolArguments, toChatCompletionMessages } from '../../utils/tools'
import { recordUsage } from '../../utils/usage'

export interface OpenAIDriverConfig extends AIDriverConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  embeddingModel?: string
  baseUrl?: string
}

const DEFAULT_MODEL = 'gpt-4o'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

let globalConfig: OpenAIDriverConfig | null = null

/**
 * Configure OpenAI globally
 */
export function configure(config: OpenAIDriverConfig): void {
  globalConfig = config
}

function getConfig(config?: Partial<OpenAIDriverConfig>): OpenAIDriverConfig {
  const merged = { ...globalConfig, ...config }
  if (!merged.apiKey) {
    merged.apiKey = process.env.OPENAI_API_KEY || ''
  }
  return merged as OpenAIDriverConfig
}

export function createOpenAIDriver(config: OpenAIDriverConfig): AIDriver {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    baseUrl = DEFAULT_BASE_URL,
    embeddingModel = DEFAULT_EMBEDDING_MODEL,
  } = config

  return {
    name: 'OpenAI',

    async process(command: string, systemPrompt: string, history: AIMessage[]): Promise<string> {
      if (!apiKey) {
        throw new Error('OpenAI API key not set. Configure your API key in settings.')
      }

      // Retry-aware fetch (stacksjs/stacks#1878 A-5). Honors 429
      // `Retry-After` and backs off on 5xx; throws to the caller
      // only after retries are exhausted or for non-retryable 4xx.
      const response = await fetchWithRetry(`${baseUrl}/chat/completions`, {
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
      if (!data.choices || data.choices.length === 0) {
        throw new Error('OpenAI API returned empty choices')
      }
      return data.choices[0]!.message.content
    },

    async *stream(command: string, systemPrompt: string, history: AIMessage[]): AsyncGenerator<string> {
      if (!apiKey) {
        throw new Error('OpenAI API key not set. Configure your API key in settings.')
      }

      const response = await fetchWithRetry(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          stream: true,
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

      if (!response.body) throw new Error('No response body')

      // OpenAI reports a mid-stream failure as `{ error: { message, type } }`,
      // which the `choices[0].delta` lookup used to read past as a clean end
      // of stream (stacksjs/stacks#1878 A-2). A payload that is not JSON
      // throws in `sseJson` rather than dropping what it carried.
      for await (const parsed of sseJson(response.body, 'OpenAI API')) {
        if (parsed?.error) {
          const msg = parsed.error.message || JSON.stringify(parsed.error)
          throw new Error(`[openai/stream] mid-stream error: ${msg}`)
        }
        const content = parsed.choices?.[0]?.delta?.content
        if (content) yield content
      }
    },

    async embed(input: string | string[]): Promise<number[] | number[][]> {
      if (!apiKey) {
        throw new Error('OpenAI API key not set. Configure your API key in settings.')
      }

      const response = await fetchWithRetry(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: embeddingModel,
          input,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI Embeddings API error: ${error}`)
      }

      const data = (await response.json()) as EmbeddingsResponse

      if (Array.isArray(input)) {
        return data.data.map(d => d.embedding)
      }
      return data.data[0]!.embedding
    },
  }
}

/**
 * The Chat Completions request for a chat completion, streamed or not. Shared
 * so a stream offers the model exactly what `chat()` would: the stream used
 * to send no tools, so it could never see a tool call.
 */
function completionRequest(messages: AIMessage[], options: ChatCompletionOptions): Record<string, unknown> {
  const {
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature,
    topP,
    stop,
    tools,
    toolChoice,
    responseFormat,
  } = options

  // Normalize content arrays into OpenAI's wire format
  // (stacksjs/stacks#1878 A-3). Apps that authored messages with
  // Anthropic-style `{ type: 'image', source: {...} }` blocks
  // (or use cross-driver helpers) get the right shape.
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    stop,
    messages: toChatCompletionMessages(messages, { argumentsAsString: true }),
  }

  if (tools?.length) {
    body.tools = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters ?? { type: 'object', properties: {} },
      },
    }))
  }

  if (toolChoice !== undefined) {
    body.tool_choice = typeof toolChoice === 'object'
      ? { type: 'function', function: { name: toolChoice.name } }
      : toolChoice
  }

  if (responseFormat && responseFormat.type !== 'text')
    body.response_format = responseFormat

  return body
}

function postCompletion(body: Record<string, unknown>): Promise<Response> {
  const config = getConfig()
  return fetchWithRetry(`${config.baseUrl || DEFAULT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })
}

/**
 * Chat completion with full options
 */
export async function chat(
  messages: AIMessage[],
  options: ChatCompletionOptions = {},
): Promise<AIResult> {
  // Track wall-clock duration for usage reporters (#1878 A-6).
  const startedAt = Date.now()
  const response = await postCompletion(completionRequest(messages, options))

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = (await response.json())

  if (!data.choices || data.choices.length === 0) {
    throw new Error('OpenAI API returned empty choices')
  }

  // With a tool call, OpenAI sends `content: null` and the calls in
  // `tool_calls`. This returned the null as `content` and dropped the calls.
  const message = data.choices[0].message as {
    content: string | null
    tool_calls?: Array<{ id: string, function: { name: string, arguments: string } }>
  }
  const toolCalls: AIToolCall[] = (message.tool_calls ?? []).map(call => ({
    id: call.id,
    name: call.function.name,
    arguments: parseToolArguments(call.function.arguments, call.function.name),
  }))

  const result: AIResult = {
    content: message.content ?? '',
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    model: data.model,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    finishReason: data.choices[0].finish_reason,
  }

  // Fire registered usage reporters (#1878 A-6). Apps install via
  // `onUsage(reporter)`; default is no-op. Errors are swallowed.
  recordUsage({
    provider: 'openai',
    model: data.model,
    promptTokens: result.usage!.promptTokens,
    completionTokens: result.usage!.completionTokens,
    totalTokens: result.usage!.totalTokens,
    durationMs: Date.now() - startedAt,
    timestamp: Date.now(),
  })

  return result
}

/** A Chat Completions stream chunk, as far as a chat completion reads it. */
interface CompletionChunk {
  model?: string
  choices?: Array<{
    delta?: {
      content?: string | null
      tool_calls?: Array<{ index: number, id?: string, function?: { name?: string, arguments?: string } }>
    }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number } | null
  error?: { message?: string, type?: string }
}

/**
 * A streamed chat completion, as events: text as it is written, each tool
 * call once its arguments have streamed, then the whole result.
 *
 * A tool call streams as `delta.tool_calls` pieces keyed by `index`: the id
 * and name first, then the arguments a fragment at a time. The calls are
 * complete when the choice finishes, and are reported then, in index order.
 * Usage only comes with `stream_options.include_usage`, on a last chunk with
 * no choices, so it is asked for. An `error` chunk throws.
 */
export async function* streamChatEvents(
  messages: AIMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<AIStreamEvent> {
  const startedAt = Date.now()
  const body = completionRequest(messages, options)
  const response = await postCompletion({ ...body, stream: true, stream_options: { include_usage: true } })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }
  if (!response.body) throw new Error('No response body')

  const pending = new Map<number, { id: string, name: string, args: string }>()
  const toolCalls: AIToolCall[] = []
  let content = ''
  let model = String(body.model)
  let usage: AIResult['usage']
  let finishReason: string | undefined

  // Reported when the choice finishes, or when the stream ends without
  // saying so, which an OpenAI-compatible server is free to do.
  function* flushCalls(): Generator<AIStreamEvent> {
    for (const index of [...pending.keys()].sort((a, b) => a - b)) {
      const piece = pending.get(index)!
      const call: AIToolCall = { id: piece.id, name: piece.name, arguments: parseToolArguments(piece.args, piece.name) }
      toolCalls.push(call)
      yield { type: 'tool_call', call }
    }
    pending.clear()
  }

  for await (const chunk of sseJson(response.body, 'OpenAI API') as AsyncGenerator<CompletionChunk>) {
    if (chunk.error)
      throw new Error(`OpenAI API error: ${chunk.error.type ? `${chunk.error.type}: ` : ''}${chunk.error.message ?? 'stream error'}`)
    if (chunk.model)
      model = chunk.model
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens ?? 0,
        completionTokens: chunk.usage.completion_tokens ?? 0,
        totalTokens: chunk.usage.total_tokens ?? 0,
      }
    }

    const choice = chunk.choices?.[0]
    if (!choice)
      continue

    if (choice.delta?.content) {
      content += choice.delta.content
      yield { type: 'text', text: choice.delta.content }
    }
    for (const piece of choice.delta?.tool_calls ?? []) {
      const entry = pending.get(piece.index) ?? { id: '', name: '', args: '' }
      if (piece.id) entry.id = piece.id
      if (piece.function?.name) entry.name += piece.function.name
      if (piece.function?.arguments) entry.args += piece.function.arguments
      pending.set(piece.index, entry)
    }
    if (choice.finish_reason) {
      finishReason = choice.finish_reason
      yield * flushCalls()
    }
  }
  yield * flushCalls()

  const result: AIResult = {
    content,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    model,
    ...(usage ? { usage } : {}),
    ...(finishReason ? { finishReason } : {}),
  }

  if (usage) {
    recordUsage({
      provider: 'openai',
      model,
      ...usage,
      durationMs: Date.now() - startedAt,
      timestamp: Date.now(),
    })
  }

  yield { type: 'done', result }
}

/**
 * Stream chat completion: the text as it is written. Tool calls, usage and
 * the stop reason are in the result the generator returns; iterate
 * {@link streamChatEvents} to act on a tool call as soon as it arrives.
 */
export function streamChat(
  messages: AIMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<string, AIResult, undefined> {
  return streamText(streamChatEvents(messages, options))
}

/**
 * Create embeddings
 */
export async function embed(
  input: string | string[],
  model = DEFAULT_EMBEDDING_MODEL,
): Promise<number[] | number[][]> {
  const config = getConfig()

  const response = await fetchWithRetry(`${config.baseUrl || DEFAULT_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Embeddings API error: ${error}`)
  }

  const data = (await response.json()) as EmbeddingsResponse

  if (Array.isArray(input)) {
    return data.data.map(d => d.embedding)
  }
  return data.data[0]!.embedding
}

/**
 * Generate images using DALL-E
 */
export async function generateImage(
  prompt: string,
  options: {
    model?: 'dall-e-2' | 'dall-e-3'
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'
    quality?: 'standard' | 'hd'
    n?: number
    responseFormat?: 'url' | 'b64_json'
  } = {},
): Promise<{ url?: string, b64_json?: string }[]> {
  const config = getConfig()
  const {
    model = 'dall-e-3',
    size = '1024x1024',
    quality = 'standard',
    n = 1,
    responseFormat = 'url',
  } = options

  const response = await fetchWithRetry(`${config.baseUrl || DEFAULT_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      n,
      response_format: responseFormat,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Image API error: ${error}`)
  }

  const data = (await response.json()) as { data: { url?: string, b64_json?: string }[] }
  return data.data
}

/**
 * Transcribe audio using Whisper
 */
export async function transcribe(
  audioFile: Blob | File,
  options: {
    model?: 'whisper-1'
    language?: string
    prompt?: string
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
    temperature?: number
  } = {},
): Promise<{ text: string }> {
  const config = getConfig()
  const formData = new FormData()
  formData.append('file', audioFile)
  formData.append('model', options.model || 'whisper-1')

  if (options.language) formData.append('language', options.language)
  if (options.prompt) formData.append('prompt', options.prompt)
  if (options.responseFormat) formData.append('response_format', options.responseFormat)
  if (options.temperature !== undefined) formData.append('temperature', String(options.temperature))

  const response = await fetchWithRetry(`${config.baseUrl || DEFAULT_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Whisper API error: ${error}`)
  }

  return response.json()
}

/**
 * Text-to-speech using OpenAI TTS
 */
export async function textToSpeech(
  input: string,
  options: {
    model?: 'tts-1' | 'tts-1-hd'
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'
    speed?: number
  } = {},
): Promise<ArrayBuffer> {
  const config = getConfig()
  const {
    model = 'tts-1',
    voice = 'alloy',
    responseFormat = 'mp3',
    speed = 1.0,
  } = options

  const response = await fetchWithRetry(`${config.baseUrl || DEFAULT_BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      voice,
      response_format: responseFormat,
      speed,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI TTS API error: ${error}`)
  }

  return response.arrayBuffer()
}

export const openaiDriver: { create: typeof createOpenAIDriver } = {
  create: createOpenAIDriver,
}

export const openai = {
  configure,
  chat,
  streamChat,
  streamChatEvents,
  embed,
  generateImage,
  transcribe,
  textToSpeech,
  createDriver: createOpenAIDriver,
}

export default openai
