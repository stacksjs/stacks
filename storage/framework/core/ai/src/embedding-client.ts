import type { ConfiguredAIOptions } from './types'
import { validateEmbedding } from './durable-retrieval'
import { resolveAIProvider } from './client'
import { fetchWithRetry } from './utils/retry'

export interface ConfiguredEmbeddingClient {
  model: string
  provider: 'openai' | 'ollama'
  dimensions?: number
  embed: (texts: string[], options?: { signal?: AbortSignal }) => Promise<number[][]>
}
/** Explicit embedding provider overrides a chat-only default; credentials stay in server config. */
export function createConfiguredEmbeddingClient(config: ConfiguredAIOptions, options: { provider?: 'openai' | 'ollama', model?: string, dimensions?: number } = {}): ConfiguredEmbeddingClient {
  const selected = options.provider ?? resolveAIProvider(config)
  if (selected !== 'openai' && selected !== 'ollama') throw new Error(`Embeddings are not implemented for ${selected}. Configure an OpenAI or Ollama embedding provider.`)
  const driver = config.drivers?.[selected] ?? {}
  const model = options.model ?? driver.embeddingModel ?? (selected === 'openai' ? 'text-embedding-3-small' : 'nomic-embed-text')
  const dimensions = options.dimensions
  if (dimensions !== undefined && (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 16000)) throw new TypeError('Invalid embedding dimensions')
  const key = driver.apiKey || process.env.OPENAI_API_KEY || ''
  if (selected === 'openai' && !key.trim()) throw new Error('OpenAI embeddings require a configured API key')
  const baseUrl = (selected === 'openai' ? driver.baseUrl || 'https://api.openai.com/v1' : config.drivers?.ollama?.host || driver.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '')
  const url = new URL(baseUrl)
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('Embedding base URL must use HTTP or HTTPS')
  return {
    model, provider: selected, dimensions,
    async embed(texts, request = {}) {
      if (!Array.isArray(texts) || !texts.length || texts.length > 64 || texts.some(text => typeof text !== 'string' || !text.trim() || text.length > 16000)) throw new TypeError('Embed between one and 64 bounded text chunks')
      const response = await fetchWithRetry(`${baseUrl}${selected === 'openai' ? '/embeddings' : '/api/embed'}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(selected === 'openai' ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ model, input: texts, ...(selected === 'openai' && dimensions ? { dimensions } : {}) }), signal: request.signal }, { maxRetries: 0 })
      if (!response.ok) throw new Error(`Embedding provider failed (${response.status})`)
      const data = await response.json() as { data?: { index: number, embedding: unknown }[], embeddings?: unknown[] }
      if (selected === 'openai' && (!Array.isArray(data.data) || data.data.length !== texts.length || [...data.data].sort((a, b) => a.index - b.index).some((item, index) => item.index !== index))) throw new Error('Embedding provider returned duplicate or missing batch indices')
      const vectors = selected === 'openai' ? [...(data.data ?? [])].sort((a, b) => a.index - b.index).map(item => item.embedding) : data.embeddings ?? []
      if (vectors.length !== texts.length) throw new Error('Embedding provider returned an incomplete batch')
      const normalized = vectors.map(vector => validateEmbedding(vector, dimensions))
      const size = normalized[0]!.length
      if (normalized.some(vector => vector.length !== size)) throw new Error('Embedding provider returned inconsistent dimensions')
      return normalized
    },
  }
}
