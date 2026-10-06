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
  type: 'text' | 'image_url' | 'image' | 'tool_call' | 'tool_result'
  text?: string
  image_url?: { url: string, detail?: 'auto' | 'low' | 'high' }
  source?: { type: 'base64', media_type: string, data: string }
  /** For `tool_call`: a call the assistant made, as `AIResult.toolCalls` reported it. */
  toolCall?: AIToolCall
  /** For `tool_result`: what the application's tool returned, sent back in a user turn. */
  toolResult?: AIToolResult
}

/**
 * A tool the model asked to call. The same shape from every driver: OpenAI's
 * `tool_calls`, Anthropic's `tool_use`, Bedrock's `toolUse`, Ollama's
 * `tool_calls`.
 */
export interface AIToolCall {
  /** The provider's id for the call; a `tool_result` answers it by this id. */
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface AIToolResult {
  /** The `AIToolCall.id` this answers. */
  toolCallId: string
  /** Needed by Ollama, which matches results to calls by name. */
  name?: string
  content: string
  isError?: boolean
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
  /** The text the model wrote; `''` when it only called tools. */
  content: string
  /**
   * The tools the model asked to call, in order. Absent when it called none.
   * The structured-output tool `responseFormat` uses is internal: its JSON is
   * `content`, and it never appears here.
   */
  toolCalls?: AIToolCall[]
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: string
}

/**
 * One event of a streamed chat completion, the same from every driver.
 *
 * `text` arrives in pieces as the model writes. A `tool_call` arrives whole,
 * once its arguments have finished streaming, so it can be run as soon as
 * it is seen. `done` comes last, exactly once, with everything the stream
 * carried in the shape `chat()` returns - text, tool calls, usage and why
 * the model stopped.
 */
export type AIStreamEvent =
  | { type: 'text', text: string }
  | { type: 'tool_call', call: AIToolCall }
  | { type: 'done', result: AIResult }

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
  default?: AIProvider | string
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

export type AIProvider = 'anthropic' | 'openai' | 'ollama' | 'bedrock'

/**
 * Where a provider's credentials come from. `aws-credential-chain`: Bedrock
 * resolves them per request from the environment, a shared profile, or the
 * instance role, so whether they exist is only known when one is made.
 */
export type AIConfigurationSource = 'config' | 'environment' | 'base-url' | 'local' | 'aws-credential-chain' | 'none'

/**
 * Safe, provider-neutral configuration metadata for diagnostics and UI.
 * Never includes credentials.
 */
export interface AIProviderConfiguration {
  provider: AIProvider
  model?: string
  configured: boolean
  source: AIConfigurationSource
}

export interface ConfiguredAIOptions extends AIConfig {
  drivers?: {
    anthropic?: AIDriverConfig & { anthropicVersion?: string }
    openai?: AIDriverConfig & { embeddingModel?: string }
    ollama?: AIDriverConfig & { host?: string, embeddingModel?: string }
    bedrock?: { model?: string, region?: string, maxTokens?: number }
  }
}

export interface GenerateObjectOptions extends ChatCompletionOptions {
  /** Maximum total generation attempts. Defaults to 2. */
  attempts?: number
  /** Optional system instruction kept separate for providers that require it. */
  system?: string
}

export interface ConfiguredAIClient {
  provider: AIProvider
  configuration: AIProviderConfiguration
  generate: (messages: AIMessage[], options?: ChatCompletionOptions & { system?: string }) => Promise<AIResult>
  generateObject: <T>(
    messages: AIMessage[],
    schema: Record<string, unknown>,
    options?: GenerateObjectOptions,
  ) => Promise<{ data: T, result: AIResult }>
}
