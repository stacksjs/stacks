import type { AIMessage, AIProvider, ConfiguredAIOptions } from '@stacksjs/ai'
import { getAIProviderConfiguration } from '@stacksjs/ai'

/**
 * The keys this check reads out of the environment.
 *
 * The index signature is what makes `process.env` assignable: `ProcessEnv`
 * declares no named members, so a bare interface shares nothing with it and
 * TypeScript rejects the call - the one thing every caller passes.
 */
export interface BuddyProviderEnvironment {
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  [key: string]: string | undefined
}

export interface BuddyProviderStatus {
  /** `null` when config/ai.ts names a provider Stacks has no driver for. */
  provider: AIProvider | null
  configured: boolean
  /** Why Buddy cannot answer yet, for the dashboard to show as is. */
  problem: string | null
  /** The environment key that would configure the provider, when one would. */
  missingKey: string | null
}

const PROVIDER_KEYS: Partial<Record<AIProvider, string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
}

/**
 * Which provider Buddy answers with and whether it can, from the same
 * resolution `createAIClient()` uses. Buddy kept its own copy, which sent
 * every default it did not recognise - a Bedrock model, `bedrock`, a typo -
 * to OpenAI, and treated a provider reachable through a `baseUrl` as
 * unconfigured. An unconfigured app still defaults to OpenAI.
 */
export function buddyProviderStatus(
  config: ConfiguredAIOptions,
  environment: BuddyProviderEnvironment = process.env,
): BuddyProviderStatus {
  let configuration
  try {
    configuration = getAIProviderConfiguration({ ...config, default: config.default || 'openai' }, undefined, environment)
  }
  catch (error) {
    return { provider: null, configured: false, problem: (error as Error).message, missingKey: null }
  }

  if (configuration.configured)
    return { provider: configuration.provider, configured: true, problem: null, missingKey: null }

  const missingKey = PROVIDER_KEYS[configuration.provider] ?? null
  return {
    provider: configuration.provider,
    configured: false,
    problem: missingKey ? `${missingKey} is not configured.` : `${configuration.provider} is not configured.`,
    missingKey,
  }
}

export function buddySystemPrompt(): string {
  return `You are Buddy, the Stacks framework assistant. Give concise, accurate help for a Bun and TypeScript Stacks application.

Follow Stacks conventions:
- Use buddy commands and Bun, not npm, pnpm, yarn, or direct eslint commands.
- Use defineModel with model-driven migrations and the useApi trait when a model should expose CRUD APIs.
- Use server actions and guarded routes for dashboard operations.
- Use stx signals, composables, components, and Crosswind utilities for frontend work.
- Never invent an API. If you are uncertain, say what should be verified in the repository skills.

This chat answers questions only. It does not edit files or run commands.`
}

export function publicBuddyHistory(history: AIMessage[], limit = 50): Array<{ role: 'user' | 'assistant', content: string }> {
  return history
    .filter((message): message is AIMessage & { role: 'user' | 'assistant', content: string } =>
      (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string',
    )
    .slice(-limit)
    .map(message => ({ role: message.role, content: message.content }))
}
