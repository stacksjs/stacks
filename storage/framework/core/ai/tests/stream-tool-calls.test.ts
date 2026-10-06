import type { AIMessage, AIResult, AIStreamEvent, AITool } from '../src/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { anthropic, createAnthropicDriver } from '../src/drivers/anthropic'
import { bedrock } from '../src/drivers/bedrock'
import { createOllamaDriver, ollama } from '../src/drivers/ollama'
import { createOpenAIDriver, openai } from '../src/drivers/openai'

/**
 * Tool calls made while streaming (stacksjs/stacks#2863).
 *
 * `streamChat()` yielded text and nothing else, and sent no tools: a model
 * that decided to call one mid-stream produced an empty stream, and the
 * fragments it streamed - Anthropic's `input_json_delta`, OpenAI's
 * `tool_calls[].function.arguments`, Ollama's `message.tool_calls` - reached
 * no one. Each driver now parses its stream once into events
 * (`streamChatEvents`), and `streamChat` is the text view of those, returning
 * the full result, so `for await (const text of streamChat(...))` still works.
 */

const originalFetch = globalThis.fetch
const savedEnv = { ...process.env }

let requests: Array<{ url: string, body: any }> = []

/**
 * Answer every request with this body, delivered a few bytes at a time so a
 * line, a JSON payload and a multi-byte character all straddle chunks.
 */
function streams(body: string | Uint8Array, init: ResponseInit = {}): void {
  requests = []
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  globalThis.fetch = (async (input: string | URL | Request, request?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(request?.body)) })
    let offset = 0
    return new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length)
          return controller.close()
        controller.enqueue(bytes.slice(offset, offset + 7))
        offset += 7
      },
    }), init)
  }) as typeof fetch
}

const sse = (...events: unknown[]) => events.map(event => `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`).join('')
const ndjson = (...lines: unknown[]) => lines.map(line => `${JSON.stringify(line)}\n`).join('')

async function events(stream: AsyncIterable<AIStreamEvent>): Promise<AIStreamEvent[]> {
  const seen: AIStreamEvent[] = []
  for await (const event of stream)
    seen.push(event)
  return seen
}

/** What a text-only caller sees, and what the generator returns at the end. */
async function textAndResult(stream: AsyncGenerator<string, AIResult, undefined>): Promise<{ text: string[], result: AIResult }> {
  const text: string[] = []
  let next = await stream.next()
  while (!next.done) {
    text.push(next.value)
    next = await stream.next()
  }
  return { text, result: next.value }
}

const weather: AITool = {
  name: 'get_weather',
  description: 'Current weather for a city',
  parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
}

const question: AIMessage = { role: 'user', content: 'Weather in Paris?' }

beforeEach(() => {
  process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE'
  process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
  delete process.env.AWS_SESSION_TOKEN
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

describe('Anthropic', () => {
  const toolStream = sse(
    { type: 'message_start', message: { model: 'claude-test', usage: { input_tokens: 40, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Checking ' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Paris… ' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: {} } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"city": "Pa' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: 'ris"}' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 22 } },
    { type: 'message_stop' },
  )

  test('streams the text, then the tool call whole once its arguments have arrived', async () => {
    streams(toolStream)

    expect(await events(anthropic.streamChatEvents([question], { tools: [weather] }))).toEqual([
      { type: 'text', text: 'Checking ' },
      { type: 'text', text: 'Paris… ' },
      { type: 'tool_call', call: { id: 'toolu_01', name: 'get_weather', arguments: { city: 'Paris' } } },
      {
        type: 'done',
        result: {
          content: 'Checking Paris… ',
          toolCalls: [{ id: 'toolu_01', name: 'get_weather', arguments: { city: 'Paris' } }],
          model: 'claude-test',
          usage: { promptTokens: 40, completionTokens: 22, totalTokens: 62 },
          finishReason: 'tool_use',
        },
      },
    ])
    expect(requests[0]!.body).toMatchObject({ stream: true, tools: [{ name: 'get_weather', input_schema: weather.parameters }] })
  })

  test('keeps a text-only caller working, with the call in the returned result', async () => {
    streams(toolStream)
    const { text, result } = await textAndResult(anthropic.streamChat([question], { tools: [weather] }))

    expect(text).toEqual(['Checking ', 'Paris… '])
    expect(result.toolCalls).toEqual([{ id: 'toolu_01', name: 'get_weather', arguments: { city: 'Paris' } }])
  })

  test('streams structured output as its JSON text, not as a tool call', async () => {
    streams(sse(
      { type: 'message_start', message: { model: 'claude-test', usage: { input_tokens: 5 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_x', name: 'answer', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"ok":' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: 'true}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 4 } },
    ))
    const seen = await events(anthropic.streamChatEvents([question], { responseFormat: { type: 'json_schema', json_schema: { name: 'answer', schema: { type: 'object' } } } }))

    expect(seen.filter(e => e.type === 'tool_call')).toEqual([])
    expect(seen.filter(e => e.type === 'text').map(e => (e as { text: string }).text).join('')).toBe('{"ok":true}')
    expect(requests[0]!.body.tool_choice).toEqual({ type: 'tool', name: 'answer' })
  })

  test('throws an error event instead of ending as if the model had finished', async () => {
    streams(sse(
      { type: 'message_start', message: { model: 'claude-test' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hel' } },
      { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
    ))
    await expect(events(anthropic.streamChatEvents([question]))).rejects.toThrow('Claude API error: overloaded_error: Overloaded')
  })

  test('throws on a payload that is not JSON rather than dropping what it carried', async () => {
    streams('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"a"}}\n\ndata: {not json\n\n')
    await expect(events(anthropic.streamChatEvents([question]))).rejects.toThrow('Claude API sent a stream event that is not JSON: {not json')
  })
})

describe('OpenAI', () => {
  const toolStream = sse(
    { model: 'gpt-test', choices: [{ index: 0, delta: { role: 'assistant', content: 'Let me check.' }, finish_reason: null }] },
    { model: 'gpt-test', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '' } }] }, finish_reason: null }] },
    { model: 'gpt-test', choices: [{ index: 0, delta: { tool_calls: [{ index: 1, id: 'call_2', type: 'function', function: { name: 'get_weather', arguments: '' } }] }, finish_reason: null }] },
    { model: 'gpt-test', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] }, finish_reason: null }] },
    { model: 'gpt-test', choices: [{ index: 0, delta: { tool_calls: [{ index: 1, function: { arguments: '{"city":"Rome"}' } }] }, finish_reason: null }] },
    { model: 'gpt-test', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"Paris"}' } }] }, finish_reason: null }] },
    { model: 'gpt-test', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
    { model: 'gpt-test', choices: [], usage: { prompt_tokens: 30, completion_tokens: 18, total_tokens: 48 } },
    '[DONE]',
  )

  test('assembles each call from its index-keyed fragments, and reports them when the choice finishes', async () => {
    streams(toolStream)

    expect(await events(openai.streamChatEvents([question], { tools: [weather] }))).toEqual([
      { type: 'text', text: 'Let me check.' },
      { type: 'tool_call', call: { id: 'call_1', name: 'get_weather', arguments: { city: 'Paris' } } },
      { type: 'tool_call', call: { id: 'call_2', name: 'get_weather', arguments: { city: 'Rome' } } },
      {
        type: 'done',
        result: {
          content: 'Let me check.',
          toolCalls: [
            { id: 'call_1', name: 'get_weather', arguments: { city: 'Paris' } },
            { id: 'call_2', name: 'get_weather', arguments: { city: 'Rome' } },
          ],
          model: 'gpt-test',
          usage: { promptTokens: 30, completionTokens: 18, totalTokens: 48 },
          finishReason: 'tool_calls',
        },
      },
    ])
    expect(requests[0]!.body).toMatchObject({ stream: true, stream_options: { include_usage: true }, tools: [{ type: 'function', function: { name: 'get_weather' } }] })
  })

  test('keeps a text-only caller working, with the calls in the returned result', async () => {
    streams(toolStream)
    const { text, result } = await textAndResult(openai.streamChat([question], { tools: [weather] }))

    expect(text).toEqual(['Let me check.'])
    expect(result.toolCalls?.map(call => call.id)).toEqual(['call_1', 'call_2'])
  })

  test('throws an error chunk', async () => {
    streams(sse({ error: { type: 'server_error', message: 'The server had an error' } }))
    await expect(events(openai.streamChatEvents([question]))).rejects.toThrow('OpenAI API error: server_error: The server had an error')
  })
})

describe('Ollama', () => {
  test('reports the call its message carries, and the counts from the last line', async () => {
    streams(ndjson(
      { model: 'llama-test', message: { role: 'assistant', content: 'Sure. ' }, done: false },
      { model: 'llama-test', message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'get_weather', arguments: { city: 'Paris' } } }] }, done: false },
      { model: 'llama-test', message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: 12, eval_count: 9 },
    ))

    expect(await events(ollama.streamChatEvents([question], { tools: [weather] }))).toEqual([
      { type: 'text', text: 'Sure. ' },
      { type: 'tool_call', call: { id: 'call_0', name: 'get_weather', arguments: { city: 'Paris' } } },
      {
        type: 'done',
        result: {
          content: 'Sure. ',
          toolCalls: [{ id: 'call_0', name: 'get_weather', arguments: { city: 'Paris' } }],
          model: 'llama-test',
          usage: { promptTokens: 12, completionTokens: 9, totalTokens: 21 },
          finishReason: 'stop',
        },
      },
    ])
    expect(requests[0]!.body).toMatchObject({ stream: true, tools: [{ type: 'function', function: { name: 'get_weather' } }] })
  })

  test('throws an error line', async () => {
    streams(ndjson({ error: 'model "nope" not found' }))
    await expect(events(ollama.streamChatEvents([question]))).rejects.toThrow('Ollama API error: model "nope" not found')
  })
})

describe('Bedrock', () => {
  const fixture = async (name: string) => new Uint8Array(await Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).arrayBuffer())

  test('streams a captured converse-stream text answer', async () => {
    streams(await fixture('bedrock-nova-lite-converse-stream.bin'))
    const { text, result } = await textAndResult(bedrock.streamChat([{ role: 'user', content: 'Reply with exactly: Hello from the stream.' }]))

    expect(text).toEqual(['Hello', ' from the stream.'])
    expect(result).toEqual({
      content: 'Hello from the stream.',
      model: 'amazon.nova-lite-v1:0',
      usage: { promptTokens: 9, completionTokens: 6, totalTokens: 15 },
      finishReason: 'end_turn',
    })
    expect(requests[0]!.url).toBe('https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-lite-v1%3A0/converse-stream')
  })

  test('reports the tool call from a captured converse-stream answer', async () => {
    streams(await fixture('bedrock-nova-lite-converse-stream-tool.bin'))
    const seen = await events(bedrock.streamChatEvents([question], { tools: [weather], toolChoice: 'required' }))

    expect(seen).toEqual([
      { type: 'tool_call', call: { id: 'tooluse_CStN2FyjgRcFZjEnvg7ppN', name: 'get_weather', arguments: { city: 'Paris' } } },
      {
        type: 'done',
        result: {
          content: '',
          toolCalls: [{ id: 'tooluse_CStN2FyjgRcFZjEnvg7ppN', name: 'get_weather', arguments: { city: 'Paris' } }],
          model: 'amazon.nova-lite-v1:0',
          usage: { promptTokens: 401, completionTokens: 16, totalTokens: 417 },
          finishReason: 'tool_use',
        },
      },
    ])
    expect(requests[0]!.body.toolConfig).toEqual({
      tools: [{ toolSpec: { name: 'get_weather', description: weather.description, inputSchema: { json: weather.parameters } } }],
      toolChoice: { any: {} },
    })
  })
})

/**
 * The `AIDriver.stream()` buddy uses parses the same wire formats. Its copies
 * of the parsing skipped a payload that was not JSON, silently dropping the
 * text in it, and Ollama's ignored an `error` line altogether.
 */
describe('AIDriver.stream()', () => {
  async function collect(stream: AsyncGenerator<string>): Promise<string[]> {
    const out: string[] = []
    for await (const text of stream)
      out.push(text)
    return out
  }

  test('streams the text of each driver, across chunk boundaries', async () => {
    streams(sse(
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hé' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'llo' } },
    ))
    expect(await collect(createAnthropicDriver({ apiKey: 'k' }).stream!('hi', 'sys', []))).toEqual(['Hé', 'llo'])

    streams(sse({ choices: [{ delta: { content: 'Hé' } }] }, { choices: [{ delta: { content: 'llo' } }] }, '[DONE]'))
    expect(await collect(createOpenAIDriver({ apiKey: 'k' }).stream!('hi', 'sys', []))).toEqual(['Hé', 'llo'])

    streams(ndjson({ message: { content: 'Hé' } }, { message: { content: 'llo' }, done: true }))
    expect(await collect(createOllamaDriver({ host: 'http://ollama.test' }).stream!('hi', 'sys', []))).toEqual(['Hé', 'llo'])
  })

  test('throws on a payload that is not JSON instead of dropping its text', async () => {
    streams('data: {"type":"content_block_delta","index":0,"delta":{"text":"a"}}\n\ndata: {"type":"content_bl\n\n')
    await expect(collect(createAnthropicDriver({ apiKey: 'k' }).stream!('hi', 'sys', []))).rejects.toThrow('Claude API sent a stream event that is not JSON')

    streams('data: {"choices":[{"delta":{"content":"a"}}]}\n\ndata: {"choi\n\n')
    await expect(collect(createOpenAIDriver({ apiKey: 'k' }).stream!('hi', 'sys', []))).rejects.toThrow('OpenAI API sent a stream event that is not JSON')

    streams('{"message":{"content":"a"}}\n{"mess\n')
    await expect(collect(createOllamaDriver({ host: 'http://ollama.test' }).stream!('hi', 'sys', []))).rejects.toThrow('Ollama API sent a stream event that is not JSON')
  })

  test('throws an Ollama error line rather than ending as if the model had finished', async () => {
    streams(ndjson({ message: { content: 'par' } }, { error: 'out of memory' }))
    await expect(collect(createOllamaDriver({ host: 'http://ollama.test' }).stream!('hi', 'sys', []))).rejects.toThrow('Ollama API error: out of memory')
  })
})
