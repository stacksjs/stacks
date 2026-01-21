/**
 * Claude Agent SDK Driver
 *
 * Provides full agentic capabilities using the official Claude Agent SDK.
 * This driver uses @anthropic-ai/claude-agent-sdk for programmatic access
 * to Claude Code's capabilities including built-in tools for file operations,
 * command execution, and code analysis.
 *
 * Authentication:
 * - Uses ANTHROPIC_API_KEY environment variable if set
 * - Falls back to local Claude Code authentication if available
 *
 * @see https://docs.anthropic.com/en/docs/claude-code/sdk
 */

import type { AIDriver, AIDriverConfig, AIMessage, StreamingResult } from '../../types'

// Lazy import to avoid issues if SDK is not installed
let sdkModule: typeof import('@anthropic-ai/claude-agent-sdk') | null = null

async function getSDK() {
  if (!sdkModule) {
    try {
      sdkModule = await import('@anthropic-ai/claude-agent-sdk')
    }
    catch {
      throw new Error(
        'Claude Agent SDK not installed. Run: bun add @anthropic-ai/claude-agent-sdk',
      )
    }
  }
  return sdkModule
}

export interface ClaudeAgentSDKConfig extends AIDriverConfig {
  /** Maximum agent turns before stopping (default: 25) */
  maxTurns?: number
  /** Working directory for the agent */
  cwd?: string
  /** Tools the agent is allowed to use */
  allowedTools?: string[]
  /** Tools the agent is not allowed to use */
  disallowedTools?: string[]
  /** Permission mode for tool execution */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
  /** Custom system prompt (overrides default) */
  customSystemPrompt?: string
  /** Appended to the default system prompt */
  appendSystemPrompt?: string
  /** Session ID to resume a previous conversation */
  resumeSessionId?: string
}

// SDK state for session management
interface SDKState {
  lastSessionId?: string
}

const sdkState: SDKState = {
  lastSessionId: undefined,
}

// Default configuration
const DEFAULT_CONFIG: Required<Pick<ClaudeAgentSDKConfig, 'maxTurns' | 'allowedTools' | 'permissionMode'>> = {
  maxTurns: 25,
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  permissionMode: 'bypassPermissions',
}

/**
 * Create a Claude Agent SDK driver instance
 */
export function createClaudeAgentSDKDriver(config: ClaudeAgentSDKConfig = {}): AIDriver {
  const {
    maxTurns = DEFAULT_CONFIG.maxTurns,
    cwd,
    allowedTools = DEFAULT_CONFIG.allowedTools,
    disallowedTools,
    permissionMode = DEFAULT_CONFIG.permissionMode,
    customSystemPrompt,
    appendSystemPrompt,
    resumeSessionId,
  } = config

  return {
    name: 'Claude Agent SDK',

    async process(command: string, systemPrompt: string, _history: AIMessage[]): Promise<string> {
      const sdk = await getSDK()
      const { query } = sdk

      // Build full prompt with context
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\nUser request: ${command}`
        : command

      // Build SDK options
      const options: Record<string, unknown> = {
        allowedTools,
        permissionMode,
        maxTurns,
      }

      if (disallowedTools) {
        options.disallowedTools = disallowedTools
      }

      if (customSystemPrompt) {
        options.customSystemPrompt = customSystemPrompt
      }

      if (appendSystemPrompt) {
        options.appendSystemPrompt = appendSystemPrompt
      }

      if (cwd) {
        options.cwd = cwd
      }

      if (resumeSessionId || sdkState.lastSessionId) {
        options.resume = resumeSessionId || sdkState.lastSessionId
      }

      let result = ''

      try {
        for await (const message of query({ prompt: fullPrompt, options })) {
          // Capture session ID for potential resume
          if (message.type === 'system' && message.subtype === 'init') {
            sdkState.lastSessionId = (message as { session_id: string }).session_id
          }

          // Capture the final result
          if ('result' in message && typeof message.result === 'string') {
            result = message.result
          }

          // Log tool usage for debugging
          if (message.type === 'assistant' && 'tool_use' in message) {
            console.log(`[Claude Agent SDK] Tool use: ${JSON.stringify((message as { tool_use: unknown }).tool_use)}`)
          }
        }

        return result || 'No response from Claude Agent SDK'
      }
      catch (error) {
        const err = error as Error
        if (err.message.includes('ANTHROPIC_API_KEY')) {
          throw new Error(
            'Claude Agent SDK requires ANTHROPIC_API_KEY environment variable or Claude Code authentication.',
          )
        }
        throw new Error(`Claude Agent SDK error: ${err.message}`)
      }
    },

    async *stream(command: string, systemPrompt: string, _history: AIMessage[]): AsyncGenerator<string> {
      const sdk = await getSDK()
      const { query } = sdk

      // Build full prompt with context
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\nUser request: ${command}`
        : command

      // Build SDK options
      const options: Record<string, unknown> = {
        allowedTools,
        permissionMode,
        maxTurns,
      }

      if (disallowedTools) {
        options.disallowedTools = disallowedTools
      }

      if (customSystemPrompt) {
        options.customSystemPrompt = customSystemPrompt
      }

      if (appendSystemPrompt) {
        options.appendSystemPrompt = appendSystemPrompt
      }

      if (cwd) {
        options.cwd = cwd
      }

      if (resumeSessionId || sdkState.lastSessionId) {
        options.resume = resumeSessionId || sdkState.lastSessionId
      }

      try {
        for await (const message of query({ prompt: fullPrompt, options })) {
          // Capture session ID
          if (message.type === 'system' && message.subtype === 'init') {
            sdkState.lastSessionId = (message as { session_id: string }).session_id
          }

          // Yield assistant text content as it streams
          if (message.type === 'assistant') {
            const assistantMsg = message as {
              message?: { content?: Array<{ type: string, text?: string }> }
            }
            if (assistantMsg.message?.content) {
              for (const block of assistantMsg.message.content) {
                if (block.type === 'text' && block.text) {
                  yield block.text
                }
              }
            }
          }

          // Yield the final result
          if ('result' in message && typeof message.result === 'string') {
            yield message.result
          }
        }
      }
      catch (error) {
        const err = error as Error
        if (err.message.includes('ANTHROPIC_API_KEY')) {
          throw new Error(
            'Claude Agent SDK requires ANTHROPIC_API_KEY environment variable or Claude Code authentication.',
          )
        }
        throw new Error(`Claude Agent SDK error: ${err.message}`)
      }
    },
  }
}

/**
 * Process a command with streaming and return a StreamingResult
 */
export async function processStreaming(
  command: string,
  cwd?: string,
  config: Omit<ClaudeAgentSDKConfig, 'cwd'> = {},
): Promise<StreamingResult> {
  const sdk = await getSDK()
  const { query } = sdk

  const {
    maxTurns = DEFAULT_CONFIG.maxTurns,
    allowedTools = DEFAULT_CONFIG.allowedTools,
    disallowedTools,
    permissionMode = DEFAULT_CONFIG.permissionMode,
    customSystemPrompt,
    appendSystemPrompt,
    resumeSessionId,
  } = config

  // Build SDK options
  const options: Record<string, unknown> = {
    allowedTools,
    permissionMode,
    maxTurns,
  }

  if (disallowedTools) options.disallowedTools = disallowedTools
  if (customSystemPrompt) options.customSystemPrompt = customSystemPrompt
  if (appendSystemPrompt) options.appendSystemPrompt = appendSystemPrompt
  if (cwd) options.cwd = cwd
  if (resumeSessionId || sdkState.lastSessionId) {
    options.resume = resumeSessionId || sdkState.lastSessionId
  }

  const encoder = new TextEncoder()
  let fullResponse = ''
  let resolveFullResponse: (value: string) => void

  const fullResponsePromise = new Promise<string>((resolve) => {
    resolveFullResponse = resolve
  })

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const message of query({ prompt: command, options })) {
          // Capture session ID
          if (message.type === 'system' && message.subtype === 'init') {
            sdkState.lastSessionId = (message as { session_id: string }).session_id
          }

          // Stream assistant text content
          if (message.type === 'assistant') {
            const assistantMsg = message as {
              message?: { content?: Array<{ type: string, text?: string }> }
            }
            if (assistantMsg.message?.content) {
              for (const block of assistantMsg.message.content) {
                if (block.type === 'text' && block.text) {
                  fullResponse += block.text
                  controller.enqueue(encoder.encode(block.text))
                }
              }
            }
          }

          // Capture final result
          if ('result' in message && typeof message.result === 'string') {
            if (!fullResponse) {
              fullResponse = message.result
              controller.enqueue(encoder.encode(message.result))
            }
          }
        }

        resolveFullResponse(fullResponse)
        controller.close()
      }
      catch (error) {
        resolveFullResponse(fullResponse)
        controller.error(error)
      }
    },
  })

  return {
    stream,
    fullResponse: fullResponsePromise,
  }
}

/**
 * Resume a previous SDK session
 */
export async function resumeSession(sessionId: string, prompt: string): Promise<string> {
  const sdk = await getSDK()
  const { query } = sdk

  let result = ''

  for await (const message of query({
    prompt,
    options: {
      resume: sessionId,
      permissionMode: 'bypassPermissions',
    },
  })) {
    if ('result' in message && typeof message.result === 'string') {
      result = message.result
    }
  }

  return result || 'No response from resumed session'
}

/**
 * Get the last session ID for potential resume
 */
export function getLastSessionId(): string | undefined {
  return sdkState.lastSessionId
}

/**
 * Clear the stored session ID
 */
export function clearSession(): void {
  sdkState.lastSessionId = undefined
}

// Export the driver creator and utilities
export const claudeAgentSDK = {
  createDriver: createClaudeAgentSDKDriver,
  processStreaming,
  resumeSession,
  getLastSessionId,
  clearSession,
}

export default claudeAgentSDK
