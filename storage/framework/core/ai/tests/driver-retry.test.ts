import { afterEach, describe, expect, test } from 'bun:test'
import { anthropic } from '../src/drivers/anthropic'
import { openai } from '../src/drivers/openai'

/**
 * `chat()` and `streamChat()` called `fetch` directly, so a 429 from Anthropic
 * or OpenAI failed the call outright; only the legacy `process()` path went
 * through `fetchWithRetry`. They retry rate limits now, waiting what
 * `Retry-After` asks.
 */

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function rateLimitedOnce(success: () => Response): string[] {
  const calls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input))
    if (calls.length === 1)
      return new Response('{"error":{"type":"rate_limit_error"}}', { status: 429, headers: { 'Retry-After': '0' } })
    return success()
  }) as typeof fetch
  return calls
}

describe('hosted drivers retry a rate limit', () => {
  test('anthropic.chat', async () => {
    anthropic.configure({ apiKey: 'test-key', model: 'claude-sonnet-5-5' })
    const calls = rateLimitedOnce(() => Response.json({
      model: 'claude-sonnet-5-5',
      content: [{ type: 'text', text: 'hello' }],
      usage: { input_tokens: 1, output_tokens: 1 },
      stop_reason: 'end_turn',
    }))

    expect((await anthropic.chat([{ role: 'user', content: 'hi' }])).content).toBe('hello')
    expect(calls).toHaveLength(2)
  })

  test('openai.embed', async () => {
    openai.configure({ apiKey: 'test-key' })
    const calls = rateLimitedOnce(() => Response.json({ data: [{ embedding: [0.1, 0.2] }] }))

    expect(await openai.embed('hi')).toEqual([0.1, 0.2])
    expect(calls).toHaveLength(2)
  })
})
