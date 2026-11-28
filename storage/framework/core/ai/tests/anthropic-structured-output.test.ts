import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAIClient } from '../src/client'
import { anthropicJsonSchema, chat, configure, streamChatEvents } from '../src/drivers/anthropic'

// stacksjs/stacks#3380. Structured output used to be a synthetic tool the
// model was forced to call (`tool_choice: { type: 'tool' }`). Current Claude
// models (Opus 5.5, Sonnet 5.5, the default) refuse a forced tool choice with
// a 400, so every `responseFormat` request failed. The Messages API has a
// native JSON mode, `output_config.format`, and the answer comes back as text.

const ORIGINAL_FETCH = globalThis.fetch
let bodies: Array<Record<string, unknown>> = []

function respond(payload: unknown): void {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body || '{}')))
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

function streams(raw: string): void {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body || '{}')))
    return new Response(raw, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }) as typeof fetch
}

const sse = (...events: unknown[]): string => events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
const reply = (text: string) => ({ model: 'claude-sonnet-5-5', usage: { input_tokens: 3, output_tokens: 4 }, stop_reason: 'end_turn', content: [{ type: 'text', text }] })
const question = { role: 'user' as const, content: 'Who is this?' }

const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    age: { type: 'integer', minimum: 0, maximum: 150 },
    address: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
    tags: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' } } } },
  },
  required: ['name', 'age', 'address', 'tags'],
}

beforeEach(() => {
  configure({ apiKey: 'test-key' })
  bodies = []
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

describe('Anthropic structured output (stacksjs/stacks#3380)', () => {
  test('json_schema asks for the native JSON format and forces no tool', async () => {
    respond(reply('{"name":"Ada","age":36,"address":{"city":"London"},"tags":[]}'))
    const result = await chat([question], { responseFormat: { type: 'json_schema', json_schema: { name: 'user', schema: userSchema } } })

    expect(bodies[0]!.tool_choice).toBeUndefined()
    expect(bodies[0]!.tools).toBeUndefined()
    expect(bodies[0]!.output_config).toEqual({
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
            address: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false },
            tags: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' } }, additionalProperties: false } },
          },
          required: ['name', 'age', 'address', 'tags'],
          additionalProperties: false,
        },
      },
    })
    expect(JSON.parse(result.content)).toEqual({ name: 'Ada', age: 36, address: { city: 'London' }, tags: [] })
    expect(result.toolCalls).toBeUndefined()
  })

  test('leaves the caller\'s schema object as it was', async () => {
    respond(reply('{}'))
    const before = JSON.stringify(userSchema)
    await chat([question], { responseFormat: { type: 'json_schema', json_schema: { name: 'user', schema: userSchema } } })
    expect(JSON.stringify(userSchema)).toBe(before)
  })

  test('keeps Anthropic-compatible array bounds and describes the original limits', () => {
    const schema = {
      type: 'object',
      properties: {
        emptyAllowed: { type: 'array', minItems: 0, items: { type: 'string' } },
        channels: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
        drafts: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          description: 'Campaign drafts.',
          items: { type: 'array', minItems: 2, items: { type: 'string' } },
        },
      },
    }
    const original = structuredClone(schema)
    expect(anthropicJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        emptyAllowed: { type: 'array', minItems: 0, items: { type: 'string' } },
        channels: { type: 'array', minItems: 1, description: 'Return at most 4 items.', items: { type: 'string' } },
        drafts: {
          type: 'array',
          minItems: 1,
          description: 'Campaign drafts. Return exactly 3 items.',
          items: { type: 'array', minItems: 1, description: 'Return at least 2 items.', items: { type: 'string' } },
        },
      },
    })
    expect(schema).toEqual(original)
  })

  test('generateObject still enforces the original array count after Anthropic responds', async () => {
    const schema = {
      type: 'object',
      required: ['posts'],
      properties: { posts: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } } },
    }
    const client = createAIClient({ default: 'anthropic', drivers: { anthropic: { apiKey: 'test-key' } } })
    respond(reply('{"posts":["one"]}'))
    await expect(client.generateObject([question], schema, { attempts: 1 })).rejects.toThrow('must contain at least 3 items')
    expect(bodies[0]?.output_config).toEqual({ format: { type: 'json_schema', schema: anthropicJsonSchema(schema) } })

    respond(reply('{"posts":["one","two","three","four"]}'))
    await expect(client.generateObject([question], schema, { attempts: 1 })).rejects.toThrow('must contain at most 3 items')
  })

  test('with tools offered as well, the model still chooses for itself', async () => {
    respond(reply('{}'))
    const tools = [{ name: 'lookup', description: 'Look someone up', parameters: { type: 'object', properties: {} } }]
    await chat([question], { tools, responseFormat: { type: 'json_schema', json_schema: { name: 'user', schema: { type: 'object', properties: {} } } } })

    expect(bodies[0]!.tool_choice).toBeUndefined()
    expect((bodies[0]!.tools as Array<{ name: string }>).map(t => t.name)).toEqual(['lookup'])
  })

  test('json_object asks for one JSON object in the system prompt, with no tool', async () => {
    respond(reply('{"answer":42}'))
    const result = await chat([question], { system: 'Be brief.', responseFormat: { type: 'json_object' } })

    expect(bodies[0]!.tool_choice).toBeUndefined()
    expect(bodies[0]!.tools).toBeUndefined()
    expect(bodies[0]!.output_config).toBeUndefined()
    expect(String(bodies[0]!.system)).toStartWith('Be brief.')
    expect(String(bodies[0]!.system)).toContain('JSON object')
    expect(JSON.parse(result.content)).toEqual({ answer: 42 })
  })

  test('sends no sampling parameters the caller did not set', async () => {
    respond(reply('ok'))
    await chat([question])
    expect(Object.keys(bodies[0]!)).not.toContain('temperature')
    expect(Object.keys(bodies[0]!)).not.toContain('top_p')
  })

  test('a stream carries the JSON as text', async () => {
    streams(sse(
      { type: 'message_start', message: { model: 'claude-sonnet-5-5', usage: { input_tokens: 5 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '{"ok":' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'true}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 4 } },
    ))
    const seen = []
    for await (const event of streamChatEvents([question], { responseFormat: { type: 'json_schema', json_schema: { name: 'answer', schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } }))
      seen.push(event)

    expect(bodies[0]!.tool_choice).toBeUndefined()
    expect(bodies[0]!.output_config).toEqual({ format: { type: 'json_schema', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, additionalProperties: false } } })
    expect(seen.filter(e => e.type === 'text').map(e => (e as { text: string }).text).join('')).toBe('{"ok":true}')
  })
})
