/**
 * Buddy - Voice AI Code Assistant Shared Service
 *
 * This module contains the shared state and utilities for Buddy actions.
 * Derived from buddy-service.ts for use with Stacks framework.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Types
export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

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

export interface AIDriver {
  name: string
  process: (command: string, context: string, history: AIMessage[]) => Promise<string>
}

// Configuration
export const CONFIG = {
  workDir: join(homedir(), 'Code', '.buddy-repos'),
  commitMessage: 'chore: wip',
  ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
}

// API Keys state (can be set at runtime via settings endpoint)
export const apiKeys: { anthropic?: string, openai?: string, claudeCliHost?: string } = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  claudeCliHost: process.env.BUDDY_EC2_HOST,
}

// State singleton
const state: BuddyState = {
  repo: null,
  conversationHistory: [],
  currentDriver: 'claude',
  github: null,
}

// Ensure work directory exists
if (!existsSync(CONFIG.workDir)) {
  mkdirSync(CONFIG.workDir, { recursive: true })
}

// Buddy State Manager
export const buddyState = {
  getState: () => state,
  setRepo: (repo: RepoState | null) => { state.repo = repo },
  setCurrentDriver: (driver: string) => { state.currentDriver = driver },
  setGitHub: (github: GitHubCredentials | null) => { state.github = github },
  addToHistory: (message: AIMessage) => { state.conversationHistory.push(message) },
  clearHistory: () => { state.conversationHistory = [] },
}

// Build system prompt for AI
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

// AI Drivers
export const drivers: Record<string, AIDriver> = {
  claude: {
    name: 'Claude',
    async process(command: string, context: string, history: AIMessage[]): Promise<string> {
      const apiKey = apiKeys.anthropic
      if (!apiKey) {
        throw new Error('Anthropic API key not set. Configure your API key in settings.')
      }

      const systemPrompt = buildSystemPrompt(context)

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [...history, { role: 'user', content: command }],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude API error: ${error}`)
      }

      const data = (await response.json()) as { content: Array<{ text: string }> }
      return data.content[0].text
    },
  },

  openai: {
    name: 'OpenAI',
    async process(command: string, context: string, history: AIMessage[]): Promise<string> {
      const apiKey = apiKeys.openai
      if (!apiKey) {
        throw new Error('OpenAI API key not set. Configure your API key in settings.')
      }

      const systemPrompt = buildSystemPrompt(context)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: command },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${error}`)
      }

      const data = (await response.json()) as { choices: Array<{ message: { content: string } }> }
      return data.choices[0].message.content
    },
  },

  ollama: {
    name: 'Ollama',
    async process(command: string, context: string, history: AIMessage[]): Promise<string> {
      const systemPrompt = buildSystemPrompt(context)

      const response = await fetch(`${CONFIG.ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: command },
          ],
          stream: false,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${error}`)
      }

      const data = (await response.json()) as { message: { content: string } }
      return data.message.content
    },
  },

  mock: {
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
  },
}

export function getAvailableDrivers(): string[] {
  return Object.keys(drivers)
}

/**
 * Get repository structure for context
 */
export async function getRepoContext(repoPath: string): Promise<string> {
  const { $ } = await import('bun')
  const treeResult
    = await $`cd ${repoPath} && find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -name "*.lock" | head -50`.quiet()
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
  const { $ } = await import('bun')
  let repoPath: string
  let repoName: string

  if (input.includes('github.com') || input.startsWith('git@')) {
    repoName = input.split('/').pop()?.replace('.git', '') || 'repo'
    repoPath = join(CONFIG.workDir, repoName)

    if (existsSync(repoPath)) {
      console.log(`Repository already exists, pulling latest...`)
      await $`cd ${repoPath} && git pull --rebase`.quiet()
    }
    else {
      console.log(`Cloning ${input}...`)
      await $`git clone ${input} ${repoPath}`.quiet()
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

  const branchResult = await $`cd ${repoPath} && git branch --show-current`.quiet()
  const branch = branchResult.text().trim()

  const statusResult = await $`cd ${repoPath} && git status --porcelain`.quiet()
  const hasChanges = statusResult.text().trim().length > 0

  const lastCommitResult = await $`cd ${repoPath} && git log -1 --format="%h %s"`.quiet()
  const lastCommit = lastCommitResult.text().trim()

  const repoState: RepoState = {
    path: repoPath,
    name: repoName,
    branch,
    hasChanges,
    lastCommit,
  }

  buddyState.setRepo(repoState)
  buddyState.clearHistory() // Reset conversation for new repo
  return repoState
}

/**
 * Process command with selected AI driver
 */
export async function processCommand(command: string, driverName?: string): Promise<string> {
  const currentState = buddyState.getState()

  if (!currentState.repo) {
    throw new Error('No repository opened')
  }

  const driver = drivers[driverName || currentState.currentDriver]
  if (!driver) {
    throw new Error(`Unknown driver: ${driverName || currentState.currentDriver}`)
  }

  if (driverName) {
    buddyState.setCurrentDriver(driverName)
  }

  const context = await getRepoContext(currentState.repo.path)
  const response = await driver.process(command, context, currentState.conversationHistory)

  // Update conversation history
  buddyState.addToHistory({ role: 'user', content: command })
  buddyState.addToHistory({ role: 'assistant', content: response })

  return response
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
  if (!currentState.repo || !currentState.github)
    return

  const { $ } = await import('bun')
  const { name, email } = currentState.github

  // Set local git config for this repo
  await $`cd ${currentState.repo.path} && git config user.name ${name}`.quiet()
  await $`cd ${currentState.repo.path} && git config user.email ${email}`.quiet()

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

  const { $ } = await import('bun')

  // Configure git user if GitHub is connected
  if (currentState.github) {
    await configureGitUser()
  }

  await $`cd ${currentState.repo.path} && git add -A`.quiet()
  await $`cd ${currentState.repo.path} && git commit -m ${CONFIG.commitMessage}`.quiet()

  const hashResult = await $`cd ${currentState.repo.path} && git rev-parse --short HEAD`.quiet()
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

  const { $ } = await import('bun')
  await $`cd ${currentState.repo.path} && git push`.quiet()
}
