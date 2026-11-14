import { expect, test } from 'bun:test'
import { connectRealtime } from '../src/realtime'
import type { RealtimeSocket } from '../src/realtime'

class Socket extends EventTarget implements RealtimeSocket {
  readyState = 0
  bufferedAmount = 0
  sent: Array<Record<string, unknown>> = []
  send(data: string) { this.sent.push(JSON.parse(data)) }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')) }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')) }
  server(value: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })) }
}

test('realtime waits for configured session and uses GA audio events without exposing the key', async () => {
  const socket = new Socket()
  const events: unknown[] = []
  const pending = connectRealtime({ apiKey: 'secret', model: 'configured-model', instructions: 'Help customers', onEvent: event => events.push(event), socket: (url, headers) => {
    expect(url).toBe('wss://api.openai.com/v1/realtime?model=configured-model')
    expect(headers.Authorization).toBe('Bearer secret')
    return socket
  } })
  socket.open()
  expect(socket.sent[0]).toMatchObject({ type: 'session.update', session: { type: 'realtime', audio: { input: { format: { type: 'audio/pcmu' } } } } })
  socket.server({ type: 'session.updated', session: { id: 'rt-1' } })
  const session = await pending
  session.appendAudio('AA==')
  expect(socket.sent.at(-1)).toEqual({ type: 'input_audio_buffer.append', audio: 'AA==' })
  socket.server({ type: 'response.created', response: { id: 'response-1' } })
  socket.server({ type: 'response.output_audio.delta', delta: 'AQ==', item_id: 'item-1' })
  expect(events).toContainEqual({ type: 'audio', audio: 'AQ==', itemId: 'item-1' })
  session.interrupt('item-1', 120)
  expect(socket.sent.slice(-2)).toEqual([{ type: 'response.cancel' }, { type: 'conversation.item.truncate', item_id: 'item-1', content_index: 0, audio_end_ms: 120 }])
  socket.server({ type: 'response.done', response: { id: 'response-1', usage: { total_tokens: 10 } } })
  const before = socket.sent.length
  session.interrupt()
  expect(socket.sent).toHaveLength(before)
  session.close()
  expect(await session.closed).toMatchObject({ reason: 'closed' })
  expect(JSON.stringify(events)).not.toContain('secret')
})

test('only declared tools cross the transport and completed calls are deduplicated', async () => {
  const socket = new Socket()
  const events: unknown[] = []
  const pending = connectRealtime({ apiKey: 'key', model: 'model', instructions: 'Support', tools: [{ name: 'lookup_order', parameters: { type: 'object' } }], onEvent: event => events.push(event), socket: () => socket })
  socket.open()
  socket.server({ type: 'session.updated', session: { id: 'rt' } })
  const session = await pending
  const call = { type: 'response.function_call_arguments.done', call_id: 'call-1', name: 'lookup_order', arguments: '{"id":"5"}' }
  socket.server(call)
  socket.server(call)
  expect(events.filter(event => (event as { type: string }).type === 'tool_call')).toHaveLength(1)
  session.submitToolResult('call-1', { status: 'shipped' })
  expect(socket.sent.at(-2)).toEqual({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: 'call-1', output: '{"status":"shipped"}' } })
  socket.server({ ...call, call_id: 'call-2', name: 'unapproved_tool' })
  expect(await session.closed).toMatchObject({ reason: 'protocol' })
})

test('backpressure and malformed audio are refused; provider errors stay safe', async () => {
  const socket = new Socket()
  const events: unknown[] = []
  const pending = connectRealtime({ apiKey: 'key', model: 'model', instructions: 'Support', onEvent: event => events.push(event), socket: () => socket })
  socket.open()
  socket.server({ type: 'session.updated', session: { id: 'rt' } })
  const session = await pending
  expect(() => session.appendAudio('invalid audio')).toThrow()
  socket.bufferedAmount = 2_000_000
  expect(() => session.appendAudio('AA==')).toThrow()
  socket.server({ type: 'error', error: { message: 'secret provider context' } })
  expect(await session.closed).toMatchObject({ reason: 'provider' })
  expect(JSON.stringify(events)).not.toContain('secret provider context')
})

test('the Bun transport carries authentication headers and completes a real local WebSocket handshake', async () => {
  const server = Bun.serve({
    port: 0,
    fetch(request, server) {
      if (request.headers.get('authorization') !== 'Bearer local-test-key') return new Response(null, { status: 401 })
      if (server.upgrade(request)) return
      return new Response(null, { status: 400 })
    },
    websocket: {
      message(socket, input) {
        const value = JSON.parse(String(input))
        if (value.type === 'session.update') socket.send(JSON.stringify({ type: 'session.updated', session: { id: 'local' } }))
      },
    },
  })
  try {
    const session = await connectRealtime({
      apiKey: 'local-test-key', model: 'configured-model', instructions: 'Support', onEvent() {},
      socket(_url, headers) {
        const NativeSocket = WebSocket as unknown as { new(url: string, options: { headers: Record<string, string> }): RealtimeSocket }
        return new NativeSocket(`ws://127.0.0.1:${server.port}`, { headers })
      },
    })
    session.appendAudio('AA==')
    session.close()
    expect(await session.closed).toEqual({ reason: 'closed' })
  }
  finally { server.stop(true) }
})
