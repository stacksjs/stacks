/**
 * Ollama API Driver
 *
 * Local LLM integration via Ollama.
 * Supports chat completions, streaming, and embeddings.
 */

import type { AIDriver, AIDriverConfig, AIMessage, AIResult, AIStreamEvent, AIToolCall, ChatCompletionOptions, OllamaAPIResponse } from '../../types'
import { ndjson, streamText } from '../../utils/stream'
import { parseToolArguments, toOllamaMessages } from '../../utils/tools'

export interface OllamaDriverConfig extends AIDriverConfig {
  host?: string
  model?: string
  embeddingModel?: string
}

const DEFAULT_HOST = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.2'
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text'

let globalConfig: OllamaDriverConfig = {}

/**
 * Configure Ollama globally
 */
export function configure(config: OllamaDriverConfig): void {
  globalConfig = { ...globalConfig, ...config }
}

function getConfig(config?: Partial<OllamaDriverConfig>): OllamaDriverConfig {
  return {
    host: config?.host || globalConfig.host || process.env.OLLAMA_HOST || DEFAULT_HOST,
    model: config?.model || globalConfig.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL,
    embeddingModel: config?.embeddingModel || globalConfig.embeddingModel || DEFAULT_EMBEDDING_MODEL,
  }
}

export function createOllamaDriver(config: OllamaDriverConfig = {}): AIDriver {
  const {
    host = process.env.OLLAMA_HOST || DEFAULT_HOST,
    model = process.env.OLLAMA_MODEL || DEFAULT_MODEL,
    embeddingModel = DEFAULT_EMBEDDING_MODEL,
  } = config

  return {
    name: 'Ollama',

    async process(command: string, systemPrompt: string, history: AIMessage[]): Promise<string> {
      const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: command },
          ],
          stream: false,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${error}`)
      }

      const data = (await response.json()) as OllamaAPIResponse
      return data.message.content
    },

    async *stream(command: string, systemPrompt: string, history: AIMessage[]): AsyncGenerator<string> {
      const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: command },
          ],
          stream: true,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${error}`)
      }

      if (!response.body) throw new Error('No response body')

      // An `error` line ends the stream as a failure, not as a truncated
      // success, and a line that is not JSON throws in `ndjson` rather than
      // dropping what it carried.
      for await (const data of ndjson(response.body, 'Ollama API') as AsyncGenerator<OllamaChatChunk>) {
        if (data.error)
          throw new Error(`Ollama API error: ${data.error}`)
        if (data.message?.content)
          yield data.message.content
      }
    },

    async embed(input: string | string[]): Promise<number[] | number[][]> {
      const inputs = Array.isArray(input) ? input : [input]
      const embeddings: number[][] = []

      for (const text of inputs) {
        const response = await fetch(`${host}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: embeddingModel,
            prompt: text,
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Ollama Embeddings API error: ${error}`)
        }

        const data = (await response.json()) as { embedding: number[] }
        embeddings.push(data.embedding)
      }

      return Array.isArray(input) ? embeddings : embeddings[0]!
    },
  }
}

/**
 * The `/api/chat` request for a chat completion, streamed or not. Shared so a
 * stream offers the model exactly what `chat()` would: the stream used to
 * send no tools and no format, so it could never see a tool call.
 */
function chatRequest(messages: AIMessage[], options: ChatCompletionOptions, stream: boolean): Record<string, unknown> {
  const config = getConfig()
  const {
    model = config.model,
    temperature,
    topP,
    stop,
    responseFormat,
    tools,
    toolChoice,
  } = options

  // Ollama has no tool_choice: it can be offered tools, never made to call one.
  if (toolChoice === 'required' || (toolChoice && typeof toolChoice === 'object'))
    throw new Error('Ollama cannot be made to call a tool: offer the tools with toolChoice \'auto\', or use another driver')
  const offered = toolChoice === 'none' ? [] : (tools ?? [])

  const format = responseFormat?.type === 'json_schema'
    ? responseFormat.json_schema.schema
    : responseFormat?.type === 'json_object'
      ? 'json'
      : undefined

  return {
    model,
    messages: toOllamaMessages(messages),
    stream,
    format,
    ...(offered.length > 0
      ? {
          tools: offered.map(tool => ({
            type: 'function',
            function: { name: tool.name, description: tool.description, parameters: tool.parameters ?? { type: 'object', properties: {} } },
          })),
        }
      : {}),
    options: {
      temperature,
      top_p: topP,
      stop,
    },
  }
}

type OllamaToolCalls = Array<{ id?: string, function: { name: string, arguments: unknown } }>

/** One line of a streamed `/api/chat` response. */
interface OllamaChatChunk {
  model?: string
  message?: { content?: string, tool_calls?: OllamaToolCalls }
  done?: boolean
  done_reason?: string
  prompt_eval_count?: number
  eval_count?: number
  error?: string
}

/**
 * Ollama's calls in the cross-driver shape. Ollama matches a result to its
 * call by tool name, and older servers send no id; one is made up from the
 * call's position so the shape always has one.
 */
function toToolCalls(calls: OllamaToolCalls, offset = 0): AIToolCall[] {
  return calls.map((call, index) => ({
    id: call.id ?? `call_${offset + index}`,
    name: call.function.name,
    arguments: parseToolArguments(call.function.arguments, call.function.name),
  }))
}

/**
 * Chat completion with full options
 */
export async function chat(
  messages: AIMessage[],
  options: ChatCompletionOptions = {},
): Promise<AIResult> {
  const config = getConfig()
  const response = await fetch(`${config.host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatRequest(messages, options, false)),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
  }

  const data = (await response.json())
  const toolCalls = toToolCalls((data.message?.tool_calls ?? []) as OllamaToolCalls)

  return {
    content: data.message?.content ?? '',
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    model: data.model,
    usage: {
      promptTokens: data.prompt_eval_count || 0,
      completionTokens: data.eval_count || 0,
      totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    },
    finishReason: data.done_reason || 'stop',
  }
}

/**
 * A streamed chat completion, as events: text as it is written, each tool
 * call as it arrives, then the whole result.
 *
 * Ollama streams newline-delimited JSON. A tool call arrives whole, on the
 * message of whichever chunk carries it, and the counts and stop reason on
 * the last (`done: true`) one. An `error` line throws.
 */
export async function* streamChatEvents(
  messages: AIMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<AIStreamEvent> {
  const config = getConfig()
  const body = chatRequest(messages, options, true)
  const response = await fetch(`${config.host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
  }
  if (!response.body) throw new Error('No response body')

  const toolCalls: AIToolCall[] = []
  let content = ''
  let model = String(body.model)
  let usage: AIResult['usage']
  let finishReason: string | undefined

  for await (const chunk of ndjson(response.body, 'Ollama API') as AsyncGenerator<OllamaChatChunk>) {
    if (chunk.error)
      throw new Error(`Ollama API error: ${chunk.error}`)
    if (chunk.model)
      model = chunk.model

    if (chunk.message?.content) {
      content += chunk.message.content
      yield { type: 'text', text: chunk.message.content }
    }
    for (const call of toToolCalls(chunk.message?.tool_calls ?? [], toolCalls.length)) {
      toolCalls.push(call)
      yield { type: 'tool_call', call }
    }

    if (chunk.done) {
      finishReason = chunk.done_reason || 'stop'
      usage = {
        promptTokens: chunk.prompt_eval_count || 0,
        completionTokens: chunk.eval_count || 0,
        totalTokens: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
      }
    }
  }

  yield {
    type: 'done',
    result: {
      content,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      model,
      ...(usage ? { usage } : {}),
      ...(finishReason ? { finishReason } : {}),
    },
  }
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
 * Generate text completion (non-chat)
 */
export async function generate(
  prompt: string,
  options: {
    model?: string
    system?: string
    template?: string
    context?: number[]
    raw?: boolean
    format?: 'json'
    images?: string[]
  } = {},
): Promise<AIResult> {
  const config = getConfig()

  const response = await fetch(`${config.host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || config.model,
      prompt,
      system: options.system,
      template: options.template,
      context: options.context,
      raw: options.raw,
      format: options.format,
      images: options.images,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
  }

  const data = (await response.json())

  return {
    content: data.response,
    model: data.model,
    usage: {
      promptTokens: data.prompt_eval_count || 0,
      completionTokens: data.eval_count || 0,
      totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    },
  }
}

/**
 * Create embeddings
 */
export async function embed(
  input: string | string[],
  model?: string,
): Promise<number[] | number[][]> {
  const config = getConfig()
  const embeddingModel = model || config.embeddingModel

  const inputs = Array.isArray(input) ? input : [input]
  const embeddings: number[][] = []

  for (const text of inputs) {
    const response = await fetch(`${config.host}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: embeddingModel,
        prompt: text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama Embeddings API error: ${error}`)
    }

    const data = (await response.json()) as { embedding: number[] }
    embeddings.push(data.embedding)
  }

  return Array.isArray(input) ? embeddings : embeddings[0]!
}

/**
 * List available models
 */
export async function listModels(): Promise<Array<{
  name: string
  modified_at: string
  size: number
  digest: string
  details: {
    format: string
    family: string
    families: string[]
    parameter_size: string
    quantization_level: string
  }
}>> {
  const config = getConfig()

  const response = await fetch(`${config.host}/api/tags`, {
    method: 'GET',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
  }

  const data = (await response.json()) as { models: any[] }
  return data.models
}

/**
 * Pull a model from the library
 */
export async function pullModel(
  name: string,
  onProgress?: (status: string, completed?: number, total?: number) => void,
): Promise<void> {
  const config = getConfig()

  const response = await fetch(`${config.host}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const data = JSON.parse(line) as { status?: string; completed?: number; total?: number }
        if (onProgress) {
          onProgress(data.status ?? '', data.completed, data.total)
        }
      }
      catch {
        // Skip invalid JSON
      }
    }
  }
}

/**
 * Delete a model
 */
export async function deleteModel(name: string): Promise<void> {
  const config = getConfig()

  const response = await fetch(`${config.host}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
  }
}

/**
 * Show model information
 */
export async function showModel(_name: string): Promise<{
  modelfile: string
  parameters: string
  template: string
  details: {
    format: string
    family: string
    families: string[]
    parameter_size: string
    quantization_level: string
  }
}> {
  const config = getConfig()

  const response = await fetch(`${config.host}/api/show`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: _name }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
  }

  return response.json()
}

/**
 * Check if Ollama is running
 */
export async function isRunning(): Promise<boolean> {
  const config = getConfig()

  try {
    const response = await fetch(`${config.host}/api/tags`, {
      method: 'GET',
    })
    return response.ok
  }
  catch {
    return false
  }
}

export const ollamaDriver: { create: typeof createOllamaDriver } = {
  create: createOllamaDriver,
}

export const ollama = {
  configure,
  chat,
  streamChat,
  streamChatEvents,
  generate,
  embed,
  listModels,
  pullModel,
  deleteModel,
  showModel,
  isRunning,
  createDriver: createOllamaDriver,
}

export default ollama
