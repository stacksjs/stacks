import { dashboardApi } from './dashboard-api'

export interface BuddyChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface BuddyChatState {
  /** `null` when config/ai.ts names a provider Stacks has no driver for. */
  provider: 'anthropic' | 'openai' | 'ollama' | 'bedrock' | null
  configured: boolean
  /** Why Buddy cannot answer yet. */
  problem: string | null
  /** The environment key that would configure the provider, when one would. */
  missingKey: string | null
  history: BuddyChatMessage[]
  repository: {
    name: string
    branch: string
    path: string
  } | null
}

export interface BuddyChatResponse {
  content: string
  provider: NonNullable<BuddyChatState['provider']>
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  } | null
}

export async function fetchBuddyChat(): Promise<BuddyChatState> {
  return await dashboardApi<BuddyChatState>('/api/dashboard/buddy/chat')
}

export async function askBuddy(message: string): Promise<BuddyChatResponse> {
  return await dashboardApi<BuddyChatResponse>('/api/dashboard/buddy/chat', {
    method: 'POST',
    body: { message },
  })
}

export async function clearBuddyChat(): Promise<{ success: true }> {
  return await dashboardApi<{ success: true }>('/api/dashboard/buddy/chat/clear', {
    method: 'POST',
  })
}
