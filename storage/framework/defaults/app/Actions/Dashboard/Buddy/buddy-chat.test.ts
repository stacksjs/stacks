import { describe, expect, test } from 'bun:test'
import { buddySystemPrompt, isBuddyProviderConfigured, publicBuddyHistory, resolveBuddyProvider } from './buddy-chat'

describe('dashboard Buddy chat', () => {
  test('normalizes the configured provider', () => {
    expect(resolveBuddyProvider({ default: 'anthropic.claude-sonnet' })).toBe('anthropic')
    expect(resolveBuddyProvider({ default: 'ollama' })).toBe('ollama')
    expect(resolveBuddyProvider({ default: 'gpt-5' })).toBe('openai')
  })

  test('reports provider readiness without exposing keys', () => {
    expect(isBuddyProviderConfigured('openai', {}, { OPENAI_API_KEY: 'configured' })).toBe(true)
    expect(isBuddyProviderConfigured('anthropic', {}, {})).toBe(false)
    expect(isBuddyProviderConfigured('ollama', {}, {})).toBe(true)
  })

  test('only returns public text history', () => {
    const history = publicBuddyHistory([
      { role: 'system', content: 'private' },
      { role: 'user', content: 'Question' },
      { role: 'assistant', content: [{ type: 'text', text: 'Structured' }] },
      { role: 'assistant', content: 'Answer' },
    ])

    expect(history).toEqual([
      { role: 'user', content: 'Question' },
      { role: 'assistant', content: 'Answer' },
    ])
    expect(buddySystemPrompt()).toContain('Use buddy commands and Bun')
  })
})
