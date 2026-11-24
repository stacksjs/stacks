import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chat, configure } from '../src/drivers/anthropic'

// stacksjs/stacks#1878 A-1 — pins the Anthropic tools + JSON-mode
// request-body mapping. Tests capture the outbound fetch request
// body and assert the structural shape (no live API calls).

const ORIGINAL_FETCH = globalThis.fetch

let lastRequest: { url: string, body: Record<string, unknown> } | null = null

function mockFetch(responseBody: unknown): void {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    lastRequest = {
      url: typeof input === 'string' ? input : input.toString(),
      body: JSON.parse((init?.body as string) || '{}'),
    }
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

beforeEach(() => {
  configure({ apiKey: 'test-key' })
  lastRequest = null
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  lastRequest = null
})

describe('Anthropic driver tools + responseFormat (stacksjs/stacks#1878 A-1)', () => {
  test('passes tools through to the Anthropic Messages API as input_schema', async () => {
    mockFetch({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4',
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: 'end_turn',
    })

    await chat([{ role: 'user', content: 'hi' }], {
      tools: [
        {
          name: 'get_weather',
          description: 'Get the current weather',
          parameters: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
          },
        },
      ],
    })

    expect(lastRequest?.body.tools).toEqual([
      {
        name: 'get_weather',
        description: 'Get the current weather',
        input_schema: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      },
    ])
  })

  // json_schema and json_object: tests/anthropic-structured-output.test.ts.
  // They were a synthetic tool with a forced tool_choice, which current
  // models refuse (stacksjs/stacks#3380).

  test('responseFormat: text is a no-op (no tools added)', async () => {
    mockFetch({
      content: [{ type: 'text', text: 'freeform reply' }],
      model: 'claude-sonnet-4',
      usage: { input_tokens: 5, output_tokens: 5 },
      stop_reason: 'end_turn',
    })

    const result = await chat([{ role: 'user', content: 'hi' }], {
      responseFormat: { type: 'text' },
    })

    expect(lastRequest?.body.tools).toBeUndefined()
    expect(result.content).toBe('freeform reply')
  })

  test('toolChoice "required" maps to type:any', async () => {
    mockFetch({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4',
      usage: { input_tokens: 5, output_tokens: 5 },
    })

    await chat([{ role: 'user', content: 'hi' }], {
      tools: [{ name: 't', parameters: { type: 'object' } }],
      toolChoice: 'required',
    })

    expect(lastRequest?.body.tool_choice).toEqual({ type: 'any' })
  })

  test('toolChoice with explicit name maps correctly', async () => {
    mockFetch({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4',
      usage: { input_tokens: 5, output_tokens: 5 },
    })

    await chat([{ role: 'user', content: 'hi' }], {
      tools: [{ name: 'specific_tool', parameters: { type: 'object' } }],
      toolChoice: { name: 'specific_tool' },
    })

    expect(lastRequest?.body.tool_choice).toEqual({ type: 'tool', name: 'specific_tool' })
  })
})
