/**
 * Buddy - Voice AI Code Assistant
 *
 * This module contains the shared state and utilities for Buddy,
 * an AI-powered code assistant that helps users modify codebases
 * through voice commands.
 */

import type {
  AIDriver,
  AIMessage,
  BuddyApiKeys,
  BuddyConfig,
  BuddyState,
  GitHubCredentials,
  RepoState,
  StreamingResult,
} from './types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { claudeAgent } from './agents'
import { createAnthropicDriver, createClaudeAgentSDKDriver, createOllamaDriver, createOpenAIDriver } from './drivers'

// =============================================================================
// Configuration
// =============================================================================

export const CONFIG: BuddyConfig = {
  workDir: join(homedir(), 'Code', '.buddy-repos'),
  commitMessage: 'chore: wip',
  ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
}

// API Keys state (can be set at runtime via settings endpoint)
export const apiKeys: BuddyApiKeys = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  claudeCliHost: process.env.BUDDY_EC2_HOST,
}

// =============================================================================
// State Management
// =============================================================================

// State singleton
const state: BuddyState = {
  repo: null,
  conversationHistory: [],
  currentDriver: 'claude-cli-local',
  github: null,
}

// Ensure work directory exists
if (!existsSync(CONFIG.workDir)) {
  mkdirSync(CONFIG.workDir, { recursive: true })
}

// Buddy State Manager
export interface BuddyStateManager {
  getState: () => BuddyState
  setRepo: (repo: RepoState | null) => void
  setCurrentDriver: (driver: string) => void
  setGitHub: (github: GitHubCredentials | null) => void
  addToHistory: (message: AIMessage) => void
  clearHistory: () => void
}

export const buddyState: BuddyStateManager = {
  getState: (): BuddyState => state,
  setRepo: (repo: RepoState | null): void => { state.repo = repo },
  setCurrentDriver: (driver: string): void => { state.currentDriver = driver },
  setGitHub: (github: GitHubCredentials | null): void => { state.github = github },
  addToHistory: (message: AIMessage): void => { state.conversationHistory.push(message) },
  clearHistory: (): void => { state.conversationHistory = [] },
}

// =============================================================================
// AI Driver Utilities
// =============================================================================

/**
 * Build system prompt for AI with repository context
 */
export function buildSystemPrompt(context: string): string {
  return `You are Buddy, an AI code assistant that helps users modify codebases through voice commands.

${state.repo
    ? `You are working on the repository: ${state.repo.name}
Branch: ${state.repo.branch}
Path: ${state.repo.path}

${context}`
    : 'No repository is currently open.'}

When the user gives you a command:
1. Analyze what they want to do
2. Identify the files that need to be modified
3. Generate the exact code changes needed
4. Respond with a structured format showing:
  - Summary of changes
  - Files to modify/create with full content
  - Any additional notes

Format file changes as:
FILE: path/to/file.ts
\`\`\`typescript
// Full file content
\`\`\`

Be concise but thorough. The user will review and commit your changes.`
}

/**
 * Create a mock driver for testing
 */
function createMockDriver(): AIDriver {
  return {
    name: 'Mock',
    async process(command: string): Promise<string> {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const lowerCommand = command.toLowerCase()

      if (lowerCommand.includes('readme') || lowerCommand.includes('documentation')) {
        return `I'll update the README.md file for you.

Analyzing the repository structure...

FILE: README.md
\`\`\`markdown
# Project Name

## Installation

\`\`\`bash
npm install
# or
bun install
\`\`\`

## Usage

\`\`\`bash
npm run start
\`\`\`
\`\`\`

File modified: README.md
Lines added: 12`
      }

      if (lowerCommand.includes('fix') || lowerCommand.includes('bug')) {
        return `I'll analyze and fix the issue.

Scanning for potential bugs...

FILE: src/utils.ts
\`\`\`typescript
export function getData(data: { value?: string }) {
  return data?.value ?? 'default';
}
\`\`\`

Files modified: src/utils.ts
Lines changed: 4`
      }

      return `I understand you want to: "${command}"

I'll analyze the repository and implement this change.

FILE: src/main.ts
\`\`\`typescript
// Updated based on your request
export function main() {
  console.log('Changes applied');
}
\`\`\`

Files modified: 1`
    },
  }
}

/**
 * Get driver instance by name
 */
export function getDriver(driverName: string): AIDriver {
  const currentState = buddyState.getState()

  switch (driverName) {
    case 'claude-cli-local':
      return claudeAgent.createLocal({ cwd: currentState.repo?.path })

    case 'claude-cli-ec2':
      return claudeAgent.createEC2({
        cwd: currentState.repo?.path,
        ec2Host: apiKeys.claudeCliHost,
      })

    case 'claude':
    case 'anthropic':
      if (!apiKeys.anthropic) {
        throw new Error('Anthropic API key not set. Configure your API key in settings.')
      }
      return createAnthropicDriver({ apiKey: apiKeys.anthropic })

    case 'openai':
      if (!apiKeys.openai) {
        throw new Error('OpenAI API key not set. Configure your API key in settings.')
      }
      return createOpenAIDriver({ apiKey: apiKeys.openai })

    case 'ollama':
      return createOllamaDriver({
        host: CONFIG.ollamaHost,
        model: CONFIG.ollamaModel,
      })

    case 'claude-sdk':
    case 'claude-agent-sdk':
      return createClaudeAgentSDKDriver({
        cwd: currentState.repo?.path,
        maxTurns: 25,
        permissionMode: 'bypassPermissions',
      })

    case 'mock':
      return createMockDriver()

    default:
      throw new Error(`Unknown driver: ${driverName}. Available: claude-cli-local, claude-cli-ec2, claude, claude-sdk, openai, ollama, mock`)
  }
}

/**
 * Get list of available AI drivers
 */
export function getAvailableDrivers(): string[] {
  return ['claude-cli-local', 'claude-cli-ec2', 'claude', 'claude-sdk', 'openai', 'ollama', 'mock']
}

// =============================================================================
// Repository Operations
// =============================================================================

/**
 * Get repository structure for context
 */
export async function getRepoContext(repoPath: string): Promise<string> {
  const { $: _$ } = await import('bun')
  const treeResult = await _$`cd ${repoPath} && find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -name "*.lock" | head -50`.quiet()
  const files = treeResult.text().trim()

  let readme = ''
  const readmePath = join(repoPath, 'README.md')
  if (existsSync(readmePath)) {
    readme = readFileSync(readmePath, 'utf-8').slice(0, 2000)
  }

  let packageJson = ''
  const packagePath = join(repoPath, 'package.json')
  if (existsSync(packagePath)) {
    packageJson = readFileSync(packagePath, 'utf-8')
  }

  return `
Repository Structure:
${files}

${readme ? `README.md (excerpt):\n${readme}\n` : ''}
${packageJson ? `package.json:\n${packageJson}\n` : ''}
`.trim()
}

/**
 * Clone or open a repository
 */
export async function openRepository(input: string): Promise<RepoState> {
  const { $: _$ } = await import('bun')
  let repoPath: string
  let repoName: string

  if (input.includes('github.com') || input.startsWith('git@')) {
    repoName = input.split('/').pop()?.replace('.git', '') || 'repo'
    repoPath = join(CONFIG.workDir, repoName)

    if (existsSync(repoPath)) {
      console.log(`Repository already exists, pulling latest...`)
      await _$`cd ${repoPath} && git pull --rebase`.quiet()
    }
    else {
      console.log(`Cloning ${input}...`)
      await _$`git clone ${input} ${repoPath}`.quiet()
    }
  }
  else {
    repoPath = input.startsWith('~') ? input.replace('~', homedir()) : input

    if (!existsSync(repoPath)) {
      throw new Error(`Local path does not exist: ${repoPath}`)
    }

    if (!existsSync(join(repoPath, '.git'))) {
      throw new Error(`Not a git repository: ${repoPath}`)
    }

    repoName = repoPath.split('/').pop() || 'repo'
  }

  const branchResult = await _$`cd ${repoPath} && git branch --show-current`.quiet()
  const branch = branchResult.text().trim()

  const statusResult = await _$`cd ${repoPath} && git status --porcelain`.quiet()
  const hasChanges = statusResult.text().trim().length > 0

  const lastCommitResult = await _$`cd ${repoPath} && git log -1 --format="%h %s"`.quiet()
  const lastCommit = lastCommitResult.text().trim()

  const repoState: RepoState = {
    path: repoPath,
    name: repoName,
    branch,
    hasChanges,
    lastCommit,
  }

  buddyState.setRepo(repoState)
  buddyState.clearHistory()
  return repoState
}

/**
 * Apply file changes from AI response
 */
export async function applyChanges(aiResponse: string): Promise<string[]> {
  const currentState = buddyState.getState()

  if (!currentState.repo) {
    throw new Error('No repository opened')
  }

  const modifiedFiles: string[] = []
  const filePattern = /FILE:\s*([^\n]+)\n```\w*\n([\s\S]*?)```/g

  for (const match of aiResponse.matchAll(filePattern)) {
    const filePath = match[1].trim()
    const content = match[2]

    const fullPath = join(currentState.repo.path, filePath)

    const dir = dirname(fullPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(fullPath, content)
    modifiedFiles.push(filePath)
    console.log(`Modified: ${filePath}`)
  }

  if (modifiedFiles.length > 0 && currentState.repo) {
    currentState.repo.hasChanges = true
  }

  return modifiedFiles
}

/**
 * Configure git user for commits
 */
export async function configureGitUser(): Promise<void> {
  const currentState = buddyState.getState()
  if (!currentState.repo || !currentState.github) return

  const { $: _$ } = await import('bun')
  const { name, email } = currentState.github

  await _$`cd ${currentState.repo.path} && git config user.name ${name}`.quiet()
  await _$`cd ${currentState.repo.path} && git config user.email ${email}`.quiet()

  console.log(`Git configured for ${name} <${email}>`)
}

/**
 * Stage and commit changes
 */
export async function commitChanges(): Promise<string> {
  const currentState = buddyState.getState()

  if (!currentState.repo) {
    throw new Error('No repository opened')
  }

  const { $: _$ } = await import('bun')

  if (currentState.github) {
    await configureGitUser()
  }

  await _$`cd ${currentState.repo.path} && git add -A`.quiet()
  await _$`cd ${currentState.repo.path} && git commit -m ${CONFIG.commitMessage}`.quiet()

  const hashResult = await _$`cd ${currentState.repo.path} && git rev-parse --short HEAD`.quiet()
  const commitHash = hashResult.text().trim()

  currentState.repo.hasChanges = false
  currentState.repo.lastCommit = commitHash

  return commitHash
}

/**
 * Push changes to remote
 */
export async function pushChanges(): Promise<void> {
  const currentState = buddyState.getState()

  if (!currentState.repo) {
    throw new Error('No repository opened')
  }

  const { $: _$ } = await import('bun')
  await _$`cd ${currentState.repo.path} && git push`.quiet()
}

// =============================================================================
// Command Processing
// =============================================================================

/**
 * Process command with selected AI driver
 */
export async function processCommand(command: string, driverName?: string): Promise<string> {
  const currentState = buddyState.getState()

  if (!currentState.repo) {
    throw new Error('No repository opened')
  }

  const normalizedDriver = driverName || currentState.currentDriver
  const driver = getDriver(normalizedDriver)

  if (driverName) {
    buddyState.setCurrentDriver(driverName)
  }

  const context = await getRepoContext(currentState.repo.path)
  const systemPrompt = buildSystemPrompt(context)
  const response = await driver.process(command, systemPrompt, currentState.conversationHistory)

  buddyState.addToHistory({ role: 'user', content: command })
  buddyState.addToHistory({ role: 'assistant', content: response })

  return response
}

/**
 * Process command with streaming output using Claude CLI
 */
export async function buddyProcessStreaming(
  command: string,
  driverName?: string,
  history?: Array<{role: string; content: string}>,
): Promise<StreamingResult> {
  const currentState = buddyState.getState()

  if (!currentState.repo) {
    throw new Error('No repository opened')
  }

  const normalizedDriver = driverName || currentState.currentDriver
  const streamingDrivers = ['claude-cli-local', 'claude-sdk']
  if (!streamingDrivers.includes(normalizedDriver)) {
    throw new Error(`Streaming only supported for ${streamingDrivers.join(', ')} drivers. Current: ${normalizedDriver}`)
  }

  if (driverName) {
    buddyState.setCurrentDriver(driverName)
  }

  // Build command with conversation history for context
  let contextualCommand = command
  if (history && history.length > 0) {
    let conversationContext = '## Previous Conversation\nHere is our conversation so far:\n\n'
    for (const msg of history) {
      const role = msg.role === 'user' ? 'User' : 'Assistant'
      conversationContext += `**${role}:** ${msg.content}\n\n`
    }
    conversationContext += '---\n\n## Current Request\n'
    contextualCommand = conversationContext + command
  }

  const result = await claudeAgent.processStreaming(contextualCommand, currentState.repo.path)

  // Update history when streaming completes
  result.fullResponse.then((response) => {
    buddyState.addToHistory({ role: 'user', content: command })
    buddyState.addToHistory({ role: 'assistant', content: response })
  })

  return result
}

/**
 * Stream a simple Q&A response using the Anthropic API directly.
 * This provides true token-by-token streaming like ChatGPT/Claude web.
 * Use this for questions/explanations that don't require agentic tool use.
 */
export async function buddyStreamSimple(
  command: string,
  history?: Array<{ role: string; content: string }>,
): Promise<StreamingResult> {

  if (!apiKeys.anthropic) {
    throw new Error('Anthropic API key not set. Configure your API key in settings.')
  }

  // Build conversation messages
  const messages: AIMessage[] = []
  if (history && history.length > 0) {
    for (const msg of history) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })
    }
  }
  messages.push({ role: 'user', content: command })

  // For simple Q&A mode, use a generic helpful assistant prompt
  // Don't include repo context - this keeps answers general and not code-focused
  const systemPrompt = `You are a helpful AI assistant. Answer questions naturally and conversationally.
You can discuss any topic - technology, science, philosophy, everyday questions, or anything else the user asks about.
Be concise but thorough. If the user asks about coding or their project specifically, help with that too.`

  const encoder = new TextEncoder()
  let fullResponse = ''
  let resolveFullResponse: (value: string) => void
  const fullResponsePromise = new Promise<string>((resolve) => {
    resolveFullResponse = resolve
  })

  // Create streaming response using Anthropic API
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKeys.anthropic!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            stream: true,
            messages,
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Claude API error: ${error}`)
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
                const event = JSON.parse(data)
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  const text = event.delta.text
                  fullResponse += text
                  controller.enqueue(encoder.encode(text))
                }
              }
              catch {
                // Skip invalid JSON
              }
            }
          }
        }

        // Update history and resolve the full response
        buddyState.addToHistory({ role: 'user', content: command })
        buddyState.addToHistory({ role: 'assistant', content: fullResponse })
        resolveFullResponse(fullResponse)
        controller.close()
      }
      catch (error) {
        resolveFullResponse(fullResponse) // Resolve with what we have
        controller.error(error)
      }
    },
  })

  return {
    stream,
    fullResponse: fullResponsePromise,
  }
}
