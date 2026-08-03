import { afterEach, describe, expect, test } from 'bun:test'
import { createAIClient, getAIProviderConfiguration, parseAIObject, resolveAIProvider, validateAISchema } from '../src/client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('configured AI client', () => {
  test('selects the configured driver and forwards OpenAI JSON schema', async () => {
    let requestBody: any
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({
        model: 'gpt-test',
        choices: [{ message: { content: '{"answer":"fixed"}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
      }), { status: 200 })
    }) as typeof fetch

    const client = createAIClient({
      default: 'openai',
      drivers: { openai: { apiKey: 'test', model: 'gpt-test' } },
    })
    const schema = {
      type: 'object',
      required: ['answer'],
      additionalProperties: false,
      properties: { answer: { type: 'string' } },
    }
    const { data } = await client.generateObject<{ answer: string }>([
      { role: 'user', content: 'Fix it' },
    ], schema)

    expect(client.provider).toBe('openai')
    expect(client.configuration).toEqual({
      provider: 'openai',
      model: 'gpt-test',
      configured: true,
      source: 'config',
    })
    expect(data.answer).toBe('fixed')
    expect(requestBody.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'structured_output', schema, strict: true },
    })
  })

  test('retries once when generated JSON fails validation', async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      const content = calls === 1 ? '{"wrong":true}' : '{"answer":"fixed"}'
      return new Response(JSON.stringify({
        model: 'gpt-test',
        choices: [{ message: { content }, finish_reason: 'stop' }],
        usage: {},
      }), { status: 200 })
    }) as typeof fetch

    const client = createAIClient({ default: 'openai', drivers: { openai: { apiKey: 'test' } } })
    const { data } = await client.generateObject<{ answer: string }>([{ role: 'user', content: 'Fix it' }], {
      type: 'object',
      required: ['answer'],
      properties: { answer: { type: 'string' } },
    })

    expect(calls).toBe(2)
    expect(data.answer).toBe('fixed')
  })

  test('parses fenced JSON and validates nested values', () => {
    expect(parseAIObject('```json\n{"files":[{"path":"src/a.ts"}]}\n```')).toEqual({ files: [{ path: 'src/a.ts' }] })
    expect(validateAISchema({ files: [] }, {
      type: 'object',
      required: ['files'],
      properties: { files: { type: 'array', minItems: 1 } },
    })).toEqual(['$.files must contain at least 1 items'])
  })

  test('rejects unsupported legacy model defaults with an actionable error', () => {
    expect(() => createAIClient({ default: 'meta.llama3-70b-instruct-v1:0' })).toThrow('Unsupported configured AI driver')
  })

  test('resolves provider aliases and exposes safe configuration metadata', () => {
    expect(resolveAIProvider({ default: 'gpt-4o-mini' })).toBe('openai')
    expect(getAIProviderConfiguration({ default: 'gpt-4o-mini' }, undefined, {
      OPENAI_API_KEY: 'secret-that-must-not-be-returned',
    })).toEqual({
      provider: 'openai',
      model: 'gpt-4o-mini',
      configured: true,
      source: 'environment',
    })
  })

  test('reports missing remote credentials without making a request', () => {
    expect(getAIProviderConfiguration({ default: 'anthropic' }, undefined, {})).toEqual({
      provider: 'anthropic',
      model: undefined,
      configured: false,
      source: 'none',
    })
  })

  test('treats custom base URLs and Ollama as configured runtimes', () => {
    expect(getAIProviderConfiguration({
      default: 'openai',
      drivers: { openai: { baseUrl: 'http://localhost:8080/v1', model: 'local-model' } },
    }, undefined, {})).toEqual({
      provider: 'openai',
      model: 'local-model',
      configured: true,
      source: 'base-url',
    })
    expect(getAIProviderConfiguration({
      default: 'ollama',
      drivers: { ollama: { model: 'llama3.2' } },
    }, undefined, {})).toEqual({
      provider: 'ollama',
      model: 'llama3.2',
      configured: true,
      source: 'local',
    })
  })
})
