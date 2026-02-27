/**
 * OpenAI API Driver
 *
 * Direct API integration with OpenAI's GPT models.
 * Supports chat completions, streaming, and embeddings.
 */

import type { AIDriver, AIDriverConfig, AIMessage, AIResult, ChatCompletionOptions, EmbeddingsResponse, OpenAIAPIResponse } from '../../types'

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

      const response = await fetch(`${baseUrl}/chat/completions`, {
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

    async *stream(command: string, systemPrompt: string, history: AIMessage[]): AsyncGenerator<string> {
      if (!apiKey) {
        throw new Error('OpenAI API key not set. Configure your API key in settings.')
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
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
              const parsed = JSON.parse(data) as any
              const content = parsed.choices[0]?.delta?.content
              if (content) yield content
            }
            catch {
              // Skip invalid JSON
            }
          }
        }
      }
    },

    async embed(input: string | string[]): Promise<number[] | number[][]> {
      if (!apiKey) {
        throw new Error('OpenAI API key not set. Configure your API key in settings.')
      }

      const response = await fetch(`${baseUrl}/embeddings`, {
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
      return data.data[0].embedding
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
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature,
    topP,
    stop,
  } = options

  const response = await fetch(`${config.baseUrl || DEFAULT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stop,
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = (await response.json()) as any

  return {
    content: data.choices[0].message.content,
    model: data.model,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    finishReason: data.choices[0].finish_reason,
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
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature,
    topP,
    stop,
  } = options

  const response = await fetch(`${config.baseUrl || DEFAULT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      stop,
      stream: true,
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
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
          const parsed = JSON.parse(data) as any
          const content = parsed.choices[0]?.delta?.content
          if (content) yield content
        }
        catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

/**
 * Create embeddings
 */
export async function embed(
  input: string | string[],
  model = DEFAULT_EMBEDDING_MODEL,
): Promise<number[] | number[][]> {
  const config = getConfig()

  const response = await fetch(`${config.baseUrl || DEFAULT_BASE_URL}/embeddings`, {
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
  return data.data[0].embedding
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

  const response = await fetch(`${config.baseUrl || DEFAULT_BASE_URL}/images/generations`, {
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

  const response = await fetch(`${config.baseUrl || DEFAULT_BASE_URL}/audio/transcriptions`, {
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

  return response.json() as any
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

  const response = await fetch(`${config.baseUrl || DEFAULT_BASE_URL}/audio/speech`, {
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
  embed,
  generateImage,
  transcribe,
  textToSpeech,
  createDriver: createOpenAIDriver,
}

export default openai
