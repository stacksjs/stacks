import type { AIMessage, AIProvider, ConfiguredAIOptions } from '@stacksjs/ai'

export interface BuddyProviderEnvironment {
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
}

export function resolveBuddyProvider(config: ConfiguredAIOptions): AIProvider {
  const value = String(config.default || 'openai').toLowerCase()
  if (value === 'anthropic' || value.startsWith('anthropic.'))
    return 'anthropic'
  if (value === 'ollama')
    return 'ollama'
  return 'openai'
}

export function isBuddyProviderConfigured(
  provider: AIProvider,
  config: ConfiguredAIOptions,
  environment: BuddyProviderEnvironment,
): boolean {
  if (provider === 'anthropic')
    return Boolean(config.drivers?.anthropic?.apiKey || environment.ANTHROPIC_API_KEY)
  if (provider === 'openai')
    return Boolean(config.drivers?.openai?.apiKey || environment.OPENAI_API_KEY)
  return true
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
