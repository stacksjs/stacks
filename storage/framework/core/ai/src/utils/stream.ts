import type { AIResult, AIStreamEvent } from '../types'

/**
 * Plumbing shared by the drivers' streamed chat completions.
 *
 * Each driver parses its provider's wire format into {@link AIStreamEvent}s
 * once, in `streamChatEvents()`. `streamChat()` is the text-only view of that
 * same stream, so a caller that only wants the words keeps writing
 * `for await (const text of streamChat(...))` and nothing about it changed -
 * while a tool call the model makes mid-stream, which used to vanish, is in
 * the result the generator returns.
 */

/**
 * The text of an event stream, returning the stream's final result.
 *
 * `for await` reads the text and ignores the return value, which is what
 * keeps every existing caller working. A caller that wants the tool calls
 * too can take the return value, or iterate `streamChatEvents()` instead.
 */
export async function* streamText(events: AsyncIterable<AIStreamEvent>): AsyncGenerator<string, AIResult, undefined> {
  let result: AIResult | undefined
  for await (const event of events) {
    if (event.type === 'text')
      yield event.text
    else if (event.type === 'done')
      result = event.result
  }
  if (!result)
    throw new Error('The stream ended without a result')
  return result
}

/** The lines of a response body, decoded as UTF-8 across chunk boundaries. */
async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''
    for (const line of parts)
      yield line.endsWith('\r') ? line.slice(0, -1) : line
  }
  buffer += decoder.decode()
  if (buffer)
    yield buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer
}

/**
 * The JSON objects of a server-sent event stream: each `data:` payload,
 * parsed. OpenAI's `[DONE]` sentinel ends nothing on its own and is skipped.
 *
 * A payload that is not JSON throws. Skipping it, as the drivers used to,
 * silently drops whatever text or tool-call fragment it carried.
 */
export async function* sseJson(body: ReadableStream<Uint8Array>, provider: string): AsyncGenerator<any> {
  for await (const line of lines(body)) {
    if (!line.startsWith('data:'))
      continue
    const data = line.slice(5).trimStart()
    if (data === '[DONE]')
      continue
    yield parseEvent(data, provider)
  }
}

/** The JSON objects of a newline-delimited JSON stream, as Ollama sends. */
export async function* ndjson(body: ReadableStream<Uint8Array>, provider: string): AsyncGenerator<any> {
  for await (const line of lines(body)) {
    if (line.trim())
      yield parseEvent(line, provider)
  }
}

function parseEvent(data: string, provider: string): unknown {
  try {
    return JSON.parse(data)
  }
  catch {
    throw new Error(`${provider} sent a stream event that is not JSON: ${data.slice(0, 200)}`)
  }
}
