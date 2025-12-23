/**
 * AI Module Types
 *
 * Shared type definitions for AI drivers and agents.
 */

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIDriver {
  name: string
  process: (command: string, context: string, history: AIMessage[]) => Promise<string>
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
}
