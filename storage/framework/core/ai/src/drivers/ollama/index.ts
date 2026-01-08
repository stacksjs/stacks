/**
 * Ollama API Driver
 *
 * Local LLM integration via Ollama.
 * Supports chat completions, streaming, and embeddings.
 */

import type { AIDriver, AIDriverConfig, AIMessage, AIResult, ChatCompletionOptions, OllamaAPIResponse } from '../../types'

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
          if (!line.trim()) continue

          try {
            const data = JSON.parse(line) as OllamaAPIResponse
            if (data.message?.content) {
              yield data.message.content
            }
          }
          catch {
            // Skip invalid JSON
          }
        }
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

      return Array.isArray(input) ? embeddings : embeddings[0]
    },
  }
}

/**
 * Chat completion with full options
 */
export async function chat(
  messages: AIMessage[],
  options: ChatCompletionOptions = {},
): Promise<AIResult> {
  const config = getConfig()
  const {
    model = config.model,
    temperature,
    topP,
    stop,
  } = options

  const response = await fetch(`${config.host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature,
        top_p: topP,
        stop,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
  }

  const data = (await response.json()) as any

  return {
    content: data.message.content,
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
 * Stream chat completion
 */
export async function* streamChat(
  messages: AIMessage[],
  options: ChatCompletionOptions = {},
): AsyncGenerator<string> {
  const config = getConfig()
  const {
    model = config.model,
    temperature,
    topP,
    stop,
  } = options

  const response = await fetch(`${config.host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        temperature,
        top_p: topP,
        stop,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama API error: ${error}`)
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
      if (!line.trim()) continue

      try {
        const data = JSON.parse(line) as OllamaAPIResponse
        if (data.message?.content) {
          yield data.message.content
        }
      }
      catch {
        // Skip invalid JSON
      }
    }
  }
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

  const data = (await response.json()) as any

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

  return Array.isArray(input) ? embeddings : embeddings[0]
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
        const data = JSON.parse(line)
        if (onProgress) {
          onProgress(data.status, data.completed, data.total)
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
export async function showModel(name: string): Promise<{
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
    body: JSON.stringify({ name }),
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
