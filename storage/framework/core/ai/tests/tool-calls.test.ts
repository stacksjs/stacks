import type { AIMessage, AITool } from '../src/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { anthropic } from '../src/drivers/anthropic'
import { bedrock } from '../src/drivers/bedrock'
import { ollama } from '../src/drivers/ollama'
import { openai } from '../src/drivers/openai'
import { assistantTurn, toolResultsTurn } from '../src/utils/tools'

/**
 * Tool calls from every driver, in one shape, and back again.
 *
 * `AIResult` had nowhere to put a tool call. OpenAI's driver returned
 * `content: null` and dropped the calls; Anthropic's and Bedrock's
 * stringified the first call's arguments into `content`, losing its name, its
 * id and any other call; Ollama's never sent the tools. None of them could
 * send a result back.
 */

const originalFetch = globalThis.fetch
const savedEnv = { ...process.env }

let requests: Array<{ url: string, body: any }> = []

function respond(...bodies: unknown[]): void {
  requests = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return Response.json(bodies[Math.min(requests.length - 1, bodies.length - 1)])
  }) as typeof fetch
}

const weather: AITool = {
  name: 'get_weather',
  description: 'Current weather for a city',
  parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
}

const question: AIMessage = { role: 'user', content: 'Weather in Paris and Rome?' }

beforeEach(() => {
  process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE'
  process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
  anthropic.configure({ apiKey: 'test-key' })
  openai.configure({ apiKey: 'test-key' })
  ollama.configure({ host: 'http://ollama.test' })
  bedrock.configure({ model: 'amazon.nova-lite-v1:0', region: 'us-east-1' })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv))
      delete process.env[key]
  }
  Object.assign(process.env, savedEnv)
})

describe('OpenAI', () => {
  test('reports each call with its id, name and parsed arguments', async () => {
    respond({
      model: 'gpt-4o',
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          content: null,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } },
            { id: 'call_2', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Rome"}' } },
          ],
        },
      }],
    })

    const result = await openai.chat([question], { tools: [weather] })

    expect(result.content).toBe('')
    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'get_weather', arguments: { city: 'Paris' } },
      { id: 'call_2', name: 'get_weather', arguments: { city: 'Rome' } },
    ])
  })

  test('sends the calls back on the assistant message and each result as a tool message', async () => {
    respond({ model: 'gpt-4o', choices: [{ finish_reason: 'stop', message: { content: 'Sunny in both.' } }] })
    const call = { id: 'call_1', name: 'get_weather', arguments: { city: 'Paris' } }

    const result = await openai.chat([
      question,
      assistantTurn({ content: '', toolCalls: [call] }),
      toolResultsTurn([{ toolCallId: 'call_1', content: '{"sky":"clear"}' }]),
    ], { tools: [weather] })

    expect(result.content).toBe('Sunny in both.')
    expect(result.toolCalls).toBeUndefined()
    expect(requests[0]!.body.messages).toEqual([
      { role: 'user', content: 'Weather in Paris and Rome?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } }],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"sky":"clear"}' },
    ])
  })

  test('names the tool whose arguments are not JSON, instead of passing the error on as text', async () => {
    respond({
      model: 'gpt-4o',
      choices: [{ message: { content: null, tool_calls: [{ id: 'c', function: { name: 'get_weather', arguments: '{"city":' } }] } }],
    })
    await expect(openai.chat([question], { tools: [weather] })).rejects.toThrow('"get_weather" with arguments that are not a JSON object')
  })
})

describe('Anthropic', () => {
  test('keeps the text as content and every tool_use as a call', async () => {
    respond({
      model: 'claude-sonnet-5-5',
      stop_reason: 'tool_use',
      usage: { input_tokens: 1, output_tokens: 1 },
      content: [
        { type: 'text', text: 'Checking both.' },
        { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Paris' } },
        { type: 'tool_use', id: 'toolu_2', name: 'get_weather', input: { city: 'Rome' } },
      ],
    })

    const result = await anthropic.chat([question], { tools: [weather] })

    expect(result.content).toBe('Checking both.')
    expect(result.toolCalls).toEqual([
      { id: 'toolu_1', name: 'get_weather', arguments: { city: 'Paris' } },
      { id: 'toolu_2', name: 'get_weather', arguments: { city: 'Rome' } },
    ])
  })

  test('sends tool_use and tool_result blocks back', async () => {
    respond({ model: 'claude-sonnet-5-5', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: 'Clear.' }] })
    const call = { id: 'toolu_1', name: 'get_weather', arguments: { city: 'Paris' } }

    await anthropic.chat([
      question,
      assistantTurn({ content: 'Checking.', toolCalls: [call] }),
      toolResultsTurn([{ toolCallId: 'toolu_1', content: 'timeout', isError: true }]),
    ], { tools: [weather] })

    expect(requests[0]!.body.messages.slice(1)).toEqual([
      { role: 'assistant', content: [
        { type: 'text', text: 'Checking.' },
        { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Paris' } },
      ] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'timeout', is_error: true }] },
    ])
  })

  test('keeps the structured-output tool out of toolCalls', async () => {
    respond({
      model: 'claude-sonnet-5-5',
      usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: 'tool_use', id: 'toolu_9', name: 'structured_output', input: { answer: 42 } }],
    })
    const result = await anthropic.chat([question], { responseFormat: { type: 'json_object' } })
    expect(JSON.parse(result.content)).toEqual({ answer: 42 })
    expect(result.toolCalls).toBeUndefined()
  })

  test('toolChoice "none" forbids a call', async () => {
    respond({ model: 'claude-sonnet-5-5', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: 'ok' }] })
    await anthropic.chat([question], { tools: [weather], toolChoice: 'none' })
    // It was { type: 'auto', disable_parallel_tool_use: true }, which still allowed one.
    expect(requests[0]!.body.tool_choice).toEqual({ type: 'none' })
  })
})

describe('Ollama', () => {
  test('offers the tools, and reports calls with an id even when the server sends none', async () => {
    respond({
      model: 'llama3.2',
      done_reason: 'stop',
      message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'get_weather', arguments: { city: 'Paris' } } }] },
    })

    const result = await ollama.chat([question], { tools: [weather] })

    expect(requests[0]!.body.tools).toEqual([{ type: 'function', function: { name: 'get_weather', description: 'Current weather for a city', parameters: weather.parameters } }])
    expect(result.toolCalls).toEqual([{ id: 'call_0', name: 'get_weather', arguments: { city: 'Paris' } }])
  })

  test('sends calls, named results and images in Ollama\'s message shape', async () => {
    respond({ model: 'llama3.2', message: { role: 'assistant', content: 'Clear.' } })

    await ollama.chat([
      { role: 'user', content: [
        { type: 'text', text: 'And this photo?' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBOR' } },
      ] },
      assistantTurn({ content: '', toolCalls: [{ id: 'call_0', name: 'get_weather', arguments: { city: 'Paris' } }] }),
      toolResultsTurn([{ toolCallId: 'call_0', name: 'get_weather', content: 'clear' }]),
    ], { tools: [weather] })

    expect(requests[0]!.body.messages).toEqual([
      { role: 'user', content: 'And this photo?', images: ['iVBOR'] },
      { role: 'assistant', content: '', tool_calls: [{ function: { name: 'get_weather', arguments: { city: 'Paris' } } }] },
      { role: 'tool', content: 'clear', tool_name: 'get_weather' },
    ])
  })

  test('refuses to force a call, which Ollama cannot do', async () => {
    respond({ model: 'llama3.2', message: { content: '' } })
    await expect(ollama.chat([question], { tools: [weather], toolChoice: 'required' })).rejects.toThrow('Ollama cannot be made to call a tool')
    expect(requests).toHaveLength(0)
  })
})

describe('Bedrock', () => {
  test('reports toolUse blocks as calls and sends toolUse and toolResult back', async () => {
    respond({
      stopReason: 'tool_use',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      output: { message: { role: 'assistant', content: [
        { text: 'Checking.' },
        { toolUse: { toolUseId: 'tooluse_1', name: 'get_weather', input: { city: 'Paris' } } },
      ] } },
    })

    const first = await bedrock.chat([question], { tools: [weather] })
    expect(first.content).toBe('Checking.')
    expect(first.toolCalls).toEqual([{ id: 'tooluse_1', name: 'get_weather', arguments: { city: 'Paris' } }])

    respond({ stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, output: { message: { role: 'assistant', content: [{ text: 'Clear.' }] } } })
    await bedrock.chat([
      question,
      assistantTurn(first),
      toolResultsTurn([{ toolCallId: 'tooluse_1', content: 'clear' }]),
    ], { tools: [weather] })

    expect(requests[0]!.body.messages.slice(1)).toEqual([
      { role: 'assistant', content: [{ text: 'Checking.' }, { toolUse: { toolUseId: 'tooluse_1', name: 'get_weather', input: { city: 'Paris' } } }] },
      { role: 'user', content: [{ toolResult: { toolUseId: 'tooluse_1', content: [{ text: 'clear' }] } }] },
    ])
  })
})

describe('assistantTurn', () => {
  test('is a plain text message when the model called nothing', () => {
    expect(assistantTurn({ content: 'Hi.' })).toEqual({ role: 'assistant', content: 'Hi.' })
  })
})
