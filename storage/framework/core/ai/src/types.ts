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

/**
 * Tool / function definition that the model can call back into.
 * Cross-provider shape: OpenAI's `tools[]` and Anthropic's `tools[]`
 * map to this same structure via the JSON Schema for parameters.
 */
export interface AITool {
  name: string
  description?: string
  /** JSON Schema for the tool's input. */
  parameters?: Record<string, unknown>
  /** OpenAI-only `tool_choice` semantics: 'auto' (default), 'required', or { name }. */
}

/**
 * Structured-output / JSON-mode response format. Modeled after
 * OpenAI's `response_format` but the Anthropic driver maps it to
 * the tools-as-json pattern internally (stacksjs/stacks#1878 A-1).
 */
export type AIResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | {
      type: 'json_schema'
      json_schema: {
        name: string
        schema: Record<string, unknown>
        strict?: boolean
      }
    }

export interface ChatCompletionOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  stop?: string | string[]
  stream?: boolean
  /**
   * Tools / functions the model can call (stacksjs/stacks#1878 A-1).
   * OpenAI threads as `tools` directly; Anthropic threads as
   * `tools` (Claude 3.5+) — the cross-driver shape is the same.
   */
  tools?: AITool[]
  /**
   * Force the model to call a specific tool, or any tool, or no
   * tool. OpenAI semantics. Anthropic supports the same via
   * `tool_choice` field in Messages API.
   */
  toolChoice?: 'auto' | 'required' | 'none' | { name: string }
  /**
   * Force structured output (stacksjs/stacks#1878 A-1).
   * - `{ type: 'text' }` → freeform (the default)
   * - `{ type: 'json_object' }` → guaranteed JSON, schema not enforced
   * - `{ type: 'json_schema', json_schema: {...} }` → JSON matching schema
   */
  responseFormat?: AIResponseFormat
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

// Image types
export interface ImageGenerationConfig {
  provider: 'openai'
  model?: string
  apiKey?: string
}

// Search/RAG types
export interface SearchConfig {
  embeddingProvider: 'openai' | 'ollama'
  embeddingModel?: string
  generationProvider?: 'anthropic' | 'openai' | 'ollama'
  generationModel?: string
}

// MCP types
export interface MCPConfig {
  servers: Array<{
    name: string
    command?: string
    args?: string[]
    url?: string
    env?: Record<string, string>
  }>
}

// AI module config (used by @stacksjs/config)
export interface AIConfig {
  default?: string
  models?: string[]
  drivers?: {
    anthropic?: AIDriverConfig & { anthropicVersion?: string }
    openai?: AIDriverConfig & { embeddingModel?: string }
    ollama?: AIDriverConfig & { host?: string; embeddingModel?: string }
  }
  image?: ImageGenerationConfig
  search?: SearchConfig
  mcp?: MCPConfig
}
