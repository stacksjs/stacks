/**
 * AI Search Module
 *
 * Embedding-based semantic search, vector similarity, and RAG (Retrieval-Augmented Generation).
 * Supports OpenAI and Ollama embedding models.
 */

import type { AIResult } from './types'

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingOptions {
  provider?: 'openai' | 'ollama'
  model?: string
}

export interface SearchDocument {
  id: string
  content: string
  metadata?: Record<string, unknown>
}

export interface IndexedDocument extends SearchDocument {
  embedding: number[]
}

export interface SearchResult {
  document: SearchDocument
  score: number
  rank: number
}

export interface RAGOptions {
  provider?: 'anthropic' | 'openai' | 'ollama'
  embeddingProvider?: 'openai' | 'ollama'
  embeddingModel?: string
  model?: string
  maxTokens?: number
  temperature?: number
  topK?: number
  systemPrompt?: string
}

export interface RAGResult extends AIResult {
  sources: SearchResult[]
}

// ============================================================================
// Embeddings
// ============================================================================

/**
 * Generate embeddings for text input.
 */
export async function createEmbedding(
  input: string | string[],
  options: EmbeddingOptions = {},
): Promise<number[] | number[][]> {
  const { provider = 'openai' } = options

  if (provider === 'openai') {
    return createEmbeddingOpenAI(input, options.model || 'text-embedding-3-small')
  }

  if (provider === 'ollama') {
    return createEmbeddingOllama(input, options.model || 'nomic-embed-text')
  }

  throw new Error(`Embedding provider not supported: ${provider}`)
}

async function createEmbeddingOpenAI(input: string | string[], model: string): Promise<number[] | number[][]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required for embeddings.')

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Embeddings API error: ${error}`)
  }

  const data = (await response.json()) as { data: Array<{ embedding: number[] }> }

  if (Array.isArray(input)) {
    return data.data.map(d => d.embedding)
  }
  return data.data[0].embedding
}

async function createEmbeddingOllama(input: string | string[], model: string): Promise<number[] | number[][]> {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434'
  const inputs = Array.isArray(input) ? input : [input]
  const embeddings: number[][] = []

  for (const text of inputs) {
    const response = await fetch(`${host}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
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

// ============================================================================
// Vector Similarity
// ============================================================================

/**
 * Calculate cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * Calculate dot product similarity between two vectors.
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`)
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result += a[i] * b[i]
  }
  return result
}

/**
 * Calculate Euclidean distance between two vectors.
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`)
  }

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

// ============================================================================
// In-Memory Vector Index
// ============================================================================

/**
 * Simple in-memory vector search index.
 * For production, use a dedicated vector database.
 */
export class VectorIndex {
  private documents: IndexedDocument[] = []
  private embeddingOptions: EmbeddingOptions

  constructor(options: EmbeddingOptions = {}) {
    this.embeddingOptions = options
  }

  /**
   * Add documents to the index, computing embeddings automatically.
   */
  async add(documents: SearchDocument[]): Promise<void> {
    if (documents.length === 0) return

    const contents = documents.map(d => d.content)
    const embeddings = await createEmbedding(contents, this.embeddingOptions)

    // createEmbedding returns number[][] for array input, number[] for single input
    // Since we always pass an array, we get number[][]
    const embeddingsList = contents.length === 1
      ? [embeddings as number[]]
      : (embeddings as number[][])

    for (let i = 0; i < documents.length; i++) {
      this.documents.push({
        ...documents[i],
        embedding: embeddingsList[i],
      })
    }
  }

  /**
   * Add a pre-embedded document to the index.
   */
  addWithEmbedding(document: SearchDocument, embedding: number[]): void {
    this.documents.push({ ...document, embedding })
  }

  /**
   * Search for documents similar to a query.
   */
  async search(query: string, topK = 5): Promise<SearchResult[]> {
    if (this.documents.length === 0) return []

    const queryEmbedding = await createEmbedding(query, this.embeddingOptions)
    return this.searchByVector(queryEmbedding as number[], topK)
  }

  /**
   * Search using a pre-computed embedding vector.
   */
  searchByVector(queryEmbedding: number[], topK = 5): SearchResult[] {
    if (this.documents.length === 0) return []

    const scored = this.documents.map(doc => ({
      document: { id: doc.id, content: doc.content, metadata: doc.metadata },
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }))

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, topK).map((result, index) => ({
      ...result,
      rank: index + 1,
    }))
  }

  /**
   * Remove a document by ID.
   */
  remove(id: string): boolean {
    const initialLength = this.documents.length
    this.documents = this.documents.filter(d => d.id !== id)
    return this.documents.length < initialLength
  }

  /**
   * Clear all documents from the index.
   */
  clear(): void {
    this.documents = []
  }

  /**
   * Get the number of indexed documents.
   */
  get size(): number {
    return this.documents.length
  }

  /**
   * Get all document IDs.
   */
  get ids(): string[] {
    return this.documents.map(d => d.id)
  }
}

// ============================================================================
// RAG (Retrieval-Augmented Generation)
// ============================================================================

/**
 * Perform RAG: search for relevant documents and use them as context for generation.
 */
export async function rag(
  query: string,
  index: VectorIndex,
  options: RAGOptions = {},
): Promise<RAGResult> {
  const {
    provider = 'anthropic',
    topK = 5,
    maxTokens = 4096,
    temperature,
    systemPrompt,
  } = options

  const searchResults = await index.search(query, topK)

  const contextText = searchResults
    .map((r, i) => `[Source ${i + 1}] (score: ${r.score.toFixed(3)})\n${r.document.content}`)
    .join('\n\n---\n\n')

  const ragSystemPrompt = systemPrompt || `You are a helpful assistant. Answer the user's question based on the provided context. If the context doesn't contain relevant information, say so. Always cite your sources by referencing [Source N].`

  const fullPrompt = `Context:\n${contextText}\n\nQuestion: ${query}`

  if (provider === 'anthropic') {
    return ragWithAnthropic(fullPrompt, ragSystemPrompt, searchResults, { maxTokens, temperature, model: options.model })
  }

  if (provider === 'openai') {
    return ragWithOpenAI(fullPrompt, ragSystemPrompt, searchResults, { maxTokens, temperature, model: options.model })
  }

  if (provider === 'ollama') {
    return ragWithOllama(fullPrompt, ragSystemPrompt, searchResults, { maxTokens, temperature, model: options.model })
  }

  throw new Error(`RAG provider not supported: ${provider}`)
}

async function ragWithAnthropic(
  prompt: string,
  systemPrompt: string,
  sources: SearchResult[],
  options: { maxTokens?: number; temperature?: number; model?: string },
): Promise<RAGResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required for RAG with Anthropic.')

  const model = options.model || 'claude-sonnet-4-20250514'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
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
    sources,
  }
}

async function ragWithOpenAI(
  prompt: string,
  systemPrompt: string,
  sources: SearchResult[],
  options: { maxTokens?: number; temperature?: number; model?: string },
): Promise<RAGResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY required for RAG with OpenAI.')

  const model = options.model || 'gpt-4o'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
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
    sources,
  }
}

async function ragWithOllama(
  prompt: string,
  systemPrompt: string,
  sources: SearchResult[],
  options: { maxTokens?: number; temperature?: number; model?: string },
): Promise<RAGResult> {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434'
  const model = options.model || 'llama3.2'

  const response = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: {
        temperature: options.temperature,
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
    sources,
  }
}

// ============================================================================
// Text Chunking Utilities
// ============================================================================

export interface ChunkOptions {
  chunkSize?: number
  chunkOverlap?: number
  separator?: string
}

/**
 * Split text into overlapping chunks for embedding.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    separator = '\n',
  } = options

  const segments = text.split(separator)
  const chunks: string[] = []
  let currentChunk = ''

  for (const segment of segments) {
    if (currentChunk.length + segment.length + 1 > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      // Keep overlap from end of current chunk
      if (chunkOverlap > 0) {
        const overlapStart = Math.max(0, currentChunk.length - chunkOverlap)
        currentChunk = currentChunk.slice(overlapStart) + separator + segment
      }
      else {
        currentChunk = segment
      }
    }
    else {
      currentChunk += (currentChunk ? separator : '') + segment
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Create a searchable index from a long text by chunking and embedding.
 */
export async function indexText(
  text: string,
  options: ChunkOptions & EmbeddingOptions & { idPrefix?: string } = {},
): Promise<VectorIndex> {
  const chunks = chunkText(text, options)
  const index = new VectorIndex(options)

  const documents: SearchDocument[] = chunks.map((chunk, i) => ({
    id: `${options.idPrefix || 'chunk'}-${i}`,
    content: chunk,
    metadata: { chunkIndex: i, totalChunks: chunks.length },
  }))

  await index.add(documents)
  return index
}

// ============================================================================
// Exports
// ============================================================================

export const search = {
  createEmbedding,
  cosineSimilarity,
  dotProduct,
  euclideanDistance,
  VectorIndex,
  rag,
  chunkText,
  indexText,
}
