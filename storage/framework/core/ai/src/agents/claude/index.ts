/**
 * Claude CLI Agent
 *
 * Provides integration with Claude CLI for local and remote (EC2) execution.
 * Supports both synchronous and streaming responses.
 */

import type { AIDriver, AIMessage, ClaudeStreamEvent, StreamingResult } from '../../types'

// Track prompt count for session feedback
let promptCount = 0

export interface ClaudeAgentConfig {
  /** Working directory for command execution */
  cwd?: string
  /** EC2 host for remote execution */
  ec2Host?: string
  /** EC2 user (default: ubuntu) */
  ec2User?: string
  /** Path to EC2 SSH key */
  ec2Key?: string
}

/**
 * Format tool usage for display
 */
function formatToolUsage(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read': {
      const filePath = (input.file_path as string) || ''
      const fileName = filePath.split('/').pop() || filePath
      return `\n📖 Reading: ${fileName}\n`
    }
    case 'Glob':
      return `\n🔍 Searching files: ${input.pattern || ''}\n`
    case 'Grep':
      return `\n🔎 Searching for: "${input.pattern || ''}"\n`
    case 'Edit': {
      const filePath = (input.file_path as string) || ''
      const fileName = filePath.split('/').pop() || filePath
      return `\n✏️ Editing: ${fileName}\n`
    }
    case 'Write': {
      const filePath = (input.file_path as string) || ''
      const fileName = filePath.split('/').pop() || filePath
      return `\n📝 Writing: ${fileName}\n`
    }
    case 'Bash': {
      const cmd = ((input.command as string) || '').substring(0, 50)
      return `\n💻 Running: ${cmd}${cmd.length >= 50 ? '...' : ''}\n`
    }
    case 'Task':
      return `\n🚀 Launching agent: ${input.description || 'task'}\n`
    default:
      return `\n🔧 Using: ${toolName}\n`
  }
}

/**
 * Create a local Claude CLI agent
 */
export function createClaudeLocalAgent(config: ClaudeAgentConfig = {}): AIDriver {
  return {
    name: 'Claude CLI (Local)',

    async process(command: string, context: string, _history: AIMessage[]): Promise<string> {
      const { $ } = await import('bun')

      // Check if claude CLI is available
      const whichResult = await $`which claude`.quiet().nothrow()
      if (whichResult.exitCode !== 0) {
        throw new Error('Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code')
      }

      // Build the full prompt with context
      const fullPrompt = context
        ? `Context:\n${context}\n\nUser request: ${command}`
        : command

      const cwd = config.cwd || process.cwd()

      try {
        const result = await $`cd ${cwd} && claude --print --dangerously-skip-permissions ${fullPrompt}`.quiet()
        return result.text().trim()
      }
      catch {
        // Try with allowedTools flag as alternative
        try {
          const result = await $`cd ${cwd} && claude --print --allowedTools "Write,Edit,Bash" ${fullPrompt}`.quiet()
          return result.text().trim()
        }
        catch (innerError) {
          throw new Error(`Claude CLI error: ${(innerError as Error).message}`)
        }
      }
    },
  }
}

/**
 * Create a remote Claude CLI agent (EC2)
 */
export function createClaudeEC2Agent(config: ClaudeAgentConfig): AIDriver {
  const {
    ec2Host = process.env.BUDDY_EC2_HOST,
    ec2User = process.env.BUDDY_EC2_USER || 'ubuntu',
    ec2Key = process.env.BUDDY_EC2_KEY,
  } = config

  return {
    name: 'Claude CLI (EC2)',

    async process(command: string, context: string, _history: AIMessage[]): Promise<string> {
      const { $ } = await import('bun')

      if (!ec2Host) {
        throw new Error('BUDDY_EC2_HOST environment variable not set. Set it to your EC2 instance IP/hostname.')
      }

      // Build the full prompt with context
      const fullPrompt = context
        ? `Context:\n${context}\n\nUser request: ${command}`
        : command

      // Escape the prompt for SSH
      const escapedPrompt = fullPrompt.replace(/'/g, `'\\''`)

      // Build SSH command
      const sshArgs = ec2Key ? `-i ${ec2Key}` : ''
      const sshTarget = `${ec2User}@${ec2Host}`

      try {
        const result = await $`ssh ${sshArgs} ${sshTarget} "claude --print '${escapedPrompt}'"`.quiet()
        return result.text().trim()
      }
      catch (error) {
        throw new Error(`EC2 Claude CLI error: ${(error as Error).message}. Make sure SSH is configured and claude CLI is installed on EC2.`)
      }
    },
  }
}

/**
 * Process command with streaming output using Claude CLI
 *
 * Returns a ReadableStream that emits chunks of the response in real-time.
 * Uses --output-format stream-json for detailed streaming with tool usage.
 */
export async function processCommandStreaming(
  command: string,
  cwd: string,
): Promise<StreamingResult> {
  const { spawn } = await import('bun')

  // Spawn Claude CLI process with stream-json output format
  const proc = spawn([
    'claude',
    '--print',
    '--verbose',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--dangerously-skip-permissions',
    command,
  ], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  let fullResponse = ''
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const reader = proc.stdout.getReader()
        let buffer = ''
        let lastSentText = ''

        let result = await reader.read()
        while (!result.done) {
          buffer += decoder.decode(result.value, { stream: true })

          // Parse JSON lines from buffer
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue

            try {
              const event = JSON.parse(line) as ClaudeStreamEvent
              let textContent = ''

              if (event.type === 'system' && event.subtype === 'init') {
                promptCount++
                // Show *thinking* on 2nd prompt onwards
                if (promptCount >= 2) {
                  textContent = '*thinking*\n\n'
                }
              }
              else if (event.type === 'assistant' && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === 'text' && block.text) {
                    textContent += block.text
                  }
                  else if (block.type === 'tool_use' && block.name) {
                    textContent += formatToolUsage(block.name, block.input || {})
                  }
                }
              }
              else if (event.type === 'user' && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === 'tool_result') {
                    textContent += `   ✓ done\n`
                  }
                }
              }
              else if (event.type === 'content_block_delta' && event.delta?.text) {
                textContent = event.delta.text
              }
              else if (event.type === 'result' && event.result) {
                fullResponse = event.result
                if (!lastSentText.includes(event.result)) {
                  textContent = event.result
                }
              }

              // Only send new content
              if (textContent && !lastSentText.endsWith(textContent)) {
                lastSentText += textContent
                controller.enqueue(encoder.encode(textContent))
              }
            }
            catch {
              // Not valid JSON, might be plain text output
              if (!lastSentText.includes(line)) {
                lastSentText += line
                fullResponse += line
                controller.enqueue(encoder.encode(line))
              }
            }
          }

          result = await reader.read()
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer) as ClaudeStreamEvent
            if (event.result && !fullResponse) {
              fullResponse = event.result
            }
          }
          catch {
            if (!lastSentText.includes(buffer)) {
              fullResponse += buffer
              controller.enqueue(encoder.encode(buffer))
            }
          }
        }

        await proc.exited
        controller.close()
      }
      catch (error) {
        controller.error(error)
      }
    },
  })

  const fullResponsePromise = (async () => {
    await proc.exited
    return fullResponse.trim()
  })()

  return { stream, fullResponse: fullResponsePromise }
}

export function resetPromptCount(): void {
  promptCount = 0
}

export const claudeAgent: {
  createLocal: typeof createClaudeLocalAgent
  createEC2: typeof createClaudeEC2Agent
  processStreaming: typeof processCommandStreaming
  resetPromptCount: typeof resetPromptCount
} = {
  createLocal: createClaudeLocalAgent,
  createEC2: createClaudeEC2Agent,
  processStreaming: processCommandStreaming,
  resetPromptCount,
}
