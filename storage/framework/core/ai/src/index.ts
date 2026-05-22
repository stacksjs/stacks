// Types
export * from './types'

// Drivers
export * from './drivers'

// Agents
export * from './agents'

// Buddy - Voice AI Code Assistant
export * from './buddy'

// Text utilities
export * from './text'

// Image generation & vision
export * from './image'

// Semantic search, embeddings & RAG
export * from './search'

// Personalization, sentiment & classification
export * from './personalization'

// Model Context Protocol (MCP) client
export * from './mcp'

// AWS Bedrock utilities
export * from './utils/client-bedrock'
export * from './utils/client-bedrock-runtime'

// Cross-driver vision helpers (stacksjs/stacks#1878 A-3).
// `buildMessageWithImages(command, images)` constructs portable
// content arrays; `normalizeMessagesForProvider(messages, 'openai' | 'anthropic')`
// translates between the OpenAI image_url and Anthropic image
// source formats so apps can switch providers without rewriting.
export { buildMessageWithImages, normalizeMessagesForProvider } from './utils/vision'

// HTTP retry helper for 429/5xx (stacksjs/stacks#1878 A-5).
export { fetchWithRetry } from './utils/retry'
export type { RetryConfig } from './utils/retry'

// Usage tracking (stacksjs/stacks#1878 A-6). Apps install reporters
// via `onUsage(fn)`; drivers fire `recordUsage(...)` per completion.
// Default with no reporters is a no-op.
export { clearUsageReporters, listUsageReporters, onUsage, recordUsage } from './utils/usage'
export type { UsageRecord, UsageReporter } from './utils/usage'

// Token estimation + prompt-injection heuristics (stacksjs/stacks#1878 A-7).
export { estimateMessageTokens, estimateTokens, sanitizePrompt } from './utils/tokens'
export type { SanitizeResult } from './utils/tokens'

export * from './utils/model-access'
