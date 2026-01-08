/**
 * AI Module Types
 *
 * Shared type definitions for AI drivers and agents.
 */

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | AIMessageContent[]
}

export interface AIMessageContent {
  type: 'text' | 'image_url' | 'image'
  text?: string
  image_url?: { url: string, detail?: 'auto' | 'low' | 'high' }
  source?: { type: 'base64', media_type: string, data: string }
}

export interface AIDriver {
  name: string
  process: (command: string, context: string, history: AIMessage[]) => Promise<string>
  stream?: (command: string, context: string, history: AIMessage[]) => AsyncGenerator<string>
  embed?: (input: string | string[]) => Promise<number[] | number[][]>
}

export interface AIDriverConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  maxTokens?: number
}

export interface StreamingResult {
  stream: ReadableStream<Uint8Array>
  fullResponse: Promise<string>
}

export interface EmbeddingResult {
  embedding: number[]
  index: number
  object: string
}

export interface EmbeddingsResponse {
  data: EmbeddingResult[]
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

export interface ChatCompletionOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  stop?: string | string[]
  stream?: boolean
}

export interface AIResult {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: string
}

export interface ClaudeAPIResponse {
  content: Array<{ type: string, text: string }>
}

export interface OpenAIAPIResponse {
  choices: Array<{ message: { content: string } }>
}

export interface OllamaAPIResponse {
  message: { content: string }
}

export interface ClaudeStreamEvent {
  type: string
  subtype?: string
  message?: {
    content: Array<{
      type: string
      text?: string
      name?: string
      input?: Record<string, unknown>
    }>
  }
  delta?: { text?: string }
  result?: string
  // Content block events for better streaming
  index?: number
  content_block?: {
    type: string
    text?: string
  }
}

// Buddy Types
export interface RepoState {
  path: string
  name: string
  branch: string
  hasChanges: boolean
  lastCommit?: string
}

export interface GitHubCredentials {
  token: string
  username: string
  name: string
  email: string
}

export interface BuddyState {
  repo: RepoState | null
  conversationHistory: AIMessage[]
  currentDriver: string
  github: GitHubCredentials | null
}

export interface BuddyConfig {
  workDir: string
  commitMessage: string
  ollamaHost: string
  ollamaModel: string
}

export interface BuddyApiKeys {
  anthropic?: string
  openai?: string
  claudeCliHost?: string
}
