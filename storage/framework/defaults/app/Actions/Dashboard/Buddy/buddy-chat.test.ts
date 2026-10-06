import { describe, expect, test } from 'bun:test'
import { buddyProviderStatus, buddySystemPrompt, publicBuddyHistory } from './buddy-chat'

describe('dashboard Buddy chat', () => {
  test('resolves the provider the way createAIClient() does', () => {
    expect(buddyProviderStatus({ default: 'claude-sonnet-5-5' }, { ANTHROPIC_API_KEY: 'k' }).provider).toBe('anthropic')
    expect(buddyProviderStatus({ default: 'ollama' }, {}).provider).toBe('ollama')
    expect(buddyProviderStatus({ default: 'gpt-5' }, { OPENAI_API_KEY: 'k' }).provider).toBe('openai')
    expect(buddyProviderStatus({}, { OPENAI_API_KEY: 'k' }).provider).toBe('openai')
    // A Bedrock id is Bedrock, not the first-party Anthropic API, and not
    // OpenAI, which is where Buddy's own copy of this sent it.
    expect(buddyProviderStatus({ default: 'global.anthropic.claude-sonnet-5-5' }, {}).provider).toBe('bedrock')
    expect(buddyProviderStatus({ default: 'bedrock' }, {})).toEqual({ provider: 'bedrock', configured: true, problem: null, missingKey: null })
  })

  test('reports provider readiness without exposing keys', () => {
    expect(buddyProviderStatus({ default: 'openai' }, { OPENAI_API_KEY: 'configured' }).configured).toBe(true)
    expect(buddyProviderStatus({ default: 'anthropic' }, {}))
      .toEqual({ provider: 'anthropic', configured: false, problem: 'ANTHROPIC_API_KEY is not configured.', missingKey: 'ANTHROPIC_API_KEY' })
    expect(buddyProviderStatus({ default: 'ollama' }, {}).configured).toBe(true)
    // A provider reached through a base URL needs no key.
    expect(buddyProviderStatus({ default: 'openai', drivers: { openai: { baseUrl: 'http://localhost:1234/v1' } } }, {}).configured).toBe(true)
  })

  test('names an unsupported default instead of answering with OpenAI', () => {
    const status = buddyProviderStatus({ default: 'mistral-large' }, { OPENAI_API_KEY: 'k' })
    expect(status.provider).toBeNull()
    expect(status.configured).toBe(false)
    expect(status.problem).toContain('Unsupported configured AI driver: mistral-large')
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
